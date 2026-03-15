const matchingController = require('../../controllers/matching.controller');
const MatchingService = require('../../services/matching.service');
const StrategyFactory = require('../../factories/strategy.factory');

jest.mock('../../services/matching.service');
jest.mock('../../factories/strategy.factory');

describe('MatchingController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
      params: {},
      user: { id: 'u1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('findMatches', () => {
    it('calls findMatches and sends success', async () => {
      const mockService = { findMatches: jest.fn().mockResolvedValue({ matches: [] }) };
      MatchingService.prototype.constructor = jest.fn().mockReturnValue(mockService);
      // Wait, constructors are tricky to mock with prototype. 
      // Better: let the actual MatchingService be mocked by Jest and control its instance.
      MatchingService.mockImplementation(() => mockService);
      StrategyFactory.create.mockReturnValue({});

      await matchingController.findMatches(req, res, next);

      expect(mockService.findMatches).toHaveBeenCalledWith('u1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes error to next', async () => {
      MatchingService.mockImplementation(() => {
        throw new Error('fail');
      });
      await matchingController.findMatches(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getMatchStats', () => {
    it('calls getMatchStats', async () => {
      const mockService = { getMatchStats: jest.fn().mockResolvedValue({}) };
      MatchingService.mockImplementation(() => mockService);
      await matchingController.getMatchStats(req, res, next);
      expect(mockService.getMatchStats).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes error to next', async () => {
      MatchingService.mockImplementation(() => ({
        getMatchStats: jest.fn().mockRejectedValue(new Error('fail'))
      }));
      await matchingController.getMatchStats(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getMatchById', () => {
    it('throws 403 if not participant', async () => {
      const mockService = { getMatchById: jest.fn().mockResolvedValue({ userId1: 'u2', userId2: 'u3' }) };
      MatchingService.mockImplementation(() => mockService);
      req.params.id = 'm1';

      await matchingController.getMatchById(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('success if participant', async () => {
      const mockService = { getMatchById: jest.fn().mockResolvedValue({ userId1: 'u1', userId2: 'u2' }) };
      MatchingService.mockImplementation(() => mockService);
      await matchingController.getMatchById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('explainMatch', () => {
    it('loads match for authorization, then calls explainMatch', async () => {
      const match = { userId1: 'u1', userId2: 'u2', strategyUsed: 'SkillBasedStrategy' };
      const mockService = {
        getMatchById: jest.fn().mockResolvedValue(match),
        explainMatch: jest.fn().mockResolvedValue({ finalScore: 0.5 }),
      };
      MatchingService.mockImplementation(() => mockService);
      req.params.matchId = 'm1';
      await matchingController.explainMatch(req, res, next);
      expect(mockService.getMatchById).toHaveBeenCalledWith('m1');
      expect(mockService.explainMatch).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('passes error to next', async () => {
      const match = { userId1: 'u1', userId2: 'u2', strategyUsed: 'SkillBasedStrategy' };
      MatchingService.mockImplementation(() => ({
        getMatchById: jest.fn().mockResolvedValue(match),
        explainMatch: jest.fn().mockRejectedValue(new Error('fail')),
      }));
      req.params.matchId = 'm1';
      await matchingController.explainMatch(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('acceptMatch', () => {
    it('calls acceptMatch', async () => {
      const mockService = { acceptMatch: jest.fn().mockResolvedValue({}) };
      MatchingService.mockImplementation(() => mockService);
      await matchingController.acceptMatch(req, res, next);
      expect(mockService.acceptMatch).toHaveBeenCalled();
    });
  });

  describe('declineMatch', () => {
    it('calls declineMatch', async () => {
      const mockService = { declineMatch: jest.fn().mockResolvedValue({}) };
      MatchingService.mockImplementation(() => mockService);
      await matchingController.declineMatch(req, res, next);
      expect(mockService.declineMatch).toHaveBeenCalled();
    });
  });
});
