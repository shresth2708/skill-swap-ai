const { Router } = require('express');
const reviewController = require('../controllers/review.controller');
const analyticsController = require('../controllers/analytics.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin-role.middleware');

const router = Router();

// All admin routes require authentication
router.use(verifyAccessToken);

// Apply admin role verification middleware
router.use(isAdmin);

/**
 * GET /api/admin/match-analytics
 * Admin dashboard match statistics.
 */
router.get('/match-analytics', analyticsController.getMatchAnalytics);

/**
 * POST /api/admin/reviews/:id/flag
 * Flag a review as inappropriate (admin only).
 * Flagged reviews are excluded from avgRating calculation.
 */
router.post('/reviews/:id/flag', reviewController.flagReview);

module.exports = router;
