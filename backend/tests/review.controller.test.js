const reviewController = require('../controllers/review.controller');
const ReviewService = require('../services/review.service');
const { sendSuccess, sendError } = require('../utils/response.util');

jest.mock('../services/review.service');
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('ReviewController Expansion', () => {
  let req, res, next;
  let mockReviewService;

  beforeEach(() => {
    req = { user: { id: 'user-1' }, body: {}, params: {}, query: {} };
    res = {};
    next = jest.fn();

    mockReviewService = {
      submitReview: jest.fn(),
      editReview: jest.fn(),
      getReviewsForUser: jest.fn(),
      getReviewsForSwap: jest.fn(),
      flagReview: jest.fn(),
    };

    ReviewService.mockImplementation(() => mockReviewService);
    jest.clearAllMocks();
  });

  describe('getReviewsForSwap', () => {
    it('should return swap reviews successfully', async () => {
      req.params.id = 'swap-1';
      mockReviewService.getReviewsForSwap.mockResolvedValueOnce([{ id: 'r1' }]);
      
      await reviewController.getReviewsForSwap(req, res, next);
      
      expect(mockReviewService.getReviewsForSwap).toHaveBeenCalledWith('swap-1', 'user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { reviews: [{ id: 'r1' }], count: 1 });
    });

    it('should catch error in getReviewsForSwap', async () => {
      mockReviewService.getReviewsForSwap.mockRejectedValueOnce(new Error('swap not found'));
      await reviewController.getReviewsForSwap(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 404, 'NOT_FOUND', expect.any(String));
    });
  });

  describe('#handleError Mapping', () => {
    it('should handle 409 conflict', async () => {
      req.body = { rating: 5 }; // rating required to reach service
      const err = new Error('conflict');
      err.statusCode = 409;
      mockReviewService.submitReview.mockRejectedValueOnce(err);
      await reviewController.submitReview(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 409, 'CONFLICT', 'conflict');
    });

    it('should handle 403 forbidden', async () => {
      const err = new Error('forbidden');
      err.statusCode = 403;
      mockReviewService.editReview.mockRejectedValueOnce(err);
      await reviewController.editReview(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 403, 'FORBIDDEN', 'forbidden');
    });

    it('should handle 400 bad request', async () => {
      const err = new Error('bad request');
      err.statusCode = 400;
      mockReviewService.editReview.mockRejectedValueOnce(err);
      await reviewController.editReview(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 400, 'BAD_REQUEST', 'bad request');
    });

    it('should catch error in flagReview', async () => {
      mockReviewService.flagReview.mockRejectedValueOnce(new Error('fail'));
      await reviewController.flagReview(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should catch error in submitReview', async () => {
      req.body = { rating: 5 };
      mockReviewService.submitReview.mockRejectedValueOnce(new Error('fail'));
      await reviewController.submitReview(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass unknown errors to next', async () => {
      const err = new Error('unknown');
      mockReviewService.editReview.mockRejectedValueOnce(err);
      await reviewController.editReview(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
