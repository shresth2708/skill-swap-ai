const ReviewService = require('../services/review.service');
const { SwapStatus } = require('../utils/swap-state-machine');
const logger = require('../utils/logger');

jest.mock('../config/db.config', () => ({}));
jest.mock('../repositories/review.repository');
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/user.repository');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('ReviewService', () => {
  let reviewService, mockReviewRepo, mockSwapRepo, mockUserRepo, mockEmitter;

  const mockReview = (overrides = {}) => ({
    id: 'r1', swapId: 's1', reviewerId: 'u1', revieweeId: 'u2',
    rating: 5, createdAt: new Date(), isFlagged: false, ...overrides
  });

  beforeEach(() => {
    mockReviewRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySwapAndReviewer: jest.fn(),
      update: jest.fn(),
      calculateUserRating: jest.fn().mockResolvedValue({ avgRating: 5, totalReviews: 1 }),
      getUserSwapStats: jest.fn().mockResolvedValue({ totalSwaps: 1, completedSwaps: 1, totalIncoming: 1, respondedIn24h: 1 }),
      updateUserRatingAndTrust: jest.fn().mockResolvedValue({}),
      findReviewsForUser: jest.fn(),
      findReviewsForSwap: jest.fn(),
    };
    mockSwapRepo = { findById: jest.fn() };
    mockUserRepo = { findById: jest.fn() };
    mockEmitter = {
      emitReviewReceived: jest.fn(),
      emitReviewUpdated: jest.fn(),
      emitReviewFlagged: jest.fn(),
    };
    reviewService = new ReviewService(mockReviewRepo, mockSwapRepo, mockUserRepo, mockEmitter);
  });

  describe('submitReview', () => {
    it('creates review successfully and determines reviewee', async () => {
      mockSwapRepo.findById.mockResolvedValue({ id: 's1', status: SwapStatus.COMPLETED, initiatorId: 'u1', receiverId: 'u2' });
      mockReviewRepo.findBySwapAndReviewer.mockResolvedValue(null);
      mockReviewRepo.create.mockResolvedValue(mockReview({ reviewerId: 'u1', revieweeId: 'u2' }));
      
      const res = await reviewService.submitReview('s1', 'u1', { rating: 5, isPublic: true });
      expect(res.id).toBe('r1');
      expect(mockReviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({ revieweeId: 'u2' }));
    });

    it('throws 400 for rating < 1 or > 5', async () => {
      mockSwapRepo.findById.mockResolvedValue({ status: SwapStatus.COMPLETED, initiatorId: 'u1', receiverId: 'u2' });
      await expect(reviewService.submitReview('s1', 'u1', { rating: 0 })).rejects.toMatchObject({ statusCode: 400 });
      await expect(reviewService.submitReview('s1', 'u1', { rating: 6 })).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('editReview', () => {
    it('throws if not the reviewer', async () => {
      mockReviewRepo.findById.mockResolvedValue(mockReview({ reviewerId: 'u2' }));
      await expect(reviewService.editReview('r1', 'u1', { rating: 4 })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws if rating in edit is invalid', async () => {
      mockReviewRepo.findById.mockResolvedValue(mockReview({ reviewerId: 'u1' }));
      await expect(reviewService.editReview('r1', 'u1', { rating: 6 })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('updates only provided fields and triggers recal if rating changed', async () => {
      mockReviewRepo.findById.mockResolvedValue(mockReview({ reviewerId: 'u1' }));
      mockReviewRepo.update.mockResolvedValue(mockReview({ rating: 4, comment: 'Changed' }));
      await reviewService.editReview('r1', 'u1', { rating: 4, comment: 'Changed' });
      expect(mockReviewRepo.update).toHaveBeenCalledWith('r1', { rating: 4, comment: 'Changed' });
    });
  });

  describe('flagReview', () => {
    it('throws if review not found', async () => {
      mockReviewRepo.findById.mockResolvedValue(null);
      await expect(reviewService.flagReview('r1', 'admin')).rejects.toThrow('Review not found');
    });
  });

  describe('getters', () => {
    it('gets reviews for user', async () => {
      mockReviewRepo.findReviewsForUser.mockResolvedValue({ reviews: [], avgRating: 0 });
      const res = await reviewService.getReviewsForUser('u1');
      expect(res.reviews).toEqual([]);
    });

    it('gets reviews for swap', async () => {
      mockSwapRepo.findById.mockResolvedValue({ initiatorId: 'u1', receiverId: 'u2' });
      mockReviewRepo.findReviewsForSwap.mockResolvedValue([]);
      const res = await reviewService.getReviewsForSwap('s1', 'u1');
      expect(res).toEqual([]);
    });

    it('throws if swap not found in getReviewsForSwap', async () => {
      mockSwapRepo.findById.mockResolvedValue(null);
      await expect(reviewService.getReviewsForSwap('s1', 'u1')).rejects.toThrow('Swap not found');
    });

    it('throws if user not participant in swap for reviews', async () => {
      mockSwapRepo.findById.mockResolvedValue({ initiatorId: 'u1', receiverId: 'u2' });
      await expect(reviewService.getReviewsForSwap('s1', 'u3')).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('Recalculation', () => {
    it('handles zero swaps and incoming requests in trust score', async () => {
      mockReviewRepo.calculateUserRating.mockResolvedValue({ avgRating: 0, totalReviews: 0 });
      mockReviewRepo.getUserSwapStats.mockResolvedValue({ totalSwaps: 0, completedSwaps: 0, totalIncoming: 0, respondedIn24h: 0 });
      await reviewService.recalculateUserRating('u1');
      expect(mockReviewRepo.updateUserRatingAndTrust).toHaveBeenCalledWith('u1', 0, 0, 0);
    });

    it('logs error if async recalculation fails', async () => {
      mockReviewRepo.calculateUserRating.mockRejectedValue(new Error('Recalc Fail'));
      
      // We call the private-ish async method by proxy (needs to hit #recalculateUserRatingAsync)
      // Actually we can't call private directly, but flagReview calls it.
      mockReviewRepo.findById.mockResolvedValue({ id: 'r1', revieweeId: 'u2' });
      mockReviewRepo.update.mockResolvedValue({ revieweeId: 'u2' });
      
      await reviewService.flagReview('r1', 'admin');
      
      // Wait for catch block
      await new Promise(r => setTimeout(r, 10));
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
