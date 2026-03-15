const { SwapStatus, validateTransition, SwapStateError } = require('../utils/swap-state-machine');
const { sessionEventEmitter } = require('../events/session.events');
const defaultSessionRepository = require('../repositories/session.repository');
const defaultSwapRepository = require('../repositories/swap.repository');
const defaultUserRepository = require('../repositories/user.repository');
const logger = require('../utils/logger');

/**
 * Max number of reschedules allowed per session.
 */
const MAX_RESCHEDULES = 2;

/**
 * Default session duration in minutes.
 */
const DEFAULT_DURATION_MINS = 60;

/**
 * SessionService — Orchestrates session scheduling and lifecycle.
 *
 * Design:
 *   - SRP: Handles only session business logic
 *   - DIP: Depends on repository abstractions
 *   - Observer: Emits session events for notifications
 */
class SessionService {
  #sessionRepository;
  #swapRepository;
  #userRepository;
  #eventEmitter;

  /**
   * @param {Object} [sessionRepository]
   * @param {Object} [swapRepository]
   * @param {Object} [userRepository]
   * @param {Object} [eventEmitter]
   */
  constructor(
    sessionRepository = defaultSessionRepository,
    swapRepository = defaultSwapRepository,
    userRepository = defaultUserRepository,
    eventEmitter = sessionEventEmitter,
  ) {
    this.#sessionRepository = sessionRepository;
    this.#swapRepository = swapRepository;
    this.#userRepository = userRepository;
    this.#eventEmitter = eventEmitter;
  }

