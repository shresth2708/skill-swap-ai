const SwapService = require('../services/swap.service');
const SessionService = require('../services/session.service');
const { SwapStateError } = require('../utils/swap-state-machine');
const { sendSuccess, sendError } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * SwapController — HTTP handlers for swap + session lifecycle endpoints.
 *
 * Design:
 *   - Creates a fresh Service per request (testability)
 *   - Delegates business logic to SwapService / SessionService
 *   - Handles error mapping (SwapStateError -> 400)
 */
class SwapController {
  constructor() {
    const methods = Object.getOwnPropertyNames(SwapController.prototype)
      .filter(m => m !== 'constructor');
    for (const m of methods) {
      if (typeof this[m] === 'function') {
        this[m] = this[m].bind(this);
      }
    }
  }

  /**
   * POST /api/swaps
   * Create a new swap request from an existing match.
   *
   * Body: {
   *   matchId: string (required),
   *   offeredSkillId: string (required),
   *   requestedSkillId: string (required),
   *   terms?: string,
   *   scheduledAt?: ISO date string
   * }
   */
  async createSwap(req, res, next) {
    try {
      const service = new SwapService();
      const { matchId, offeredSkillId, requestedSkillId, terms, scheduledAt } = req.body;

      if (!matchId || !offeredSkillId || !requestedSkillId) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'matchId, offeredSkillId, and requestedSkillId are required');
      }

      const swap = await service.createSwap(matchId, req.user.id, {
        offeredSkillId,
        requestedSkillId,
        terms,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      });

