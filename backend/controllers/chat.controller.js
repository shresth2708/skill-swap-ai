const chatService = require('../services/chat.service');
const messageRepository = require('../repositories/message.repository');
const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../config/db.config');

exports.getMessages = async (req, res) => {
  try {
    const { swapId } = req.params;
    const { cursor, limit } = req.query;
    
    // Get chat ID from swapId
    const chat = await prisma.chat.findUnique({ where: { swapId } });
    if (!chat) return sendSuccess(res, 200, 'Messages retrieved', []);

    const messages = await chatService.getMessages(chat.id, req.user.id, { cursor, limit });
    return sendSuccess(res, 200, 'Messages retrieved', messages);
  } catch (err) {
    if (err.message === 'User is not a participant') return sendError(res, 403, 'FORBIDDEN', err.message);
    return sendError(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const count = await chatService.getUnreadCount(req.user.id);
    return sendSuccess(res, 200, 'Unread count retrieved', { count });
  } catch (err) {
    return sendError(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params; // we don't strictly need swapId here since message id is UUID
    await messageRepository.deleteMessage(id, req.user.id);
    return sendSuccess(res, 200, 'Message deleted');
  } catch (err) {
    return sendError(res, 500, 'SERVER_ERROR', err.message);
  }
};
