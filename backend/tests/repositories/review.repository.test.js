const prisma = require('../../config/db.config');
const reviewRepository = require('../../repositories/review.repository');

jest.mock('../../config/db.config', () => ({
  review: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  swap: {
    count: jest.fn(),
  },
}));

describe('ReviewRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create calls prisma.create', async () => {
    prisma.review.create.mockResolvedValue({ id: 'r1' });
    await reviewRepository.create({ swapId: 's1', reviewerId: 'u1', rating: 5 });
    expect(prisma.review.create).toHaveBeenCalled();
  });

  it('findById calls prisma.findUnique', async () => {
    prisma.review.findUnique.mockResolvedValue({});
    await reviewRepository.findById('r1');
    expect(prisma.review.findUnique).toHaveBeenCalled();
  });

  it('findBySwapAndReviewer calls prisma.findUnique with composite key', async () => {
    prisma.review.findUnique.mockResolvedValue({});
    await reviewRepository.findBySwapAndReviewer('s1', 'u1');
    expect(prisma.review.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { swapId_reviewerId: { swapId: 's1', reviewerId: 'u1' } }
    }));
  });

  it('update calls prisma.update', async () => {
    prisma.review.update.mockResolvedValue({});
    await reviewRepository.update('r1', { rating: 4 });
    expect(prisma.review.update).toHaveBeenCalled();
  });

  it('findReviewsForUser hits findMany, count, and aggregate', async () => {
    prisma.review.findMany.mockResolvedValue([]);
    prisma.review.count.mockResolvedValue(0);
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 0 } });
    const res = await reviewRepository.findReviewsForUser('u1');
    expect(res.avgRating).toBe(0);
    expect(prisma.review.findMany).toHaveBeenCalled();
    expect(prisma.review.count).toHaveBeenCalled();
    expect(prisma.review.aggregate).toHaveBeenCalled();
  });

  it('findReviewsForSwap hits findMany', async () => {
    prisma.review.findMany.mockResolvedValue([]);
    await reviewRepository.findReviewsForSwap('s1');
    expect(prisma.review.findMany).toHaveBeenCalled();
  });

  it('calculateUserRating hits aggregate', async () => {
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { id: 10 } });
    const res = await reviewRepository.calculateUserRating('u1');
    expect(res.avgRating).toBe(4.5);
    expect(res.totalReviews).toBe(10);
  });

  it('updateUserRatingAndTrust hits user.update', async () => {
    prisma.user.update.mockResolvedValue({});
    await reviewRepository.updateUserRatingAndTrust('u1', 4.5, 10, 0.9);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ trustScore: 0.9 })
    }));
  });

  it('getUserSwapStats hits swap.count 4 times', async () => {
    prisma.swap.count.mockResolvedValue(1);
    const res = await reviewRepository.getUserSwapStats('u1');
    expect(res.totalSwaps).toBe(1);
    expect(prisma.swap.count).toHaveBeenCalledTimes(4);
  });
});
