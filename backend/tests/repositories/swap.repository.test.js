const prisma = require('../../config/db.config');
const swapRepository = require('../../repositories/swap.repository');
const { SwapStatus } = require('../../utils/swap-state-machine');

jest.mock('../../config/db.config', () => ({
  swap: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  $transaction: jest.fn(objs => Promise.all(objs)),
}));

describe('SwapRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create calls prisma.create', async () => {
    prisma.swap.create.mockResolvedValue({ id: 's1' });
    await swapRepository.create({ initiatorId: 'u1', receiverId: 'u2' });
    expect(prisma.swap.create).toHaveBeenCalled();
  });

  it('findById calls prisma.findUnique', async () => {
    prisma.swap.findUnique.mockResolvedValue({ id: 's1' });
    await swapRepository.findById('s1');
    expect(prisma.swap.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' }
    }));
  });

  it('findByUserId hits findMany', async () => {
    prisma.swap.findMany.mockResolvedValue([]);
    await swapRepository.findByUserId('u1', { status: SwapStatus.PENDING });
    expect(prisma.swap.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: SwapStatus.PENDING })
    }));
  });

  it('update calls prisma.update', async () => {
    prisma.swap.update.mockResolvedValue({});
    await swapRepository.update('s1', { status: SwapStatus.ACCEPTED });
    expect(prisma.swap.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 's1' },
      data: expect.objectContaining({ status: SwapStatus.ACCEPTED })
    }));
  });

  it('findActiveSwaps filters by multiple statuses', async () => {
    prisma.swap.findMany.mockResolvedValue([]);
    await swapRepository.findActiveSwaps('u1');
    expect(prisma.swap.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: [SwapStatus.ACCEPTED, SwapStatus.IN_PROGRESS] }
      })
    }));
  });

  it('findSwapHistory handles dates and pagination', async () => {
    prisma.swap.findMany.mockResolvedValue([]);
    prisma.swap.count.mockResolvedValue(0);
    const res = await swapRepository.findSwapHistory('u1', { 
      fromDate: '2026-01-01', 
      toDate: '2026-01-02', 
      page: 2, 
      limit: 10 
    });
    expect(res.page).toBe(2);
    expect(prisma.swap.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10
    }));
  });

  it('findExpiredPendingSwaps filters correct status', async () => {
    prisma.swap.findMany.mockResolvedValue([]);
    await swapRepository.findExpiredPendingSwaps();
    expect(prisma.swap.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: SwapStatus.PENDING })
    }));
  });

  it('expireSwaps calls updateMany', async () => {
    prisma.swap.updateMany.mockResolvedValue({ count: 2 });
    await swapRepository.expireSwaps(['s1', 's2']);
    expect(prisma.swap.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['s1', 's2'] } })
    }));
  });

  it('findExistingSwapForMatch calls findFirst', async () => {
    prisma.swap.findFirst.mockResolvedValue({});
    await swapRepository.findExistingSwapForMatch('m1');
    expect(prisma.swap.findFirst).toHaveBeenCalled();
  });

  it('getSwapStats calls count', async () => {
    prisma.swap.count.mockResolvedValue(1);
    const res = await swapRepository.getSwapStats('u1');
    expect(res.total).toBe(1);
    expect(prisma.swap.count).toHaveBeenCalledTimes(4);
  });

  it('incrementUserSwapCounts calls $transaction with updates', async () => {
    await swapRepository.incrementUserSwapCounts('u1', 'u2');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });
});
