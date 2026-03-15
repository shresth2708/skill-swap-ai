const chatController = require('../../controllers/chat.controller');
const chatService = require('../../services/chat.service');
const messageRepository = require('../../repositories/message.repository');
const prisma = require('../../config/db.config');

jest.mock('../../services/chat.service');
jest.mock('../../repositories/message.repository');
jest.mock('../../config/db.config', () => ({
  chat: {
    findUnique: jest.fn(),
  },
}));

describe('ChatController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      query: {},
      user: { id: 'u1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getMessages', () => {
    it('returns empty if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      await chatController.getMessages(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    it('returns messages from service', async () => {
      prisma.chat.findUnique.mockResolvedValue({ id: 'c1' });
      chatService.getMessages.mockResolvedValue(['msg']);
      await chatController.getMessages(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: ['msg'] }));
    });

    it('handles Forbidden error', async () => {
      prisma.chat.findUnique.mockResolvedValue({ id: 'c1' });
      chatService.getMessages.mockRejectedValue(new Error('User is not a participant'));
      await chatController.getMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('handles server error', async () => {
      prisma.chat.findUnique.mockResolvedValue({ id: 'c1' });
      chatService.getMessages.mockRejectedValue(new Error('kaboom'));
      await chatController.getMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  it('getUnreadCount success', async () => {
    chatService.getUnreadCount.mockResolvedValue(5);
    await chatController.getUnreadCount(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { count: 5 } }));
  });

  it('getUnreadCount fails', async () => {
    chatService.getUnreadCount.mockRejectedValue(new Error('fail'));
    await chatController.getUnreadCount(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('deleteMessage success', async () => {
    req.params.id = 'm1';
    await chatController.deleteMessage(req, res);
    expect(messageRepository.deleteMessage).toHaveBeenCalledWith('m1', 'u1');
    expect(res.json).toHaveBeenCalled();
  });

  it('deleteMessage fails', async () => {
    messageRepository.deleteMessage.mockRejectedValue(new Error('fail'));
    await chatController.deleteMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