      return sendSuccess(res, 201, 'Swap request created successfully', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/accept
   * Accept a pending swap request. Only the receiver can accept.
   */
  async acceptSwap(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.acceptSwap(req.params.id, req.user.id);

      return sendSuccess(res, 200, 'Swap accepted successfully', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/decline
   * Decline a pending swap request. Only the receiver can decline.
   *
   * Body: { reason?: string }
   */
  async declineSwap(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.declineSwap(req.params.id, req.user.id, req.body.reason);

      return sendSuccess(res, 200, 'Swap declined successfully', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/start
   * Start the swap session (transition to IN_PROGRESS).
   * Either participant can start.
   */
  async startSwap(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.startSwap(req.params.id, req.user.id);

      return sendSuccess(res, 200, 'Swap session started', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/complete
   * Mark swap as complete. Both users must confirm.
   */
  async completeSwap(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.completeSwap(req.params.id, req.user.id);

      const message = swap.status === 'COMPLETED'
        ? 'Swap completed successfully'
        : 'Completion confirmed, waiting for other participant';

      return sendSuccess(res, 200, message, swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/cancel
   * Cancel an active swap. Either participant can cancel.
   *
   * Body: { reason?: string }
   */
  async cancelSwap(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.cancelSwap(req.params.id, req.user.id, req.body.reason);

      return sendSuccess(res, 200, 'Swap cancelled', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps/:id
   * Get details of a specific swap. User must be a participant.
   */
  async getSwapById(req, res, next) {
    try {
      const service = new SwapService();
      const swap = await service.getSwapById(req.params.id, req.user.id);

      return sendSuccess(res, 200, 'Swap retrieved successfully', swap);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps/active
   * Get all active swaps (ACCEPTED + IN_PROGRESS) for the user.
   */
  async getActiveSwaps(req, res, next) {
    try {
      const service = new SwapService();
      const swaps = await service.getActiveSwaps(req.user.id);

      return sendSuccess(res, 200, 'Active swaps retrieved', { swaps, count: swaps.length });
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps
   * Get paginated swap history for the user.
   *
   * Query params:
   *   - status: filter by status
   *   - fromDate: filter from date (ISO string)
   *   - toDate: filter to date (ISO string)
   *   - page: page number (default 1)
   *   - limit: items per page (default 20)
   */
  async getSwapHistory(req, res, next) {
    try {
      const service = new SwapService();
      const { status, fromDate, toDate, page, limit } = req.query;

      const result = await service.getSwapHistory(req.user.id, {
        status,
        fromDate,
        toDate,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return sendSuccess(res, 200, 'Swap history retrieved', result);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps/stats
   * Get swap statistics for the user.
   */
  async getSwapStats(req, res, next) {
    try {
      const service = new SwapService();
      const stats = await service.getSwapStats(req.user.id);

      return sendSuccess(res, 200, 'Swap stats retrieved', stats);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/swaps/:id/sessions
   * Schedule a session for an accepted swap.
   *
   * Body: {
   *   scheduledAt: ISO date string (required),
   *   durationMins?: number (default: 60),
   *   notes?: string
   * }
   */
  async scheduleSession(req, res, next) {
    try {
      const sessionService = new SessionService();
      const { scheduledAt, durationMins, notes } = req.body;

      if (!scheduledAt) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'scheduledAt is required');
      }

      const session = await sessionService.scheduleSession(req.params.id, req.user.id, {
        scheduledAt: new Date(scheduledAt),
        durationMins,
        notes,
      });

      return sendSuccess(res, 201, 'Session scheduled successfully', session);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * PUT /api/swaps/:id/sessions/:sid/reschedule
   * Reschedule an existing session. Max 2 reschedules allowed.
   *
   * Body: { scheduledAt: ISO date string (required) }
   */
  async rescheduleSession(req, res, next) {
    try {
      const sessionService = new SessionService();
      const { scheduledAt } = req.body;

      if (!scheduledAt) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'scheduledAt is required');
      }

      const session = await sessionService.rescheduleSession(
        req.params.sid,
        req.user.id,
        new Date(scheduledAt)
      );

      return sendSuccess(res, 200, 'Session rescheduled successfully', session);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * POST /api/swaps/:id/complete-confirm
   * Confirm session/swap completion. Both users must confirm.
   */
  async confirmCompletion(req, res, next) {
    try {
      const sessionService = new SessionService();
      const sessionRepo = require('../repositories/session.repository');
      const session = await sessionRepo.findBySwapId(req.params.id);

      if (!session) {
        return sendError(res, 404, 'NOT_FOUND', 'No session found for this swap');
      }

      const result = await sessionService.completeSession(session.id, req.user.id);

      const message = result.bothConfirmed
        ? 'Swap completed! Both parties confirmed.'
        : 'Completion confirmed, waiting for other participant';

      return sendSuccess(res, 200, message, result);
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * GET /api/swaps/sessions/upcoming
   * Get upcoming sessions for the authenticated user (next 7 days).
   */
  async getUpcomingSessions(req, res, next) {
    try {
      const sessionService = new SessionService();
      const sessions = await sessionService.getUpcomingSessions(req.user.id);

      return sendSuccess(res, 200, 'Upcoming sessions retrieved', {
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      this.#handleError(error, res, next);
    }
  }

  /**
   * Handle errors with appropriate status codes.
   * @param {Error} error - The error to handle
   * @param {Object} res - Express response
   * @param {Function} next - Express next function
   */
  #handleError(error, res, next) {
    logger.error('SwapController error:', error);

    // Handle SwapStateError specially
    if (error instanceof SwapStateError) {
      return sendError(res, error.statusCode || 400, 'SWAP_STATE_ERROR', error.message, {
        currentState: error.currentState,
        targetState: error.targetState,
        validTransitions: error.validTransitions,
      });
    }

    // Handle known business errors
    if (error.message.includes('not found')) {
      return sendError(res, 404, 'NOT_FOUND', error.message);
    }

    if (error.message.includes('not a participant') ||
        error.message.includes('Only the receiver')) {
      return sendError(res, 403, 'FORBIDDEN', error.message);
    }

    if (error.message.includes('already exists') ||
        error.message.includes('does not belong') ||
        error.message.includes('must be in') ||
        error.message.includes('Time conflict') ||
        error.message.includes('outside availability') ||
        error.message.includes('Maximum reschedules') ||
        error.message.includes('must be in the future') ||
        error.message.includes('Only SCHEDULED')) {
      return sendError(res, 400, 'BAD_REQUEST', error.message);
    }

    // Pass unknown errors to global error handler
    next(error);
  }
}

module.exports = new SwapController();
