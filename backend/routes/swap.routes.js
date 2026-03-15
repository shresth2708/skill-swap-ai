const { Router } = require('express');
const { z } = require('zod');
const swapController = require('../controllers/swap.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validate.middleware');

const router = Router();

// All swap routes require authentication
router.use(verifyAccessToken);

// ─────────────────────────────────────────────────────────────────────────────
// Static routes (must be registered BEFORE /:id to avoid capturing as :id)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/swaps/active
 * Get all active swaps (ACCEPTED + IN_PROGRESS) for the authenticated user.
 */
router.get('/active', swapController.getActiveSwaps);

/**
 * GET /api/swaps/history
 * Get paginated swap history for the authenticated user.
 *
 * Query params:
 *   - status: filter by swap status (PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED, EXPIRED)
 *   - fromDate: filter from date (ISO string)
 *   - toDate: filter to date (ISO string)
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 20, max: 50)
 */
router.get('/history', swapController.getSwapHistory);

/**
 * GET /api/swaps/stats
 * Get swap statistics for the authenticated user.
 *
 * Response: { total, pending, completed, cancelled }
 */
router.get('/stats', swapController.getSwapStats);

/**
 * GET /api/swaps/sessions/upcoming
 * Get upcoming sessions for the authenticated user (next 7 days).
 */
router.get('/sessions/upcoming', swapController.getUpcomingSessions);

// ─────────────────────────────────────────────────────────────────────────────
// Swap CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/swaps
 * Create a new swap request from an existing match.
 *
 * Body: {
 *   matchId: string (required) - UUID of the match
 *   offeredSkillId: string (required) - UUID of the skill being offered (must belong to initiator)
 *   requestedSkillId: string (required) - UUID of the skill being requested (must belong to receiver)
 *   terms?: string - Optional terms or notes for the swap
 *   scheduledAt?: string - Optional scheduled date/time (ISO string)
 * }
 */
const createSwapSchema = z.object({
  matchId: z.string().uuid(),
  offeredSkillId: z.string().uuid(),
  requestedSkillId: z.string().uuid(),
  terms: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

router.post('/', validateBody(createSwapSchema), swapController.createSwap);

/**
 * GET /api/swaps
 * Get paginated swap history (alias for /history).
 */
router.get('/', swapController.getSwapHistory);

/**
 * GET /api/swaps/:id
 * Get details of a specific swap.
 * User must be a participant (initiator or receiver).
 */
router.get('/:id', swapController.getSwapById);

// ─────────────────────────────────────────────────────────────────────────────
// Swap Lifecycle Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/swaps/:id/accept
 * Accept a pending swap request.
 * Only the receiver can accept.
 * Transitions: PENDING -> ACCEPTED
 */
router.post('/:id/accept', swapController.acceptSwap);

/**
 * POST /api/swaps/:id/decline
 * Decline a pending swap request.
 * Only the receiver can decline.
 * Transitions: PENDING -> CANCELLED
 *
 * Body: { reason?: string }
 */
router.post('/:id/decline', swapController.declineSwap);

/**
 * POST /api/swaps/:id/start
 * Start the swap session.
 * Either participant can start.
 * Transitions: ACCEPTED -> IN_PROGRESS
 */
router.post('/:id/start', swapController.startSwap);

/**
 * POST /api/swaps/:id/complete
 * Mark swap as complete from your perspective.
 * Both participants must confirm for swap to transition to COMPLETED.
 * Transitions: IN_PROGRESS -> COMPLETED (when both confirm)
 */
router.post('/:id/complete', swapController.completeSwap);

/**
 * POST /api/swaps/:id/cancel
 * Cancel an active swap.
 * Either participant can cancel.
 * Transitions: PENDING/ACCEPTED -> CANCELLED
 *
 * Body: { reason?: string }
 */
router.post('/:id/cancel', swapController.cancelSwap);

/**
 * POST /api/swaps/:id/complete-confirm
 * Confirm completion via session flow. Both users must confirm.
 */
router.post('/:id/complete-confirm', swapController.confirmCompletion);

// ─────────────────────────────────────────────────────────────────────────────
// Session Routes
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
router.post('/:id/sessions', swapController.scheduleSession);

/**
 * PUT /api/swaps/:id/sessions/:sid/reschedule
 * Reschedule an existing session. Max 2 reschedules allowed.
 *
 * Body: { scheduledAt: ISO date string (required) }
 */
router.put('/:id/sessions/:sid/reschedule', swapController.rescheduleSession);

// ─────────────────────────────────────────────────────────────────────────────
// Review Routes (nested under swaps)
// ─────────────────────────────────────────────────────────────────────────────

const reviewController = require('../controllers/review.controller');

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
router.post('/:id/reviews', reviewController.submitReview);

/**
 * GET /api/swaps/:id/reviews
 * Get both reviews for a swap (participant only).
 */
router.get('/:id/reviews', reviewController.getReviewsForSwap);

module.exports = router;
