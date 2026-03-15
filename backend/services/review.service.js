const { SwapStatus } = require('../utils/swap-state-machine');
const { reviewEventEmitter } = require('../events/review.events');
const defaultReviewRepository = require('../repositories/review.repository');
const defaultSwapRepository = require('../repositories/swap.repository');
const defaultUserRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

/**
 * Max time (in hours) after review creation during which edits are allowed.
 */
const EDIT_WINDOW_HOURS = 24;

/**
 * ReviewService — Orchestrates review lifecycle and trust score calculation.
 *
 * Design:
 *   - SRP: Handles review business logic + trust score
 *   - DIP: Depends on repository abstractions
 *   - Observer: Emits review events
 */
class ReviewService {
  #reviewRepository;
  #swapRepository;
  #userRepository;
  #eventEmitter;

  constructor(
    reviewRepository = defaultReviewRepository,
    swapRepository = defaultSwapRepository,
    userRepository = defaultUserRepository,
    eventEmitter = reviewEventEmitter,
  ) {
    this.#reviewRepository = reviewRepository;
    this.#swapRepository = swapRepository;
    this.#userRepository = userRepository;
    this.#eventEmitter = eventEmitter;
  }

  /**
   * Submit a review for a completed swap.
   *
   * Validations:
   *   - Swap must be COMPLETED
   *   - Reviewer must be a participant
   *   - One review per person per swap (unique constraint)
   *   - Rating must be 1-5
   *
   * @param {string} swapId - UUID of the swap
   * @param {string} reviewerId - UUID of the reviewer
   * @param {Object} dto - Review data
   * @param {number} dto.rating - 1-5 star rating
   * @param {string} [dto.comment] - Optional comment
   * @param {boolean} [dto.isPublic] - Whether review is public (default: true)
   * @returns {Promise<Object>} - Created review
   */
  async submitReview(swapId, reviewerId, dto) {
    logger.info(`Submitting review for swap ${swapId} by user ${reviewerId}`);

    // Validate swap exists and is completed
    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    if (swap.status !== SwapStatus.COMPLETED) {
      const error = new Error('Can only review completed swaps');
      error.statusCode = 400;
      throw error;
    }

    // Verify reviewer is a participant
    if (swap.initiatorId !== reviewerId && swap.receiverId !== reviewerId) {
      const error = new Error('User is not a participant in this swap');
      error.statusCode = 403;
      throw error;
    }

    // Determine reviewee (the other party)
    const revieweeId = swap.initiatorId === reviewerId
      ? swap.receiverId
      : swap.initiatorId;

    // Validate rating
    if (!dto.rating || dto.rating < 1 || dto.rating > 5) {
      const error = new Error('Rating must be between 1 and 5');
      error.statusCode = 400;
      throw error;
    }

    // Check for duplicate review (unique constraint)
    const existingReview = await this.#reviewRepository.findBySwapAndReviewer(swapId, reviewerId);
    if (existingReview) {
      const error = new Error('You have already reviewed this swap');
      error.statusCode = 409;
      throw error;
    }

    // Create review
    const review = await this.#reviewRepository.create({
      swapId,
      reviewerId,
      revieweeId,
      rating: dto.rating,
      comment: dto.comment,
      isPublic: dto.isPublic,
    });

    // Recalculate user rating ASYNC (fire and forget — don't block response)
    this.#recalculateUserRatingAsync(revieweeId);

    // Emit event
    this.#eventEmitter.emitReviewReceived(review, review.reviewer, review.reviewee);

    logger.info(`Review ${review.id} created for swap ${swapId}`);
    return review;
  }

  /**
   * Edit a review (only within 24h of creation).
   *
   * @param {string} reviewId - UUID of the review
   * @param {string} userId - UUID of the user editing
   * @param {Object} dto - Fields to update
   * @param {number} [dto.rating] - Updated rating
   * @param {string} [dto.comment] - Updated comment
   * @returns {Promise<Object>} - Updated review
   */
  async editReview(reviewId, userId, dto) {
    logger.info(`Editing review ${reviewId} by user ${userId}`);

    const review = await this.#reviewRepository.findById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Verify ownership
    if (review.reviewerId !== userId) {
      const error = new Error('You can only edit your own reviews');
      error.statusCode = 403;
      throw error;
    }

    // Verify within 24h edit window
    const hoursSinceCreation = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > EDIT_WINDOW_HOURS) {
      const error = new Error('Reviews can only be edited within 24 hours of creation');
      error.statusCode = 400;
      throw error;
    }

    // Build update data
    const updateData = {};
    if (dto.rating !== undefined) {
      if (dto.rating < 1 || dto.rating > 5) {
        const error = new Error('Rating must be between 1 and 5');
        error.statusCode = 400;
        throw error;
      }
      updateData.rating = dto.rating;
    }
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }

    const updatedReview = await this.#reviewRepository.update(reviewId, updateData);

    // Recalculate if rating changed
    if (dto.rating !== undefined) {
      this.#recalculateUserRatingAsync(review.revieweeId);
    }

    this.#eventEmitter.emitReviewUpdated(updatedReview, updatedReview.reviewer);

    logger.info(`Review ${reviewId} updated`);
    return updatedReview;
  }

  /**
   * Flag a review as inappropriate (admin only).
   * Flagged reviews are excluded from avgRating calculation.
   *
   * @param {string} reviewId - UUID of the review
   * @param {string} adminId - UUID of the admin flagging
   * @returns {Promise<Object>} - Updated review
   */
  async flagReview(reviewId, adminId) {
    logger.info(`Flagging review ${reviewId} by admin ${adminId}`);

    const review = await this.#reviewRepository.findById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    const updatedReview = await this.#reviewRepository.update(reviewId, {
      isFlagged: true,
    });

    // Recalculate since flagged reviews are excluded
    this.#recalculateUserRatingAsync(review.revieweeId);

    this.#eventEmitter.emitReviewFlagged(updatedReview, adminId);

    logger.info(`Review ${reviewId} flagged`);
    return updatedReview;
  }

  /**
   * Get public reviews for a user with pagination.
   *
   * @param {string} userId - UUID of the user
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Paginated reviews with avgRating
   */
  async getReviewsForUser(userId, pagination = {}) {
    return await this.#reviewRepository.findReviewsForUser(userId, pagination);
  }

  /**
   * Get both reviews for a specific swap.
   *
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of requesting user (must be participant)
   * @returns {Promise<Array>} - Array of reviews for the swap
   */
  async getReviewsForSwap(swapId, userId) {
    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    if (swap.initiatorId !== userId && swap.receiverId !== userId) {
      const error = new Error('User is not a participant in this swap');
      error.statusCode = 403;
      throw error;
    }

    return await this.#reviewRepository.findReviewsForSwap(swapId);
  }

  /**
   * Recalculate and update user rating + trust score.
   * Called synchronously for testing, but invoked async in production paths.
   *
   * @param {string} userId - UUID of the user
   * @returns {Promise<void>}
   */
  async recalculateUserRating(userId) {
    logger.info(`Recalculating rating for user ${userId}`);

    // Get average rating from non-flagged reviews
    const { avgRating, totalReviews } = await this.#reviewRepository.calculateUserRating(userId);

    // Get swap stats for trust score
    const stats = await this.#reviewRepository.getUserSwapStats(userId);

    // Calculate trust score components
    const ratingComponent = (avgRating / 5) * 0.50; // Normalize to 0-1, weight 50%
    const completionRate = stats.totalSwaps > 0
      ? (stats.completedSwaps / stats.totalSwaps) * 0.30 // weight 30%
      : 0;
    const responseRate = stats.totalIncoming > 0
      ? (stats.respondedIn24h / stats.totalIncoming) * 0.20 // weight 20%
      : 0;

    const trustScore = Math.round((ratingComponent + completionRate + responseRate) * 10000) / 10000;

    // Update user
    await this.#reviewRepository.updateUserRatingAndTrust(
      userId,
      Math.round(avgRating * 100) / 100,
      totalReviews,
      trustScore
    );

    logger.info(`User ${userId} rating updated: avg=${avgRating}, trust=${trustScore}`);
  }

  /**
   * Fire-and-forget async recalculation (don't block the response).
   * @param {string} userId
   * @private
   */
  #recalculateUserRatingAsync(userId) {
    this.recalculateUserRating(userId).catch((error) => {
      logger.error(`Failed to recalculate rating for user ${userId}:`, error);
    });
  }
}

module.exports = ReviewService;
