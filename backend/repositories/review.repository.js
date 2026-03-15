const prisma = require('../config/db.config');

/**
 * ReviewRepository — Database operations for Review model.
 */
class ReviewRepository {
  #defaultInclude = {
    reviewer: {
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    },
    reviewee: {
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    },
    swap: {
      select: {
        id: true,
        status: true,
        offeredSkill: { select: { skill: { select: { name: true } } } },
        requestedSkill: { select: { skill: { select: { name: true } } } },
      },
    },
  };

  /**
   * Create a review.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    return await prisma.review.create({
      data: {
        swapId: data.swapId,
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        rating: data.rating,
        comment: data.comment || null,
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find a review by ID.
   * @param {string} reviewId
   * @returns {Promise<Object|null>}
   */
  async findById(reviewId) {
    return await prisma.review.findUnique({
      where: { id: reviewId },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find a review by swap and reviewer (unique constraint check).
   * @param {string} swapId
   * @param {string} reviewerId
   * @returns {Promise<Object|null>}
   */
  async findBySwapAndReviewer(swapId, reviewerId) {
    return await prisma.review.findUnique({
      where: {
        swapId_reviewerId: { swapId, reviewerId },
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Update a review.
   * @param {string} reviewId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(reviewId, data) {
    return await prisma.review.update({
      where: { id: reviewId },
      data,
      include: this.#defaultInclude,
    });
  }

  /**
   * Get reviews for a user (as reviewee) with pagination.
   * Only returns public, non-flagged reviews.
   * @param {string} userId
   * @param {Object} options
   * @returns {Promise<{data: Array, total: number, avgRating: number}>}
   */
  async findReviewsForUser(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      revieweeId: userId,
      isPublic: true,
      isFlagged: false,
    };

    const [data, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        include: this.#defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      avgRating: aggregate._avg.rating || 0,
    };
  }

  /**
   * Get both reviews for a specific swap.
   * @param {string} swapId
   * @returns {Promise<Array>}
   */
  async findReviewsForSwap(swapId) {
    return await prisma.review.findMany({
      where: { swapId },
      include: this.#defaultInclude,
    });
  }

  /**
   * Calculate average rating for a user from non-flagged reviews.
   * @param {string} userId
   * @returns {Promise<{avgRating: number, totalReviews: number}>}
   */
  async calculateUserRating(userId) {
    const result = await prisma.review.aggregate({
      where: {
        revieweeId: userId,
        isFlagged: false,
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    return {
      avgRating: result._avg.rating || 0,
      totalReviews: result._count.id,
    };
  }

  /**
   * Update user's avgRating, totalReviews, and trustScore.
   * @param {string} userId
   * @param {number} avgRating
   * @param {number} totalReviews
   * @param {number} trustScore
   * @returns {Promise<Object>}
   */
  async updateUserRatingAndTrust(userId, avgRating, totalReviews, trustScore) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        avgRating,
        totalReviews,
        trustScore,
      },
    });
  }

  /**
   * Get swap statistics needed for trust score calculation.
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getUserSwapStats(userId) {
    const [totalSwaps, completedSwaps, totalIncoming, respondedIn24h] = await Promise.all([
      // Total swaps user participated in
      prisma.swap.count({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: { not: 'PENDING' },
        },
      }),
      // Completed swaps
      prisma.swap.count({
        where: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
          status: 'COMPLETED',
        },
      }),
      // Total incoming swap requests (where user is receiver)
      prisma.swap.count({
        where: { receiverId: userId },
      }),
      // Swaps where receiver responded (accepted/declined) within 24h
      // This is approximated by checking if status changed from PENDING
      // and updatedAt - createdAt < 24h
      prisma.swap.count({
        where: {
          receiverId: userId,
          status: { in: ['ACCEPTED', 'CANCELLED'] },
        },
      }),
    ]);

    return {
      totalSwaps,
      completedSwaps,
      totalIncoming,
      respondedIn24h,
    };
  }
}

module.exports = new ReviewRepository();
