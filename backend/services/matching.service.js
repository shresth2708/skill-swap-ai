const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const defaultMatchRepository = require('../repositories/match.repository');
const defaultUserRepository = require('../repositories/user.repository');
const cache = require('../cache/redis.client');
const logger = require('../utils/logger');

/**
 * Cache key prefix and TTL constants.
 */
const CACHE_KEY_PREFIX = 'skillswap:matches:v2';
const CACHE_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_MATCH_EXPIRY_DAYS = 7;

/**
 * MatchingService — orchestrates the matching engine.
 *
 * Design:
 *   - Strategy Pattern: #strategy is runtime-swappable via setStrategy()
 *   - Cache-Aside Pattern: check cache → compute on miss → store → return
 *   - OCP: closed for modification, open for extension (new strategies)
 *   - DIP: depends on abstractions (MatchingStrategy interface)
 */
class MatchingService {
  /** @type {import('../strategies/matching.strategy.interface')} */
  #strategy;

  /** @type {import('../repositories/match.repository')} */
  #matchRepository;

  /** @type {import('../repositories/user.repository')} */
  #userRepository;

  /** @type {import('../cache/redis.client')} */
  #cache;

  /**
   * @param {import('../strategies/matching.strategy.interface')} [strategy]
   * @param {Object} [matchRepository]
   * @param {Object} [userRepository]
   * @param {Object} [cacheClient]
   */
  constructor(
    strategy = new SkillBasedStrategy(),
    matchRepository = defaultMatchRepository,
    userRepository = defaultUserRepository,
    cacheClient = cache,
  ) {
    this.#strategy = strategy;
    this.#matchRepository = matchRepository;
    this.#userRepository = userRepository;
    this.#cache = cacheClient;
  }

  /**
   * Swap the matching strategy at runtime.
   * @param {import('../strategies/matching.strategy.interface')} strategy
   */
  setStrategy(strategy) {
    this.#strategy = strategy;
  }

  /**
   * Get the current strategy name (lowercase, without 'Strategy' suffix).
   * @returns {string}
   */
  get strategyName() {
    return this.#strategy.constructor.name
      .replace(/Strategy$/, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }

  /**
   * Find and score matches for a user.
   *
   * Cache-Aside Pattern:
   *  1. Build cacheKey = skillswap:matches:{userId}:{strategyName}:{page}
   *  2. Try Redis GET → return if hit (with meta.cached = true)
   *  3. On miss: compute matches → store in Redis TTL 600s → return (meta.cached = false)
   *  4. Invalidate cache on: new skill added, availability changed, match accepted
   *
   * @param {string} userId
   * @param {Object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=20]
   * @returns {Promise<Object>} { matches, pagination, meta }
   */
  async findMatches(userId, options = {}) {
    const page = parseInt(options.page, 10) || 1;
    const limit = Math.min(parseInt(options.limit, 10) || 20, 50);
    const strategy = this.strategyName;
    const strategyClassName = this.#strategy.constructor.name;

    // 1. Build cache key
    const cacheKey = `${CACHE_KEY_PREFIX}:${userId}:${strategy}:${page}`;

    // 2. Try cache
    let cached = null;
    try {
      cached = await this.#cache.get(cacheKey);
    } catch (err) {
      logger.warn('Cache error during get', { error: err.message });
    }
    if (cached) {
      logger.info('Cache hit for matches', { userId, strategy, page });
      return {
        ...cached,
        meta: { ...cached.meta, cached: true },
      };
    }

    // 3. Cache miss — first return existing pending matches for this strategy
    logger.info('Cache miss — computing matches', { userId, strategy, page });

    const existing = await this.#matchRepository.findMatchesByUser(userId, {
      page,
      limit,
      status: 'pending',
      strategyUsed: strategyClassName,
    });

    if ((existing.matches || []).length > 0) {
      const computedAt = new Date().toISOString();
      const response = {
        matches: existing.matches.map((match) => {
          const counterpart = match.userId1 === userId ? match.user2 : match.user1;
          return {
            matchId: match.id,
            matchedUser: this._formatMatchedUser(counterpart),
            compatibilityScore: parseFloat(match.compatibilityScore) || 0,
            sharedInterests: match.sharedInterests || [],
            matchedAt: match.matchedAt,
          };
        }),
        pagination: {
          page,
          limit,
          total: existing.total,
        },
        meta: {
          strategy,
          computedAt,
          cached: false,
          source: 'existing',
        },
      };

      try {
        await this.#cache.set(cacheKey, response, CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn('Cache error during set', { error: err.message });
      }

      return response;
    }

