const { Router } = require('express');
const reviewController = require('../controllers/review.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

// All review routes require authentication
router.use(verifyAccessToken);

/**
 * PUT /api/reviews/:id
 * Edit a review (owner only, within 24h of creation).
 *
 * Body: { rating?: number (1-5), comment?: string }
 */
router.put('/:id', reviewController.editReview);

module.exports = router;