  /**
   * Schedule a session for an accepted swap.
   *
   * Validations:
   *   - Swap must be in ACCEPTED status
   *   - User must be a participant
   *   - scheduledAt must be in the future
   *   - scheduledAt must fall within user availability slots
   *   - No time conflict with other SCHEDULED sessions for either user
   *
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of the user scheduling
   * @param {Object} dto - Session scheduling data
   * @param {Date|string} dto.scheduledAt - When to schedule
   * @param {number} [dto.durationMins] - Duration in minutes (default: 60)
   * @param {string} [dto.notes] - Optional notes
   * @returns {Promise<Object>} - Created session
   */
  async scheduleSession(swapId, userId, dto) {
    logger.info(`Scheduling session for swap ${swapId} by user ${userId}`);

    // Validate swap exists and is in ACCEPTED state
    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    this.#verifyParticipant(swap, userId);

    if (swap.status !== SwapStatus.ACCEPTED) {
      throw new SwapStateError(
        swap.status,
        SwapStatus.IN_PROGRESS,
        'Swap must be in ACCEPTED state to schedule a session'
      );
    }

    // Check if session already exists for this swap
    const existingSession = await this.#sessionRepository.findBySwapId(swapId);
    if (existingSession) {
      throw new Error('A session already exists for this swap');
    }

    // Validate scheduledAt is in the future
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const durationMins = dto.durationMins || DEFAULT_DURATION_MINS;
    const sessionEnd = new Date(scheduledAt.getTime() + durationMins * 60 * 1000);

    // Validate within user availability slots
    await this.#validateAvailability(swap.initiatorId, scheduledAt);
    await this.#validateAvailability(swap.receiverId, scheduledAt);

    // Check for time conflicts for both users
    await this.#checkConflicts(swap.initiatorId, scheduledAt, sessionEnd);
    await this.#checkConflicts(swap.receiverId, scheduledAt, sessionEnd);

    // Generate meeting URL
    const meetingUrl = this.#generateMeetingUrl(swapId);

    // Create session
    const session = await this.#sessionRepository.create({
      swapId,
      scheduledAt,
      durationMins,
      meetingUrl,
      notes: dto.notes,
    });

    // Transition swap to IN_PROGRESS
    validateTransition(swap.status, SwapStatus.IN_PROGRESS);
    await this.#swapRepository.update(swapId, {
      status: SwapStatus.IN_PROGRESS,
      scheduledAt,
    });

    // Emit event
    this.#eventEmitter.emitSessionScheduled(session, swap, swap.initiator, swap.receiver);

    logger.info(`Session ${session.id} scheduled for swap ${swapId}`);
    return session;
  }

  /**
   * Reschedule an existing session.
   *
   * Validations:
   *   - Max 2 reschedules allowed
   *   - New time must be in the future
   *   - No time conflicts
   *
   * @param {string} sessionId - UUID of the session
   * @param {string} userId - UUID of the user rescheduling
   * @param {Date|string} newTime - New scheduled time
   * @returns {Promise<Object>} - Updated session
   */
  async rescheduleSession(sessionId, userId, newTime) {
    logger.info(`Rescheduling session ${sessionId} by user ${userId}`);

    const session = await this.#sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const swap = session.swap;
    this.#verifyParticipant(swap, userId);

    if (session.status !== 'SCHEDULED') {
      throw new Error('Only SCHEDULED sessions can be rescheduled');
    }

    // Check reschedule limit
    if (session.rescheduledCount >= MAX_RESCHEDULES) {
      throw new Error(`Maximum reschedules (${MAX_RESCHEDULES}) reached. Cannot reschedule again.`);
    }

    // Validate new time is in the future
    const scheduledAt = new Date(newTime);
    if (scheduledAt <= new Date()) {
      throw new Error('New scheduled time must be in the future');
    }

    const sessionEnd = new Date(scheduledAt.getTime() + session.durationMins * 60 * 1000);

    // Check for time conflicts (exclude current session)
    await this.#checkConflicts(swap.initiatorId, scheduledAt, sessionEnd, sessionId);
    await this.#checkConflicts(swap.receiverId, scheduledAt, sessionEnd, sessionId);

    // Update session
    const updatedSession = await this.#sessionRepository.update(sessionId, {
      scheduledAt,
      rescheduledCount: session.rescheduledCount + 1,
    });

    // Update swap scheduledAt
    await this.#swapRepository.update(swap.id, {
      scheduledAt,
    });

    // Emit event
    this.#eventEmitter.emitSessionRescheduled(
      updatedSession,
      swap,
      swap.initiator,
      swap.receiver,
      userId
    );

    logger.info(`Session ${sessionId} rescheduled (count: ${updatedSession.rescheduledCount})`);
    return updatedSession;
  }

  /**
   * Complete a session and confirm swap completion for a user.
   * Delegates to SwapService completion logic.
   *
   * @param {string} sessionId - UUID of the session
   * @param {string} userId - UUID of the user confirming
   * @returns {Promise<Object>} - Updated session/swap state
   */
  async completeSession(sessionId, userId) {
    logger.info(`Completing session ${sessionId} by user ${userId}`);

    const session = await this.#sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const swap = session.swap;
    this.#verifyParticipant(swap, userId);

    // Create completion confirmation (idempotent via upsert)
    await this.#sessionRepository.createCompletionConfirmation(swap.id, userId);

    // Count confirmations
    const confirmCount = await this.#sessionRepository.countCompletionConfirmations(swap.id);

    if (confirmCount >= 2) {
      // Both confirmed — complete swap and session
      const fullSwap = await this.#swapRepository.findById(swap.id);

      if (fullSwap.status === SwapStatus.IN_PROGRESS) {
        validateTransition(fullSwap.status, SwapStatus.COMPLETED);
        await this.#swapRepository.update(swap.id, {
          status: SwapStatus.COMPLETED,
          completedAt: new Date(),
          initiatorConfirmed: true,
          receiverConfirmed: true,
        });
      }

      // Update session status
      const updatedSession = await this.#sessionRepository.update(sessionId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      this.#eventEmitter.emitSessionCompleted(updatedSession, swap);

      logger.info(`Session ${sessionId} completed by both parties`);
      return { session: updatedSession, bothConfirmed: true, confirmCount };
    }

    logger.info(`Session ${sessionId} completion confirmed by ${userId}, waiting for other party`);
    return { session, bothConfirmed: false, confirmCount };
  }

  /**
   * Get upcoming sessions for a user (next 7 days).
   *
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>}
   */
  async getUpcomingSessions(userId) {
    return await this.#sessionRepository.findUpcomingSessions(userId, 7);
  }

  /**
   * Get a session by ID.
   *
   * @param {string} sessionId - UUID of the session
   * @returns {Promise<Object>}
   */
  async getSessionById(sessionId) {
    const session = await this.#sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify that a user is a participant in the swap.
   * @param {Object} swap - Swap object
   * @param {string} userId - UUID to verify
   */
  #verifyParticipant(swap, userId) {
    if (swap.initiatorId !== userId && swap.receiverId !== userId) {
      throw new Error('User is not a participant in this swap');
    }
  }

  /**
   * Validate that scheduledAt falls within user's availability slots.
   * @param {string} userId - UUID of the user
   * @param {Date} scheduledAt - Proposed time
   */
  async #validateAvailability(userId, scheduledAt) {
    const user = await this.#userRepository.findWithSkillsAndAvailability(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If user has no availability slots defined, allow any time
    if (!user.availabilitySlots || user.availabilitySlots.length === 0) {
      return;
    }

    const dayOfWeek = scheduledAt.getDay(); // 0-6
    const timeStr = scheduledAt.toTimeString().slice(0, 5); // HH:MM

    const matchingSlot = user.availabilitySlots.find((slot) => {
      if (slot.dayOfWeek !== dayOfWeek) return false;

      const slotStart = new Date(slot.slotStart).toTimeString().slice(0, 5);
      const slotEnd = new Date(slot.slotEnd).toTimeString().slice(0, 5);

      return timeStr >= slotStart && timeStr <= slotEnd;
    });

    if (!matchingSlot) {
      throw new Error(
        `Scheduled time is outside availability for user ${userId}`
      );
    }
  }

  /**
   * Check for time conflicts with existing sessions.
   * @param {string} userId - UUID of the user
   * @param {Date} startTime - Session start
   * @param {Date} endTime - Session end
   * @param {string} [excludeSessionId] - Session to exclude (for reschedule)
   */
  async #checkConflicts(userId, startTime, endTime, excludeSessionId = null) {
    const conflicts = await this.#sessionRepository.findConflictingSessions(
      userId,
      startTime,
      endTime,
      excludeSessionId
    );

    if (conflicts.length > 0) {
      throw new Error(
        `Time conflict: User ${userId} already has a session scheduled during this time`
      );
    }
  }

  /**
   * Generate a meeting URL for a swap session.
   * Stub implementation — in production, integrate with Zoom/Google Meet/etc.
   * @param {string} swapId - UUID of the swap
   * @returns {string}
   */
  #generateMeetingUrl(swapId) {
    return `https://meet.skillswap.ai/${swapId}`;
  }
}

module.exports = SessionService;
