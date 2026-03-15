const prisma = require('../config/db.config');

/**
 * SessionRepository — Encapsulates database queries for SwapSession model.
 *
 * Design:
 *   - SRP: Only handles DB operations for sessions
 *   - Idempotent queries for cron job safety
 */
class SessionRepository {
  /**
   * Default include for session queries.
   */
  #defaultInclude = {
    swap: {
      select: {
        id: true,
        status: true,
        initiatorId: true,
        receiverId: true,
        initiator: {
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
        receiver: {
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
      },
    },
  };

  /**
   * Create a new swap session.
   * @param {Object} data - Session creation payload
   * @returns {Promise<Object>}
   */
  async create(data) {
    return await prisma.swapSession.create({
      data: {
        swapId: data.swapId,
        scheduledAt: data.scheduledAt,
        durationMins: data.durationMins,
        meetingUrl: data.meetingUrl || null,
        notes: data.notes || null,
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find a session by ID.
   * @param {string} sessionId - UUID of the session
   * @returns {Promise<Object|null>}
   */
  async findById(sessionId) {
    return await prisma.swapSession.findUnique({
      where: { id: sessionId },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find a session by swap ID.
   * @param {string} swapId - UUID of the swap
   * @returns {Promise<Object|null>}
   */
  async findBySwapId(swapId) {
    return await prisma.swapSession.findUnique({
      where: { swapId },
      include: this.#defaultInclude,
    });
  }

  /**
   * Update a session.
   * @param {string} sessionId - UUID of the session
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>}
   */
  async update(sessionId, data) {
    return await prisma.swapSession.update({
      where: { id: sessionId },
      data,
      include: this.#defaultInclude,
    });
  }

  /**
   * Find upcoming sessions for a user within the next N days.
   * @param {string} userId - UUID of the user
   * @param {number} days - Number of days to look ahead
   * @returns {Promise<Array>}
   */
  async findUpcomingSessions(userId, days = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return await prisma.swapSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: now,
          lte: futureDate,
        },
        swap: {
          OR: [{ initiatorId: userId }, { receiverId: userId }],
        },
      },
      include: this.#defaultInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Find scheduled sessions for a user that conflict with a given time range.
   * @param {string} userId - UUID of the user
   * @param {Date} startTime - Start of the range
   * @param {Date} endTime - End of the range
   * @param {string} [excludeSessionId] - Optional session ID to exclude (for reschedule)
   * @returns {Promise<Array>}
   */
  async findConflictingSessions(userId, startTime, endTime, excludeSessionId = null) {
    const where = {
      status: 'SCHEDULED',
      swap: {
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      // Overlapping: session starts before our end AND ends after our start
      scheduledAt: {
        lt: endTime,
      },
    };

    if (excludeSessionId) {
      where.id = { not: excludeSessionId };
    }

    const sessions = await prisma.swapSession.findMany({
      where,
      include: this.#defaultInclude,
    });

    // Filter by actual overlap (considering duration)
    return sessions.filter((s) => {
      const sessionEnd = new Date(
        new Date(s.scheduledAt).getTime() + s.durationMins * 60 * 1000
      );
      return sessionEnd > startTime;
    });
  }

  /**
   * Find sessions needing 24h reminder.
   * Idempotent: Uses a narrow window to avoid duplicate reminders.
   * @returns {Promise<Array>}
   */
  async findSessionsForReminder24h() {
    const now = new Date();
    const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    return await prisma.swapSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: in23h,
          lte: in25h,
        },
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find sessions needing 1h reminder.
   * Idempotent: Uses a narrow window to avoid duplicate reminders.
   * @returns {Promise<Array>}
   */
  async findSessionsForReminder1h() {
    const now = new Date();
    const in30min = new Date(now.getTime() + 30 * 60 * 1000);
    const in90min = new Date(now.getTime() + 90 * 60 * 1000);

    return await prisma.swapSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: in30min,
          lte: in90min,
        },
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Find missed sessions (SCHEDULED sessions past their time + 30min buffer).
   * Idempotent: Only finds SCHEDULED sessions (already-MISSED won't match).
   * @returns {Promise<Array>}
   */
  async findMissedSessions() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    return await prisma.swapSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lt: thirtyMinAgo,
        },
      },
      include: this.#defaultInclude,
    });
  }

  /**
   * Batch update missed sessions.
   * Idempotent: Only updates SCHEDULED sessions.
   * @param {string[]} sessionIds - Array of session IDs to mark as missed
   * @returns {Promise<{count: number}>}
   */
  async markSessionsMissed(sessionIds) {
    return await prisma.swapSession.updateMany({
      where: {
        id: { in: sessionIds },
        status: 'SCHEDULED',
      },
      data: {
        status: 'MISSED',
      },
    });
  }

  /**
   * Create a completion confirmation record.
   * Uses upsert for idempotency.
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of the user confirming
   * @returns {Promise<Object>}
   */
  async createCompletionConfirmation(swapId, userId) {
    return await prisma.swapCompletionConfirmation.upsert({
      where: {
        swapId_userId: { swapId, userId },
      },
      update: {
        confirmedAt: new Date(),
      },
      create: {
        swapId,
        userId,
      },
    });
  }

  /**
   * Count completion confirmations for a swap.
   * @param {string} swapId - UUID of the swap
   * @returns {Promise<number>}
   */
  async countCompletionConfirmations(swapId) {
    return await prisma.swapCompletionConfirmation.count({
      where: { swapId },
    });
  }
}

module.exports = new SessionRepository();
