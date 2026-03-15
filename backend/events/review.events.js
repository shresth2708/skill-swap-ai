const EventEmitter = require('events');

/**
 * Review event types.
 */
const ReviewEvents = Object.freeze({
  REVIEW_RECEIVED: 'review:received',
  REVIEW_UPDATED: 'review:updated',
  REVIEW_FLAGGED: 'review:flagged',
});

/**
 * ReviewEventEmitter — Observer pattern for review lifecycle events.
 */
class ReviewEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Emit REVIEW_RECEIVED event.
   * @param {Object} review - The review object
   * @param {Object} reviewer - User who left the review
   * @param {Object} reviewee - User being reviewed
   */
  emitReviewReceived(review, reviewer, reviewee) {
    this.emit(ReviewEvents.REVIEW_RECEIVED, {
      event: ReviewEvents.REVIEW_RECEIVED,
      review,
      reviewer,
      reviewee,
      message: `${reviewer.profile?.displayName || reviewer.email} left you a ${review.rating}-star review`,
      notifyUserId: reviewee.id,
      timestamp: new Date(),
    });
  }

  /**
   * Emit REVIEW_UPDATED event.
   * @param {Object} review - The updated review
   * @param {Object} reviewer - User who updated
   */
  emitReviewUpdated(review, reviewer) {
    this.emit(ReviewEvents.REVIEW_UPDATED, {
      event: ReviewEvents.REVIEW_UPDATED,
      review,
      reviewer,
      message: 'A review has been updated',
      timestamp: new Date(),
    });
  }

  /**
   * Emit REVIEW_FLAGGED event.
   * @param {Object} review - The flagged review
   * @param {string} adminId - Admin who flagged
   */
  emitReviewFlagged(review, adminId) {
    this.emit(ReviewEvents.REVIEW_FLAGGED, {
      event: ReviewEvents.REVIEW_FLAGGED,
      review,
      adminId,
      message: 'A review has been flagged by an admin',
      timestamp: new Date(),
    });
  }
}

// Singleton
const reviewEventEmitter = new ReviewEventEmitter();

module.exports = {
  ReviewEvents,
  ReviewEventEmitter,
  reviewEventEmitter,
};