    // 4. No pending records found — compute new candidates

    // Fetch the seeking user
    const user = await this.#userRepository.findWithSkillsAndAvailability(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.errorCode = 'USER_NOT_FOUND';
      throw error;
    }

    if (!user.skills || user.skills.length === 0) {
      return { 
        matches: [], 
        pagination: { total: 0 }, 
        meta: { message: "No skills listed. Add skills to find matches.", strategy, cached: false } 
      };
    }

    // Get candidate pool (excludes existing matches, limited to 200)
    const pool = await this.#matchRepository.getActiveCandidatePool(userId);

    // Pre-filter with strategy (pass seeker for complementary offer/want logic)
    const candidates = this.#strategy.findCandidates(userId, pool, user);

    // Score each candidate
    const scoredMatches = candidates.map((candidate) => {
      const score = this.#strategy.calculateScore(user, candidate);
      const sharedInterests = this._findSharedInterests(user, candidate);

      return {
        user: candidate,
        score: parseFloat(score.toFixed(4)),
        sharedInterests,
      };
    });

    // Rank by score
    const ranked = this.#strategy.rankMatches(scoredMatches);

    // Paginate
    const total = ranked.length;
    const start = (page - 1) * limit;
    const paginated = ranked.slice(start, start + limit);

    // Store match records in DB
    const matchExpiry = new Date();
    matchExpiry.setDate(matchExpiry.getDate() + DEFAULT_MATCH_EXPIRY_DAYS);

    const storedMatches = await Promise.all(
      paginated.map(async (match) => {
        // Avoid duplicating existing matches
        const existing = await this.#matchRepository.findExistingMatch(userId, match.user.id);
        if (existing) {
          return { ...match, matchId: existing.id, matchedAt: existing.matchedAt || new Date() };
        }

        const record = await this.#matchRepository.createMatch({
          userId1: userId,
          userId2: match.user.id,
          compatibilityScore: match.score,
          strategyUsed: this.#strategy.constructor.name,
          sharedInterests: match.sharedInterests,
          expiresAt: matchExpiry,
        });

        return { ...match, matchId: record.id, matchedAt: record.matchedAt || new Date() };
      }),
    );

    // Build response per spec
    const computedAt = new Date().toISOString();

    const response = {
      matches: storedMatches.map((m) => ({
        matchId: m.matchId,
        matchedUser: this._formatMatchedUser(m.user),
        compatibilityScore: m.score,
        sharedInterests: m.sharedInterests,
        matchedAt: m.matchedAt,
      })),
      pagination: { page, limit, total },
      meta: { strategy, computedAt, cached: false },
    };

    // 5. Store in cache with TTL
    try {
      await this.#cache.set(cacheKey, response, CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn('Cache error during set', { error: err.message });
    }

    return response;
  }

  /**
   * Get a specific match by ID.
   * @param {string} matchId
   * @returns {Promise<Object>}
   */
  async getMatchById(matchId) {
    const match = await this.#matchRepository.findById(matchId);
    if (!match) {
      const error = new Error('Match not found');
      error.statusCode = 404;
      error.errorCode = 'MATCH_NOT_FOUND';
      throw error;
    }
    return match;
  }

  /**
   * Explain the scoring for a specific match.
   * @param {string} matchId
   * @returns {Promise<Object>}
   */
  async explainMatch(matchId) {
    const match = await this.#matchRepository.findById(matchId);
    if (!match) {
      const error = new Error('Match not found');
      error.statusCode = 404;
      error.errorCode = 'MATCH_NOT_FOUND';
      throw error;
    }

    const { userId1, userId2 } = match;
    const user1 = await this.#userRepository.findWithSkillsAndAvailability(userId1);
    const user2 = await this.#userRepository.findWithSkillsAndAvailability(userId2);

    if (typeof this.#strategy.calculateScoreBreakdown !== 'function') {
      const error = new Error(`Strategy "${this.strategyName}" does not support explaination.`);
      error.statusCode = 501;
      throw error;
    }

    return this.#strategy.calculateScoreBreakdown(user1, user2);
  }

  /**
   * Accept a match. Updates status and invalidates cache for both users.
   * @param {string} matchId
   * @param {string} userId - The user accepting the match
   * @returns {Promise<Object>}
   */
  async acceptMatch(matchId, userId) {
    const match = await this._validateMatchAction(matchId, userId);

    const updated = await this.#matchRepository.updateMatchStatus(matchId, {
      status: 'accepted',
    });

    // Invalidate cached matches for both users
    await this._invalidateUserCache(match.userId1);
    await this._invalidateUserCache(match.userId2);

    return updated;
  }

  /**
   * Decline a match. Updates status to 'declined' and invalidates cache.
   * @param {string} matchId
   * @param {string} userId - The user declining the match
   * @returns {Promise<Object>}
   */
  async declineMatch(matchId, userId) {
    const match = await this._validateMatchAction(matchId, userId);

    const updated = await this.#matchRepository.updateMatchStatus(matchId, {
      status: 'declined',
    });

    // Invalidate cached matches for both users
    await this._invalidateUserCache(match.userId1);
    await this._invalidateUserCache(match.userId2);

    return updated;
  }

  /**
   * Get match statistics for a user (dashboard use).
   * @param {string} userId
   * @returns {Promise<{totalMatches: number, acceptedMatches: number, declinedMatches: number}>}
   */
  async getMatchStats(userId) {
    return await this.#matchRepository.getMatchStats(userId);
  }

  /**
   * Expire all stale pending matches past their expiresAt.
   * Intended to be called by a scheduled cron job.
   * @returns {Promise<{count: number}>}
   */
  async expireStaleMatches() {
    return await this.#matchRepository.expireStaleMatches();
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Validate that a match exists, is pending, and the user is a participant.
   * @private
   */
  async _validateMatchAction(matchId, userId) {
    const match = await this.#matchRepository.findById(matchId);

    if (!match) {
      const error = new Error('Match not found');
      error.statusCode = 404;
      error.errorCode = 'MATCH_NOT_FOUND';
      throw error;
    }

    if (match.status !== 'pending') {
      const error = new Error(`Match has already been ${match.status}`);
      error.statusCode = 400;
      error.errorCode = 'MATCH_ALREADY_RESOLVED';
      throw error;
    }

    if (match.userId1 !== userId && match.userId2 !== userId) {
      const error = new Error('Forbidden: you are not part of this match');
      error.statusCode = 403;
      error.errorCode = 'FORBIDDEN';
      throw error;
    }

    return match;
  }

  /**
   * Find overlapping skill interests between two users.
   * @private
   */
  _findSharedInterests(user1, user2) {
    const u1SkillIds = new Set((user1.skills || []).map((s) => s.skillId));
    const shared = (user2.skills || [])
      .filter((s) => u1SkillIds.has(s.skillId))
      .map((s) => ({
        skillId: s.skillId,
        skillName: s.skill?.name || 'Unknown',
      }));

    // Deduplicate by skillId
    const seen = new Set();
    return shared.filter((s) => {
      if (seen.has(s.skillId)) return false;
      seen.add(s.skillId);
      return true;
    });
  }

  /**
   * Format a user object into the spec-defined matchedUser shape.
   * @private
   * @param {Object} user
   * @returns {Object} { id, displayName, avatarUrl, avgRating, location, skills }
   */
  _formatMatchedUser(user) {
    return {
      id: user.id,
      displayName: user.profile?.displayName || null,
      bio: user.profile?.bio || null,
      avatarUrl: user.profile?.avatarUrl || null,
      avgRating: parseFloat(user.avgRating) || 0,
      location: user.profile?.location || null,
      skills: (user.skills || []).map((us) => ({
        name: us.skill?.name || 'Unknown',
        type: us.type,
        level: us.proficiencyLevel,
      })),
    };
  }

  /**
   * Invalidate all cached match results for a given user.
   * Uses pattern: skillswap:matches:{userId}:*
   * @private
   */
  async _invalidateUserCache(userId) {
    await this.#cache.invalidatePattern(`${CACHE_KEY_PREFIX}:${userId}:*`);
  }
}

/**
 * After a match is no longer "active" (e.g. swap finished), clear cached /matches results for both users.
 * @param {string} userId1
 * @param {string} userId2
 */
async function invalidateMatchesCacheForUsers(userId1, userId2) {
  await cache.invalidatePattern(`${CACHE_KEY_PREFIX}:${userId1}:*`);
  await cache.invalidatePattern(`${CACHE_KEY_PREFIX}:${userId2}:*`);
}

/**
 * Clear every cached /matches response. Call when *any* user's skills/availability/profile
 * used for matching change so *other* users (not just the editor) get fresh results.
 * @returns {Promise<number>}
 */
async function invalidateMatchesCacheGlobally() {
  return await cache.invalidatePattern(`${CACHE_KEY_PREFIX}:*`);
}

module.exports = MatchingService;
module.exports.invalidateMatchesCacheForUsers = invalidateMatchesCacheForUsers;
module.exports.invalidateMatchesCacheGlobally = invalidateMatchesCacheGlobally;
