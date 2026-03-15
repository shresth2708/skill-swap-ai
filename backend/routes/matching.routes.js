const { Router } = require('express');
const matchingController = require('../controllers/matching.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// All matching routes require authentication
router.use(verifyAccessToken);

/**
 * GET /api/matches/stats
 * Dashboard match statistics for the authenticated user.
 * Returns: { totalMatches, acceptedMatches, declinedMatches }
 *
 * IMPORTANT: Must be registered BEFORE /:id to avoid capturing "stats" as :id
 */
router.get('/stats', matchingController.getMatchStats);

/**
 * GET /api/matches
 * Find potential matches for the authenticated user.
 *
 * Query params:
 *   - strategy: 'skill' | 'location' | 'hybrid' (default: 'skill')
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 50)
 */
router.get('/', matchingController.findMatches);

/**
 * GET /api/matches/:id/explain
 * Explains the match scoring.
 */
router.get('/:matchId/explain', matchingController.explainMatch);

/**
 * GET /api/matches/:id
 * Get details of a specific match.
 */
router.get('/:id', matchingController.getMatchById);

/**
 * POST /api/matches/:id/accept
 * Accept a pending match.
 */
router.post('/:id/accept', matchingController.acceptMatch);

/**
 * POST /api/matches/:id/decline
 * Decline a pending match.
 */
router.post('/:id/decline', matchingController.declineMatch);

module.exports = router;
