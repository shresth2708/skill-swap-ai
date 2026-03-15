const { Router } = require('express');
const notificationController = require('../controllers/notification.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

const router = Router();

router.use(verifyAccessToken);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', notificationController.markRead);

module.exports = router;

