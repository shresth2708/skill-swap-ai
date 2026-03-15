const ReviewService = require('../services/review.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * ReviewController — HTTP handlers for review endpoints.
 */
class ReviewController {
  constructor() {
    const methods = Object.getOwnPropertyNames(ReviewController.prototype)
      .filter(m => m !== 'constructor');
    for (const m of methods) {
      if (typeof this[m] === 'function') {
        this[m] = this[m].bind(this);
      }
    }
  }

  /**
   * POST /api/swaps/:id/reviews
   * Submit a review for a completed swap.
   *
   * Body: {
   *   rating: number (1-5, required),
   *   comment?: string,
   *   isPublic?: boolean (default: true)
   * }
   */
  async submitReview(req, res, next) {
    try {
      const service = new ReviewService();
      const { rating, comment, isPublic } = req.body;

      if (!rating) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'rating is required');
      }

      const review = await service.submitReview(req.params.id, req.user.id, {
        rating: parseInt(rating, 10),
        comment,
        isPublic,
      });

      return sendSuccess(res, 201, 'Review submitted successfully', review);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * PUT /api/reviews/:id
   * Edit a review (owner only, within 24h).
   *
   * Body: { rating?: number, comment?: string }
   */
  async editReview(req, res, next) {
    try {
      const service = new ReviewService();
      const { rating, comment } = req.body;

      const review = await service.editReview(req.params.id, req.user.id, {
        rating: rating !== undefined ? parseInt(rating, 10) : undefined,
        comment,
      });

      return sendSuccess(res, 200, 'Review updated successfully', review);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/users/:id/reviews
   * Get public reviews for a user.
   *
   * Query params: page, limit
   */
  async getReviewsForUser(req, res, next) {
    try {
      const service = new ReviewService();
      const { page, limit } = req.query;

      const result = await service.getReviewsForUser(req.params.id, {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return sendSuccess(res, 200, 'Reviews retrieved', result);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps/:id/reviews
   * Get both reviews for a swap (participant only).
   */
  async getReviewsForSwap(req, res, next) {
    try {
      const service = new ReviewService();
      const reviews = await service.getReviewsForSwap(req.params.id, req.user.id);

      return sendSuccess(res, 200, 'Swap reviews retrieved', { reviews, count: reviews.length });
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/admin/reviews/:id/flag
   * Flag a review (admin only).
   */
  async flagReview(req, res, next) {
    try {
      const service = new ReviewService();
      const review = await service.flagReview(req.params.id, req.user.id);

      return sendSuccess(res, 200, 'Review flagged', review);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * Handle errors with appropriate status codes.
   */
  #handleError(error, res, next) {
    logger.error('ReviewController error:', error);

    const statusCode = error.statusCode || 500;

    if (statusCode === 409) {
      return sendError(res, 409, 'CONFLICT', error.message);
    }
    if (statusCode === 403) {
      return sendError(res, 403, 'FORBIDDEN', error.message);
    }
    if (statusCode === 400) {
      return sendError(res, 400, 'BAD_REQUEST', error.message);
    }
    if (error.message.includes('not found')) {
      return sendError(res, 404, 'NOT_FOUND', error.message);
    }

    next(error);
  }
}

module.exports = new ReviewController();
