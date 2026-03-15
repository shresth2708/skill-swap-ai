const analyticsController = require('../../controllers/analytics.controller');
const analyticsRepository = require('../../repositories/analytics.repository');
const redisClient = require('../../cache/redis.client');

jest.mock('../../repositories/analytics.repository');
jest.mock('../../cache/redis.client');

describe('AnalyticsController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('getMatchAnalytics success', async () => {
    analyticsRepository.getAverageMatchScore.mockResolvedValue(0.8);
    analyticsRepository.getAcceptanceRate.mockResolvedValue(0.5);
    analyticsRepository.getTopMatchedSkills.mockResolvedValue([]);
    analyticsRepository.getMatchesByDay.mockResolvedValue([]);
    redisClient.getCacheStats.mockReturnValue({ hitRate: 0.9 });

    await analyticsController.getMatchAnalytics(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ avgScoreAllMatches: 0.8 })
    }));
  });

  it('getMatchAnalytics handles error', async () => {
    analyticsRepository.getAverageMatchScore.mockRejectedValue(new Error('fail'));
    await analyticsController.getMatchAnalytics(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
