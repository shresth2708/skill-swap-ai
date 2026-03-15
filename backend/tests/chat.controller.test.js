const chatController = require('../controllers/chat.controller');
const chatService = require('../services/chat.service');
const messageRepository = require('../repositories/message.repository');
const prisma = require('../config/db.config');
const { sendSuccess, sendError } = require('../utils/response.util');

jest.mock('../services/chat.service');
jest.mock('../repositories/message.repository');
jest.mock('../config/db.config', () => ({
  chat: { findUnique: jest.fn() }
}));
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn()
}));

describe('ChatController', () => {
  let req, res;
  beforeEach(() => {
    req = { params: {}, query: {}, user: { id: 'u1' } };
    res = {};
    jest.clearAllMocks();
  });

  describe('getMessages', () => {
    it('returns empty array if no chat exists for swap', async () => {
      req.params.swapId = 'sw1';
      prisma.chat.findUnique.mockResolvedValueOnce(null);
      await chatController.getMessages(req, res);
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Messages retrieved', []);
    });

    it('returns messages if chat exists', async () => {
      req.params.swapId = 'sw1';
      req.query = { cursor: '1', limit: 10 };
      prisma.chat.findUnique.mockResolvedValueOnce({ id: 'ch1' });
      chatService.getMessages.mockResolvedValueOnce([{ content: 'hi' }]);
      
      await chatController.getMessages(req, res);
      expect(chatService.getMessages).toHaveBeenCalledWith('ch1', 'u1', { cursor: '1', limit: 10 });
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Messages retrieved', [{ content: 'hi' }]);
    });

    it('returns 403 on forbidden', async () => {
      req.params.swapId = 'sw1';
      prisma.chat.findUnique.mockResolvedValueOnce({ id: 'ch1' });
      chatService.getMessages.mockRejectedValueOnce(new Error('User is not a participant'));
      
      await chatController.getMessages(req, res);
      expect(sendError).toHaveBeenCalledWith(res, 403, 'FORBIDDEN', 'User is not a participant');
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      chatService.getUnreadCount.mockResolvedValueOnce({ count: 5 });
      await chatController.getUnreadCount(req, res);
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Unread count retrieved', { count: { count: 5 } });
    });
  });

  describe('deleteMessage', () => {
    it('deletes message', async () => {
      req.params.id = 'msg-1';
      messageRepository.deleteMessage.mockResolvedValueOnce({});
      await chatController.deleteMessage(req, res);
      expect(messageRepository.deleteMessage).toHaveBeenCalledWith('msg-1', 'u1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Message deleted');
    });

    it('handles errors', async () => {
      req.params.id = 'msg-1';
      messageRepository.deleteMessage.mockRejectedValueOnce(new Error('error'));
      await chatController.deleteMessage(req, res);
      expect(sendError).toHaveBeenCalledWith(res, 500, 'SERVER_ERROR', 'error');
    });
  });
});
