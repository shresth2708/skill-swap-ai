const prisma = require('../config/db.config');
const cache = require('../cache/redis.client');

/** Swap outcomes that no longer need an exclusive lock on a match pair. */
const TERMINAL_SWAP_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED']);
const MATCHES_CACHE_PREFIX = 'skillswap:matches:v2';

/**
 * Encapsulates database queries for the Match model.
 * Adheres to SRP by handling only DB operations for matches.
 *
 * Performance notes:
 *   - getActiveCandidatePool limits to 200 candidates (pre-filter before scoring)
 *   - All queries use select with specific columns where feasible (never SELECT *)
 *   - Relies on DB indexes: user_skills(user_id, type), availability_slots(user_id, day_of_week)
 */
class MatchRepository {
  /**
   * Create a new match record.
   * @param {Object} data - Match creation payload
   * @returns {Promise<Object>} Created match with user relations
   */
  async createMatch(data) {
    return await prisma.match.create({
      data: {
        userId1: data.userId1,
        userId2: data.userId2,
        compatibilityScore: data.compatibilityScore,
        strategyUsed: data.strategyUsed,
        sharedInterests: data.sharedInterests || null,
        isActive: true,
        status: 'pending',
        expiresAt: data.expiresAt,
      },
      include: {
        user1: {
          include: { profile: true },
        },
        user2: {
          include: { profile: true },
        },
      },
    });
  }

