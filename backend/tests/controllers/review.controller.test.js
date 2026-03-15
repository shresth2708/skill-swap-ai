const reviewController = require('../../controllers/review.controller');
const ReviewService = require('../../services/review.service');

jest.mock('../../services/review.service');

describe('ReviewController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
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

  describe('submitReview', () => {
    it('returns 400 if missing rating', async () => {
      await reviewController.submitReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('success path', async () => {
      req.body = { rating: 5, comment: 'great' };
      const mockService = { submitReview: jest.fn().mockResolvedValue({}) };
      ReviewService.mockImplementation(() => mockService);
      await reviewController.submitReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('error handling branches in #handleError', () => {
    it('handles Conflict (409)', async () => {
      req.body = { rating: 5 };
      const err = new Error('already reviewed');
      err.statusCode = 409;
      ReviewService.mockImplementation(() => ({
          submitReview: jest.fn().mockRejectedValue(err)
      }));
      await reviewController.submitReview(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('handles Forbidden (403)', async () => {
        req.body = { rating: 5 };
        const err = new Error('not participant');
        err.statusCode = 403;
        ReviewService.mockImplementation(() => ({
            submitReview: jest.fn().mockRejectedValue(err)
        }));
        await reviewController.submitReview(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('handles BadRequest (400) via statusCode', async () => {
        req.body = { rating: 5 };
        const err = new Error('bad input');
        err.statusCode = 400;
        ReviewService.mockImplementation(() => ({
            submitReview: jest.fn().mockRejectedValue(err)
        }));
        await reviewController.submitReview(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles "not found" via message', async () => {
        req.body = { rating: 5 };
        ReviewService.mockImplementation(() => ({
            submitReview: jest.fn().mockRejectedValue(new Error('swap not found'))
        }));
        await reviewController.submitReview(req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('passes generic 500 to next', async () => {
        req.body = { rating: 5 };
        ReviewService.mockImplementation(() => ({
            submitReview: jest.fn().mockRejectedValue(new Error('kaboom'))
        }));
        await reviewController.submitReview(req, res, next);
        expect(next).toHaveBeenCalled();
    });
  });

  describe('other methods', () => {
      it('editReview success', async () => {
          req.body = { rating: 4 };
          ReviewService.mockImplementation(() => ({ editReview: jest.fn().mockResolvedValue({}) }));
          await reviewController.editReview(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getReviewsForUser success', async () => {
          req.query = { page: '1' };
          ReviewService.mockImplementation(() => ({ getReviewsForUser: jest.fn().mockResolvedValue({}) }));
          await reviewController.getReviewsForUser(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getReviewsForSwap success', async () => {
          ReviewService.mockImplementation(() => ({ getReviewsForSwap: jest.fn().mockResolvedValue([]) }));
          await reviewController.getReviewsForSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('flagReview success', async () => {
          ReviewService.mockImplementation(() => ({ flagReview: jest.fn().mockResolvedValue({}) }));
          await reviewController.flagReview(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
  });
});
