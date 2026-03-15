const analyticsController = require('../controllers/analytics.controller');
const analyticsRepository = require('../repositories/analytics.repository');
const redisClient = require('../cache/redis.client');
const { sendSuccess } = require('../utils/response.util');

jest.mock('../repositories/analytics.repository');
jest.mock('../cache/redis.client');
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

describe('AnalyticsController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getMatchAnalytics', () => {
    it('returns match analytics successfully fetching all dependencies', async () => {
      analyticsRepository.getAverageMatchScore.mockResolvedValueOnce(0.85);
      analyticsRepository.getAcceptanceRate.mockResolvedValueOnce(60);
      analyticsRepository.getTopMatchedSkills.mockResolvedValueOnce(['js']);
      analyticsRepository.getMatchesByDay.mockResolvedValueOnce([{ day: 'mon', count: 1 }]);
      redisClient.getCacheStats.mockReturnValueOnce({ hitRate: 80 });

      await analyticsController.getMatchAnalytics(req, res, next);

      expect(analyticsRepository.getAverageMatchScore).toHaveBeenCalled();
      expect(analyticsRepository.getAcceptanceRate).toHaveBeenCalled();
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Match analytics retrieved successfully', {
        avgScoreAllMatches: 0.85,
        acceptanceRate: 60,
        topMatchedSkills: ['js'],
        matchesByDay: [{ day: 'mon', count: 1 }],
        cacheHitRate: 80
      });
    });

    it('passes error to next on failure', async () => {
      const err = new Error('db err');
      analyticsRepository.getAverageMatchScore.mockRejectedValueOnce(err);
      
      await analyticsController.getMatchAnalytics(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
