const prisma = require('../../config/db.config');
const matchRepository = require('../../repositories/match.repository');

jest.mock('../../cache/redis.client', () => ({
  invalidatePattern: jest.fn().mockResolvedValue(),
}));
jest.mock('../../config/db.config', () => ({
  match: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  swap: {
    findFirst: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}));

describe('MatchRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createMatch calls prisma.create', async () => {
    prisma.match.create.mockResolvedValue({ id: 'm1' });
    await matchRepository.createMatch({ userId1: 'u1', userId2: 'u2' });
    expect(prisma.match.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId1: 'u1' })
    }));
  });

  it('findById calls prisma.findUnique', async () => {
    prisma.match.findUnique.mockResolvedValue({ id: 'm1' });
    await matchRepository.findById('m1');
    expect(prisma.match.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'm1' }
    }));
  });

  it('findMatchesByUser hits findMany and count', async () => {
    prisma.match.findMany.mockResolvedValue([]);
    prisma.match.count.mockResolvedValue(0);
    const res = await matchRepository.findMatchesByUser('u1', { page: 1, limit: 10, status: 'accepted' });
    expect(res.total).toBe(0);
    expect(prisma.match.findMany).toHaveBeenCalled();
  });

  it('findExistingMatch calls findFirst; pending does not need swap', async () => {
    prisma.match.findFirst.mockResolvedValue({ id: 'm1', status: 'pending' });
    const res = await matchRepository.findExistingMatch('u1', 'u2');
    expect(res?.id).toBe('m1');
    expect(prisma.match.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.any(Array) })
    }));
  });

  it('updateMatchStatus sets isActive based on status', async () => {
    prisma.match.update.mockResolvedValue({});
    await matchRepository.updateMatchStatus('m1', { status: 'accepted' });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'accepted', isActive: true }
    });

    await matchRepository.updateMatchStatus('m1', { status: 'declined' });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'declined', isActive: false }
    });
  });

  it('getExpiredMatches calls findMany', async () => {
    prisma.match.findMany.mockResolvedValue([]);
    await matchRepository.getExpiredMatches();
    expect(prisma.match.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: expect.any(Object) })
    }));
  });

  it('expireStaleMatches calls updateMany', async () => {
    prisma.match.updateMany.mockResolvedValue({ count: 5 });
    const res = await matchRepository.expireStaleMatches();
    expect(res.count).toBe(5);
    expect(prisma.match.updateMany).toHaveBeenCalled();
  });

  it('getMatchStats calls count thrice', async () => {
    prisma.match.count.mockResolvedValue(10);
    const res = await matchRepository.getMatchStats('u1');
    expect(res.totalMatches).toBe(10);
    expect(prisma.match.count).toHaveBeenCalledTimes(3);
  });

  describe('getActiveCandidatePool', () => {
    it('excludes open pairings (pending) from candidate pool', async () => {
      prisma.match.findMany
        .mockResolvedValueOnce([
          { id: 'm1', userId1: 'u1', userId2: 'u2' },
          { id: 'm2', userId1: 'u3', userId2: 'u1' },
        ])
        .mockResolvedValueOnce([]);
      prisma.user.findMany.mockResolvedValue([]);

      await matchRepository.getActiveCandidatePool('u1');

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: expect.arrayContaining(['u1', 'u2', 'u3']) }
        })
      }));
    });
  });
});
