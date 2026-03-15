const MatchingStrategy = require('./matching.strategy.interface');
const SkillBasedStrategy = require('./skill-based.strategy');
const LocationBasedStrategy = require('./location-based.strategy');

/**
 * Concrete strategy: AI Hybrid Matching (Phase 2C placeholder)
 * 
 * Combines SkillBased and LocationBased strategies with configurable weights.
 * Includes a stub for future ML-based scoring.
 * 
 * Default weighting:
 *   finalScore = skillScore × skillWeight + locationScore × locationWeight
 */
class AIHybridStrategy extends MatchingStrategy {
  /**
   * @param {Object} options
   * @param {number} [options.skillWeight=0.6] - Weight for skill-based score
   * @param {number} [options.locationWeight=0.4] - Weight for location-based score
   */
  constructor({ skillWeight = 0.6, locationWeight = 0.4 } = {}) {
    super();

    // Validate weights sum to 1.0
    const total = skillWeight + locationWeight;
    if (Math.abs(total - 1.0) > 0.001) {
      throw new Error(`Strategy weights must sum to 1.0, got ${total}`);
    }

    /** @private */
    this._skillWeight = skillWeight;
    /** @private */
    this._locationWeight = locationWeight;
    /** @private */
    this._skillStrategy = new SkillBasedStrategy();
    /** @private */
    this._locationStrategy = new LocationBasedStrategy();
  }

  /**
   * Calculate blended score from skill and location strategies.
   * @param {Object} user1 - Seeking user
   * @param {Object} user2 - Candidate user
   * @returns {number} Score between 0.0 and 1.0
   */
  calculateScore(user1, user2) {
    const skillScore = this._skillStrategy.calculateScore(user1, user2);
    const locationScore = this._locationStrategy.calculateScore(user1, user2);

    return skillScore * this._skillWeight + locationScore * this._locationWeight;
  }

  /**
   * Filter candidates using skill-based pre-filtering.
   */
  findCandidates(userId, pool, seeker = null) {
    return this._skillStrategy.findCandidates(userId, pool, seeker);
  }

  /**
   * Rank matches by score descending.
   */
  rankMatches(matches) {
    return [...matches].sort((a, b) => b.score - a.score);
  }

  /**
   * Phase 2C stub: ML-based scoring.
   * Currently delegates to SkillBasedStrategy.calculateScore().
   * 
   * In Phase 2C this will call an external ML service for
   * embeddings-based compatibility prediction.
   * 
   * @param {Object} user1 - Seeking user
   * @param {Object} user2 - Candidate user
   * @returns {Promise<number>} Score between 0.0 and 1.0
   */
  async scoreWithML(user1, user2) {
    // TODO: Phase 2C — Replace with ML service call
    // Example future implementation:
    //   const embedding1 = await mlService.getUserEmbedding(user1.id);
    //   const embedding2 = await mlService.getUserEmbedding(user2.id);
    //   return mlService.cosineSimilarity(embedding1, embedding2);

    return this._skillStrategy.calculateScore(user1, user2);
  }
}

module.exports = AIHybridStrategy;
