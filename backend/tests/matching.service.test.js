const MatchingService = require('../services/matching.service');
const prisma = require('../config/db.config');
const logger = require('../utils/logger');

jest.mock('../config/db.config', () => ({
  user: { findUnique: jest.fn(), findMany: jest.fn(), findWithSkillsAndAvailability: jest.fn() },
  match: { findMany: jest.fn(), findUnique: jest.fn(), getActiveCandidatePool: jest.fn(), findExistingMatch: jest.fn(), createMatch: jest.fn(), findById: jest.fn(), updateMatchStatus: jest.fn(), getMatchStats: jest.fn(), expireStaleMatches: jest.fn() },
}));

jest.mock('../cache/redis.client', () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidatePattern: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('MatchingService', () => {
  let matchingService, mockStrategy, mockUserRepo, mockMatchRepo, mockCache;

  beforeEach(() => {
    mockStrategy = {
      constructor: { name: 'SkillBasedStrategy' },
      findCandidates: jest.fn().mockReturnValue([{ id: 'u2', profile: { displayName: 'Bob' }, skills: [{ skillId: 's1', skill: { name: 'Node' } }] }]),
      calculateScore: jest.fn().mockReturnValue(0.9),
      rankMatches: jest.fn().mockImplementation(m => m),
      calculateScoreBreakdown: jest.fn().mockReturnValue({ score: 0.9, breakdown: {} }),
    };
    mockUserRepo = {
      findWithSkillsAndAvailability: jest.fn(),
    };
    mockMatchRepo = {
      findMatchesByUser: jest.fn().mockResolvedValue({ matches: [], total: 0 }),
      getActiveCandidatePool: jest.fn().mockResolvedValue([]),
      findExistingMatch: jest.fn().mockResolvedValue(null),
      createMatch: jest.fn().mockResolvedValue({ id: 'm1' }),
      findById: jest.fn(),
      getMatchStats: jest.fn(),
      updateMatchStatus: jest.fn(),
      expireStaleMatches: jest.fn(),
    };
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidatePattern: jest.fn(),
    };
    matchingService = new MatchingService(mockStrategy, mockMatchRepo, mockUserRepo, mockCache);
  });

  describe('findMatches', () => {
    it('returns cached results if hit', async () => {
      const cached = { matches: [], meta: { strategy: 'skill-based' } };
      mockCache.get.mockResolvedValue(cached);
      const res = await matchingService.findMatches('u1');
      expect(res.meta.cached).toBe(true);
      expect(mockUserRepo.findWithSkillsAndAvailability).not.toHaveBeenCalled();
    });

    it('handles cache error on get', async () => {
      mockCache.get.mockRejectedValue(new Error('Redis Down'));
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'u1', skills: [{ id: 's1' }] });
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([]);
      await matchingService.findMatches('u1');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Cache error'), expect.any(Object));
    });

    it('returns empty if user has no skills', async () => {
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'u1', skills: [] });
      const res = await matchingService.findMatches('u1');
      expect(res.matches).toHaveLength(0);
      expect(res.meta.message).toContain('No skills listed');
    });

    it('ranks and stores new matches', async () => {
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ 
        id: 'u1', skills: [{ skillId: 's1', skill: { name: 'Node' } }] 
      });
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([{ id: 'u2', skills: [{ skillId: 's1' }] }]);
      mockMatchRepo.findExistingMatch.mockResolvedValue(null);
      mockMatchRepo.createMatch.mockResolvedValue({ id: 'm1' });
      
      const res = await matchingService.findMatches('u1');
      expect(res.matches[0].matchId).toBe('m1');
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('uses existing matches if found', async () => {
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'u1', skills: [{ skillId: 's1' }] });
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([{ id: 'u2', skills: [] }]);
      mockMatchRepo.findExistingMatch.mockResolvedValue({ id: 'exist1', matchedAt: new Date() });
      
      const res = await matchingService.findMatches('u1');
      expect(res.matches[0].matchId).toBe('exist1');
    });
  });

  describe('explainMatch', () => {
    it('returns breakdown from strategy', async () => {
      mockMatchRepo.findById.mockResolvedValue({ userId1: 'u1', userId2: 'u2' });
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({});
      const res = await matchingService.explainMatch('m1');
      expect(res.score).toBe(0.9);
    });

    it('throws if user not found', async () => {
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue(null);
      await expect(matchingService.findMatches('u1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 501 if strategy does not support explanation', async () => {
      mockStrategy.calculateScoreBreakdown = undefined;
      mockMatchRepo.findById.mockResolvedValue({ userId1: 'u1', userId2: 'u2' });
      await expect(matchingService.explainMatch('m1')).rejects.toMatchObject({ statusCode: 501 });
    });
  });

  describe('Match Actions', () => {
    it('acceptMatch updates status and invalidates cache', async () => {
      mockMatchRepo.findById.mockResolvedValue({ id: 'm1', status: 'pending', userId1: 'u1', userId2: 'u2' });
      mockMatchRepo.updateMatchStatus.mockResolvedValue({ id: 'm1', status: 'accepted' });
      
      await matchingService.acceptMatch('m1', 'u1');
      expect(mockMatchRepo.updateMatchStatus).toHaveBeenCalled();
      expect(mockCache.invalidatePattern).toHaveBeenCalled();
    });

    it('throws if match resolved already', async () => {
      mockMatchRepo.findById.mockResolvedValue({ id: 'm1', status: 'accepted', userId1: 'u1', userId2: 'u2' });
      await expect(matchingService.acceptMatch('m1', 'u1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws if user not participant', async () => {
      mockMatchRepo.findById.mockResolvedValue({ id: 'm1', status: 'pending', userId1: 'u1', userId2: 'u2' });
      await expect(matchingService.acceptMatch('m1', 'u3')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 404 if match not found in explainMatch', async () => {
      mockMatchRepo.findById.mockResolvedValue(null);
      await expect(matchingService.explainMatch('m1')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('declineMatch updates status', async () => {
      mockMatchRepo.findById.mockResolvedValue({ id: 'm1', status: 'pending', userId1: 'u1', userId2: 'u2' });
      await matchingService.declineMatch('m1', 'u1');
      expect(mockMatchRepo.updateMatchStatus).toHaveBeenCalledWith('m1', { status: 'declined' });
    });
  });

  describe('Utilities', () => {
    it('gets match stats', async () => {
      mockMatchRepo.getMatchStats.mockResolvedValue({ total: 5 });
      const res = await matchingService.getMatchStats('u1');
      expect(res.total).toBe(5);
    });

    it('expires stale matches', async () => {
      mockMatchRepo.expireStaleMatches.mockResolvedValue({ count: 10 });
      const res = await matchingService.expireStaleMatches();
      expect(res.count).toBe(10);
    });

    it('handles cache set error', async () => {
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'u1', skills: [{ id: 's1' }] });
      mockMatchRepo.getActiveCandidatePool.mockResolvedValue([]);
      mockCache.set.mockRejectedValue(new Error('Redis Full'));
      await matchingService.findMatches('u1');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Cache error'), expect.any(Object));
    });
  });
});