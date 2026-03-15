const analyticsRepository = require('../repositories/analytics.repository');
const redisClient = require('../cache/redis.client');
const { sendSuccess } = require('../utils/response.util');

class AnalyticsController {
  /**
   * GET /api/admin/match-analytics
   */
  async getMatchAnalytics(req, res, next) {
    try {
      const avgScoreAllMatches = await analyticsRepository.getAverageMatchScore();
      const acceptanceRate = await analyticsRepository.getAcceptanceRate();
      const topMatchedSkills = await analyticsRepository.getTopMatchedSkills(5);
      const matchesByDay = await analyticsRepository.getMatchesByDay(7);
      const cacheStats = redisClient.getCacheStats();

      return sendSuccess(res, 200, 'Match analytics retrieved successfully', {
        avgScoreAllMatches,
        acceptanceRate,
        topMatchedSkills,
        matchesByDay,
        cacheHitRate: cacheStats.hitRate
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();