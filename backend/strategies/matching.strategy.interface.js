/**
 * @interface MatchingStrategy
 * 
 * Abstract base class for all matching strategies.
 * All concrete strategies MUST implement these methods.
 * 
 * Design Principles:
 *   - OCP: MatchingService is closed for modification, open for extension via new strategies
 *   - LSP: All subclasses are substitutable for MatchingStrategy
 */
class MatchingStrategy {
  /**
   * Calculate a compatibility score between two users.
   * @param {Object} user1 - First user (with skills, availability, profile)
   * @param {Object} user2 - Second user (with skills, availability, profile)
   * @returns {number} Score between 0.0 and 1.0
   */
  calculateScore(user1, user2) {
    throw new Error('MatchingStrategy.calculateScore() must be implemented by subclass');
  }

  /**
   * Filter and return viable candidates from a pool for the given user.
   * @param {string} userId - The user looking for matches
   * @param {Array} pool - Array of candidate user objects
   * @returns {Array} Filtered array of candidate users
   */
  findCandidates(userId, pool) {
    throw new Error('MatchingStrategy.findCandidates() must be implemented by subclass');
  }

  /**
   * Rank an array of scored matches in order of quality.
   * @param {Array<{user: Object, score: number}>} matches - Array of match objects with scores
   * @returns {Array<{user: Object, score: number}>} Sorted array, best match first
   */
  rankMatches(matches) {
    throw new Error('MatchingStrategy.rankMatches() must be implemented by subclass');
  }
}

module.exports = MatchingStrategy;
