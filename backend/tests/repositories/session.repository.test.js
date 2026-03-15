const prisma = require('../../config/db.config');
const sessionRepository = require('../../repositories/session.repository');

jest.mock('../../config/db.config', () => ({
  swapSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  swapCompletionConfirmation: {
    upsert: jest.fn(),
    count: jest.fn(),
  },
}));

describe('SessionRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create calls prisma.create', async () => {
    prisma.swapSession.create.mockResolvedValue({ id: 's1' });
    await sessionRepository.create({ swapId: 'sw1', scheduledAt: new Date() });
    expect(prisma.swapSession.create).toHaveBeenCalled();
  });

  it('findById calls prisma.findUnique', async () => {
    prisma.swapSession.findUnique.mockResolvedValue({});
    await sessionRepository.findById('s1');
    expect(prisma.swapSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' }
    }));
  });

  it('findBySwapId calls prisma.findUnique', async () => {
    prisma.swapSession.findUnique.mockResolvedValue({});
    await sessionRepository.findBySwapId('sw1');
    expect(prisma.swapSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { swapId: 'sw1' }
    }));
  });

  it('update calls prisma.update', async () => {
    prisma.swapSession.update.mockResolvedValue({});
    await sessionRepository.update('s1', { status: 'COMPLETED' });
    expect(prisma.swapSession.update).toHaveBeenCalled();
  });

  it('findUpcomingSessions hits findMany with dates', async () => {
    prisma.swapSession.findMany.mockResolvedValue([]);
    await sessionRepository.findUpcomingSessions('u1', 7);
    expect(prisma.swapSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'SCHEDULED' })
    }));
  });

  describe('findConflictingSessions', () => {
    it('filters sessions by duration overlap', async () => {
      const startTime = new Date('2026-05-04T10:00:00Z');
      const endTime = new Date('2026-05-04T11:00:00Z');
      
      // Session that ends at 10:05 (overlaps)
      const session1 = { id: 's1', scheduledAt: '2026-05-04T09:30:00Z', durationMins: 60 }; // ends 10:30
      // Session that ends at 09:55 (no overlap)
      const session2 = { id: 's2', scheduledAt: '2026-05-04T09:00:00Z', durationMins: 30 }; // ends 09:30

      prisma.swapSession.findMany.mockResolvedValue([session1, session2]);

      const res = await sessionRepository.findConflictingSessions('u1', startTime, endTime);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('s1');
    });

    it('excludes specified session id', async () => {
      prisma.swapSession.findMany.mockResolvedValue([]);
      await sessionRepository.findConflictingSessions('u1', new Date(), new Date(), 'exclude-123');
      expect(prisma.swapSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'exclude-123' } })
      }));
    });
  });

  it('findSessionsForReminder24h hits findMany', async () => {
    prisma.swapSession.findMany.mockResolvedValue([]);
    await sessionRepository.findSessionsForReminder24h();
    expect(prisma.swapSession.findMany).toHaveBeenCalled();
  });

  it('findSessionsForReminder1h hits findMany', async () => {
    prisma.swapSession.findMany.mockResolvedValue([]);
    await sessionRepository.findSessionsForReminder1h();
    expect(prisma.swapSession.findMany).toHaveBeenCalled();
  });

  it('findMissedSessions hits findMany', async () => {
    prisma.swapSession.findMany.mockResolvedValue([]);
    await sessionRepository.findMissedSessions();
    expect(prisma.swapSession.findMany).toHaveBeenCalled();
  });

  it('markSessionsMissed hits updateMany', async () => {
    prisma.swapSession.updateMany.mockResolvedValue({ count: 1 });
    await sessionRepository.markSessionsMissed(['s1']);
    expect(prisma.swapSession.updateMany).toHaveBeenCalled();
  });

  it('createCompletionConfirmation hits upsert', async () => {
    prisma.swapCompletionConfirmation.upsert.mockResolvedValue({});
    await sessionRepository.createCompletionConfirmation('sw1', 'u1');
    expect(prisma.swapCompletionConfirmation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { swapId_userId: { swapId: 'sw1', userId: 'u1' } }
    }));
  });

  it('countCompletionConfirmations hits count', async () => {
    prisma.swapCompletionConfirmation.count.mockResolvedValue(2);
    const res = await sessionRepository.countCompletionConfirmations('sw1');
    expect(res).toBe(2);
    expect(prisma.swapCompletionConfirmation.count).toHaveBeenCalled();
  });
});