  /**
   * Find a match by its ID with full user details.
   * @param {string} matchId
   * @returns {Promise<Object|null>}
   */
  async findById(matchId) {
    return await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          include: {
            profile: true,
            skills: { include: { skill: true } },
          },
        },
        user2: {
          include: {
            profile: true,
            skills: { include: { skill: true } },
          },
        },
      },
    });
  }

  /**
   * Find all matches for a user with pagination.
   * Includes both user profiles, skills, and scores.
   * @param {string} userId
   * @param {Object} pagination
   * @param {number} [pagination.page=1]
   * @param {number} [pagination.limit=20]
   * @param {string} [pagination.status] - Filter by match status
   * @param {string} [pagination.strategyUsed] - Filter by strategy class name
   * @returns {Promise<{matches: Array, total: number}>}
   */
  async findMatchesByUser(userId, { page = 1, limit = 20, status, strategyUsed } = {}) {
    const skip = (page - 1) * limit;

    const whereClause = {
      OR: [{ userId1: userId }, { userId2: userId }],
      isActive: true,
    };

    if (status) {
      whereClause.status = status;
    }

    if (strategyUsed) {
      whereClause.strategyUsed = strategyUsed;
    }

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where: whereClause,
        select: {
          id: true,
          userId1: true,
          userId2: true,
          compatibilityScore: true,
          strategyUsed: true,
          sharedInterests: true,
          status: true,
          matchedAt: true,
          expiresAt: true,
          user1: {
            select: {
              id: true,
              avgRating: true,
              profile: {
                select: {
                  displayName: true,
                  bio: true,
                  avatarUrl: true,
                  location: true,
                },
              },
              skills: {
                select: {
                  type: true,
                  proficiencyLevel: true,
                  skill: { select: { name: true } },
                },
              },
            },
          },
          user2: {
            select: {
              id: true,
              avgRating: true,
              profile: {
                select: {
                  displayName: true,
                  bio: true,
                  avatarUrl: true,
                  location: true,
                },
              },
              skills: {
                select: {
                  type: true,
                  proficiencyLevel: true,
                  skill: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { compatibilityScore: 'desc' },
        skip,
        take: limit,
      }),
      prisma.match.count({ where: whereClause }),
    ]);

    return { matches, total };
  }

  /**
   * Returns a match that still blocks a *new* pending suggestion, or null if the pair can get a new match.
   * If the pair is only tied by a stale "accepted" match whose swap already ended, that row is
   * closed (fulfilled) and null is returned so a fresh pending match can be created.
   * @param {string} userIdA
   * @param {string} userIdB
   * @returns {Promise<Object|null>}
   */
  async findExistingMatch(userIdA, userIdB) {
    const m = await prisma.match.findFirst({
      where: {
        isActive: true,
        status: { in: ['pending', 'accepted'] },
        OR: [
          { userId1: userIdA, userId2: userIdB },
          { userId1: userIdB, userId2: userIdA },
        ],
      },
    });
    if (!m) {
      return null;
    }
    if (m.status === 'pending') {
      return m;
    }
    // accepted — block only if there is an open (non-terminal) swap, or no swap yet
    const latest = await prisma.swap.findFirst({
      where: { matchId: m.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      return m;
    }
    if (TERMINAL_SWAP_STATUSES.has(latest.status)) {
      try {
        await this.markMatchFulfilled(m.id);
        await this.#bustMatchCacheForUserPair(m.userId1, m.userId2);
      } catch (e) {
        // If already updated elsewhere, still allow a new match row
      }
      return null;
    }
    return m;
  }

  /**
   * @private
   * @param {string} a
   * @param {string} b
   */
  async #bustMatchCacheForUserPair(a, b) {
    try {
      await cache.invalidatePattern(`${MATCHES_CACHE_PREFIX}:${a}:*`);
      await cache.invalidatePattern(`${MATCHES_CACHE_PREFIX}:${b}:*`);
    } catch (e) {
      // no-op: cache is best-effort
    }
  }

  /**
   * Closes a match so both users can appear in the candidate pool again
   * (e.g. after a swap is completed, cancelled, or a pending swap expires).
   * @param {string} matchId
   */
  async markMatchFulfilled(matchId) {
    return await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'fulfilled',
        isActive: false,
      },
    });
  }

  /**
   * Update a match with arbitrary fields.
   * @param {string} matchId
   * @param {Object} updates - Fields to update (status, isActive, etc.)
   * @returns {Promise<Object>}
   */
  async updateMatchStatus(matchId, updates) {
    // Automatically set isActive based on status if status is being updated
    const data = { ...updates };
    if (data.status) {
      data.isActive = data.status === 'accepted' || data.status === 'pending';
    }

    return await prisma.match.update({
      where: { id: matchId },
      data,
    });
  }

  /**
   * Find all expired matches (expiresAt < now AND isActive = true).
   * @returns {Promise<Array>}
   */
  async getExpiredMatches() {
    return await prisma.match.findMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        userId1: true,
        userId2: true,
        status: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Expire all stale pending matches whose expiresAt has passed.
   * Designed to be called by a cron job.
   * @returns {Promise<{count: number}>}
   */
  async expireStaleMatches() {
    return await prisma.match.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'expired',
        isActive: false,
      },
    });
  }

  /**
   * Get match statistics for a user.
   * @param {string} userId
   * @returns {Promise<{totalMatches: number, acceptedMatches: number, declinedMatches: number}>}
   */
  async getMatchStats(userId) {
    const whereBase = {
      OR: [{ userId1: userId }, { userId2: userId }],
    };

    const [totalMatches, acceptedMatches, declinedMatches] = await Promise.all([
      prisma.match.count({ where: whereBase }),
      prisma.match.count({ where: { ...whereBase, status: 'accepted' } }),
      prisma.match.count({ where: { ...whereBase, status: 'declined' } }),
    ]);

    return { totalMatches, acceptedMatches, declinedMatches };
  }

  /**
   * @see getActiveCandidatePool — partners who still "lock" the pair in matching.
   * @param {string} userId
   * @returns {Promise<Set<string>>}
   */
  async getPartnerUserIdsWhoBlockNewSuggestions(userId) {
    const blocked = new Set([userId]);

    const pending = await prisma.match.findMany({
      where: {
        isActive: true,
        status: 'pending',
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      select: { id: true, userId1: true, userId2: true },
    });
    for (const m of pending) {
      blocked.add(m.userId1);
      blocked.add(m.userId2);
    }

    const accepted = await prisma.match.findMany({
      where: {
        isActive: true,
        status: 'accepted',
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      select: { id: true, userId1: true, userId2: true },
    });

    for (const m of accepted) {
      const latest = await prisma.swap.findFirst({
        where: { matchId: m.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) {
        blocked.add(m.userId1);
        blocked.add(m.userId2);
        continue;
      }
      if (TERMINAL_SWAP_STATUSES.has(latest.status)) {
        try {
          await this.markMatchFulfilled(m.id);
          await this.#bustMatchCacheForUserPair(m.userId1, m.userId2);
        } catch (e) {
          // no-op: row may already be closed
        }
        continue;
      }
      blocked.add(m.userId1);
      blocked.add(m.userId2);
    }

    return blocked;
  }

  /**
   * Get all active candidate users, excluding the given user and those
   * they have an *open* pairing with (see getPartnerUserIdsWhoBlockNewSuggestions).
   *
   * Performance:
   *   - Limited to 200 candidates (pre-filter before scoring)
   *   - Uses select with specific columns (never SELECT *)
   *
   * @param {string} userId - The seeking user's ID
   * @returns {Promise<Array>}
   */
  async getActiveCandidatePool(userId) {
    const excludeIds = await this.getPartnerUserIdsWhoBlockNewSuggestions(userId);

    return await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) },
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        avgRating: true,
        profile: {
          select: {
            displayName: true,
            bio: true,
            avatarUrl: true,
            location: true,
            latitude: true,
            longitude: true,
          },
        },
        skills: {
          select: {
            skillId: true,
            type: true,
            proficiencyLevel: true,
            skill: { select: { id: true, name: true } },
          },
        },
        availabilitySlots: {
          select: {
            dayOfWeek: true,
            slotStart: true,
            slotEnd: true,
          },
        },
      },
      take: 200, // Limit candidate pool for performance
    });
  }
}

module.exports = new MatchRepository();
