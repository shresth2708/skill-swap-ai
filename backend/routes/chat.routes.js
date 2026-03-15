const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { verifyAccessToken } = require('../middlewares/auth.middleware');

// Routes are prefixed with /api/chats

// Get unread counts (must come before /:swapId so "unread-count" is not treated as swapId)
router.get('/unread-count', verifyAccessToken, chatController.getUnreadCount);

// Get messages for a swap
router.get('/:swapId/messages', verifyAccessToken, chatController.getMessages);

// Delete a specific message
router.delete('/:swapId/messages/:id', verifyAccessToken, chatController.deleteMessage);

module.exports = router;
