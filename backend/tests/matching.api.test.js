const request = require('supertest');
const app = require('../app');
const MatchingService = require('../services/matching.service');
const { verifyToken } = require('../utils/jwt.util');

// Mock external dependencies
jest.mock('../services/matching.service');
jest.mock('../utils/jwt.util'); // To bypass auth middleware properly

describe('Matching API Endpoints', () => {
  const MOCK_USER_ID = 'user-123';
  const MOCK_TOKEN = 'mock-jwt-token';
  
  beforeAll(() => {
    // Setup our fake auth payload that verifyToken will return
    verifyToken.mockReturnValue({ id: MOCK_USER_ID });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/matches', () => {
    it('should return paginated matches using a specific strategy', async () => {
      const mockResponse = {
        matches: [{ matchId: 'm1', compatibilityScore: 0.9 }],
        pagination: { page: 1, limit: 20, total: 1 },
        meta: { strategy: 'skill', cached: false }
      };

      MatchingService.prototype.findMatches.mockResolvedValue(mockResponse);

      const res = await request(app)
        .get('/api/matches?strategy=skill&page=1')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResponse);
      expect(MatchingService.prototype.findMatches).toHaveBeenCalledWith(MOCK_USER_ID, {
        page: '1',
        limit: undefined
      });
    });

    it('should handle unauthenticated access', async () => {
      const res = await request(app).get('/api/matches');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/matches/stats', () => {
    it('should return match statistics', async () => {
      const mockStats = { totalMatches: 10, acceptedMatches: 5, declinedMatches: 2 };
      MatchingService.prototype.getMatchStats.mockResolvedValue(mockStats);

      const res = await request(app)
        .get('/api/matches/stats')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockStats);
      expect(MatchingService.prototype.getMatchStats).toHaveBeenCalledWith(MOCK_USER_ID);
    });
  });

  describe('GET /api/matches/:id', () => {
    it('should return a specific match', async () => {
      const mockMatch = { id: 'm1', userId1: MOCK_USER_ID, userId2: 'user-2' };
      MatchingService.prototype.getMatchById.mockResolvedValue(mockMatch);

      const res = await request(app)
        .get('/api/matches/m1')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockMatch);
      expect(MatchingService.prototype.getMatchById).toHaveBeenCalledWith('m1');
    });

    it('should return 403 if user is not part of match', async () => {
      // Mock getMatchById returning a match without MOCK_USER_ID
      const mockMatch = { id: 'm1', userId1: 'other-1', userId2: 'other-2' };
      MatchingService.prototype.getMatchById.mockResolvedValue(mockMatch);
      
      const res = await request(app)
        .get('/api/matches/m1')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/matches/:id/accept', () => {
    it('should accept a match successfully', async () => {
      const mockResult = { id: 'm1', status: 'accepted' };
      MatchingService.prototype.acceptMatch.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/matches/m1/accept')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
      expect(MatchingService.prototype.acceptMatch).toHaveBeenCalledWith('m1', MOCK_USER_ID);
    });
  });

  describe('POST /api/matches/:id/decline', () => {
    it('should decline a match successfully', async () => {
      const mockResult = { id: 'm1', status: 'declined' };
      MatchingService.prototype.declineMatch.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/matches/m1/decline')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockResult);
      expect(MatchingService.prototype.declineMatch).toHaveBeenCalledWith('m1', MOCK_USER_ID);
    });
  });
});
