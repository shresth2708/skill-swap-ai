const prisma = require('../config/db.config');
const { SwapStatus, isActiveState } = require('../utils/swap-state-machine');

/**
 * SwapRepository — Encapsulates database queries for the Swap model.
 * 
 * Design:
 *   - SRP: Only handles DB operations for swaps
 *   - Uses select with specific columns for performance
 *   - Relies on DB indexes: swaps(initiator_id), swaps(receiver_id), swaps(status)
 */
class SwapRepository {
  /**
   * Default include for swap queries - includes related entities.
   */
  #defaultInclude = {
    match: {
      select: {
        id: true,
        compatibilityScore: true,
        status: true,
      },
    },
    initiator: {
      select: {
        id: true,
        email: true,
        avgRating: true,
        totalSwaps: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            location: true,
          },
        },
      },
    },
    receiver: {
      select: {
        id: true,
        email: true,
        avgRating: true,
        totalSwaps: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            location: true,
          },
        },
      },
    },
    offeredSkill: {
      select: {
        id: true,
        proficiencyLevel: true,
        skill: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    },
    requestedSkill: {
      select: {
        id: true,
        proficiencyLevel: true,
        skill: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    },
  };

  /**
   * Create a new swap record.
   * @param {Object} data - Swap creation payload
   * @returns {Promise<Object>} Created swap with relations
   */
  async create(data) {
    return await prisma.swap.create({
      data: {
        matchId: data.matchId,
        initiatorId: data.initiatorId,
        receiverId: data.receiverId,
        offeredSkillId: data.offeredSkillId,
        requestedSkillId: data.requestedSkillId,
        status: SwapStatus.PENDING,
        terms: data.terms || null,
        scheduledAt: data.scheduledAt || null,
        expiresAt: data.expiresAt,
        initiatorConfirmed: false,
        receiverConfirmed: false,
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find a swap by its ID with full relations.
   * @param {string} swapId - UUID of the swap
   * @returns {Promise<Object|null>}
   */
  async findById(swapId) {
    return await prisma.swap.findUnique({
      where: { id: swapId },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find swaps where user is either initiator or receiver.
   * @param {string} userId - UUID of the user
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, { status, limit = 50 } = {}) {
    const where = {
      OR: [{ initiatorId: userId }, { receiverId: userId }],
    };

    if (status) {
      where.status = status;
    }

    return await prisma.swap.findMany({
      where,
      include: this.#defaultInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update a swap with arbitrary fields.
   * @param {string} swapId - UUID of the swap
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>}
   */
  async update(swapId, data) {
    return await prisma.swap.update({
      where: { id: swapId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find active swaps (ACCEPTED + IN_PROGRESS) for a user.
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>}
   */
  async findActiveSwaps(userId) {
    return await prisma.swap.findMany({
      where: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
        status: {
          in: [SwapStatus.ACCEPTED, SwapStatus.IN_PROGRESS],
        },
      },
      include: this.#defaultInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get paginated swap history for a user.
   * @param {string} userId - UUID of the user
   * @param {Object} filters - Filter options
   * @returns {Promise<{data: Array, total: number}>}
   */
  async findSwapHistory(userId, { status, fromDate, toDate, page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ initiatorId: userId }, { receiverId: userId }],
    };

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      prisma.swap.findMany({
        where,
        include: this.#defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.swap.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find all expired pending swaps.
   * @returns {Promise<Array>}
   */
  async findExpiredPendingSwaps() {
    return await prisma.swap.findMany({
      where: {
        status: SwapStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Bulk expire pending swaps.
   * @param {string[]} swapIds - Array of swap IDs to expire
   * @returns {Promise<{count: number}>}
   */
  async expireSwaps(swapIds) {
    return await prisma.swap.updateMany({
      where: {
        id: { in: swapIds },
        status: SwapStatus.PENDING,
      },
      data: {
        status: SwapStatus.EXPIRED,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Check if a swap exists between match participants.
   * Prevents duplicate swaps for the same match.
   * @param {string} matchId - UUID of the match
   * @param {string[]} activeStatuses - Statuses to consider as "active"
   * @returns {Promise<Object|null>}
   */
  async findExistingSwapForMatch(matchId, activeStatuses = [SwapStatus.PENDING, SwapStatus.ACCEPTED, SwapStatus.IN_PROGRESS]) {
    return await prisma.swap.findFirst({
      where: {
        matchId,
        status: { in: activeStatuses },
      },
    });
  }

  /**
   * Get swap statistics for a user.
   * @param {string} userId - UUID of the user
   * @returns {Promise<Object>}
   */
  async getSwapStats(userId) {
    const whereBase = {
      OR: [{ initiatorId: userId }, { receiverId: userId }],
    };

    const [total, pending, completed, cancelled] = await Promise.all([
      prisma.swap.count({ where: whereBase }),
      prisma.swap.count({ where: { ...whereBase, status: SwapStatus.PENDING } }),
      prisma.swap.count({ where: { ...whereBase, status: SwapStatus.COMPLETED } }),
      prisma.swap.count({ where: { ...whereBase, status: SwapStatus.CANCELLED } }),
    ]);

    return { total, pending, completed, cancelled };
  }

  /**
   * Increment totalSwaps for both users in a transaction.
   * @param {string} initiatorId - UUID of initiator
   * @param {string} receiverId - UUID of receiver
   * @returns {Promise<void>}
   */
  async incrementUserSwapCounts(initiatorId, receiverId) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: initiatorId },
        data: { totalSwaps: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: receiverId },
        data: { totalSwaps: { increment: 1 } },
      }),
    ]);
  }
}

module.exports = new SwapRepository();
