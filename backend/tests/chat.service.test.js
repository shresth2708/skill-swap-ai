/**
 * Unit tests for ChatService.
 *
 * Mocks: Prisma (db.config), MessageRepository.
 * Tests: sendMessage, getMessages, markMessagesRead, unauthorized access.
 */

jest.mock('../config/db.config', () => ({
  chat: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    count: jest.fn(),
  },
}));

jest.mock('../repositories/message.repository', () => ({
  createMessage: jest.fn(),
  getMessagesByCursor: jest.fn(),
  markRead: jest.fn(),
  getUnreadCounts: jest.fn(),
  deleteMessage: jest.fn(),
}));

const prisma = require('../config/db.config');
const messageRepository = require('../repositories/message.repository');
const chatService = require('../services/chat.service');

describe('ChatService', () => {
  afterEach(() => jest.clearAllMocks());

  const CHAT_ID = 'chat-uuid-1';
  const SWAP_ID = 'swap-uuid-1';
  const USER_A = 'user-a';
  const USER_B = 'user-b';
  const OUTSIDER = 'user-outsider';

  const mockChat = {
    id: CHAT_ID,
    swapId: SWAP_ID,
    isActive: true,
    swap: {
      initiatorId: USER_A,
      receiverId: USER_B,
    },
  };

  // ──────────────────────────────────────────
  // createChatForSwap
  // ──────────────────────────────────────────
  describe('createChatForSwap', () => {
    it('should return existing chat if one already exists', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);

      const result = await chatService.createChatForSwap(SWAP_ID);

      expect(prisma.chat.findUnique).toHaveBeenCalledWith({ where: { swapId: SWAP_ID } });
      expect(prisma.chat.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockChat);
    });

    it('should create a new chat if none exists', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);
      prisma.chat.create.mockResolvedValue(mockChat);

      const result = await chatService.createChatForSwap(SWAP_ID);

      expect(prisma.chat.create).toHaveBeenCalledWith({ data: { swapId: SWAP_ID } });
      expect(result).toEqual(mockChat);
    });
  });

  // ──────────────────────────────────────────
  // sendMessage
  // ──────────────────────────────────────────
  describe('sendMessage', () => {
    const dto = { content: 'Hello!', msgType: 'TEXT' };

    it('should save message to DB and return saved object', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);
      const savedMsg = { id: 'msg-1', chatId: CHAT_ID, senderId: USER_A, content: 'Hello!', msgType: 'TEXT' };
      messageRepository.createMessage.mockResolvedValue(savedMsg);

      const result = await chatService.sendMessage(CHAT_ID, USER_A, dto);

      expect(messageRepository.createMessage).toHaveBeenCalledWith({
        chatId: CHAT_ID,
        senderId: USER_A,
        content: 'Hello!',
        msgType: 'TEXT',
      });
      expect(result).toEqual(savedMsg);
    });

    it('should default to TEXT msgType when not provided', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);
      messageRepository.createMessage.mockResolvedValue({ id: 'msg-2' });

      await chatService.sendMessage(CHAT_ID, USER_A, { content: 'hello' });

      expect(messageRepository.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({ msgType: 'TEXT' }),
      );
    });

    it('should throw if chat is not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);

      await expect(chatService.sendMessage(CHAT_ID, USER_A, dto)).rejects.toThrow('Chat not found');
    });

    it('should throw if chat is inactive', async () => {
      prisma.chat.findUnique.mockResolvedValue({ ...mockChat, isActive: false });

      await expect(chatService.sendMessage(CHAT_ID, USER_A, dto)).rejects.toThrow('Chat is inactive');
    });

    it('should throw if user is not a participant', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);

      await expect(chatService.sendMessage(CHAT_ID, OUTSIDER, dto)).rejects.toThrow(
        'User is not a participant of this chat',
      );
    });
  });

  // ──────────────────────────────────────────
  // getMessages
  // ──────────────────────────────────────────
  describe('getMessages', () => {
    it('should return paginated cursor-based results for a participant', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);

      const msgs = [
        { id: 'msg-2', content: 'Hi', sentAt: new Date() },
        { id: 'msg-1', content: 'Hey', sentAt: new Date(Date.now() - 1000) },
      ];
      messageRepository.getMessagesByCursor.mockResolvedValue(msgs);

      const result = await chatService.getMessages(CHAT_ID, USER_A, { cursor: null, limit: 20 });

      expect(messageRepository.getMessagesByCursor).toHaveBeenCalledWith(CHAT_ID, null, 20);
      expect(result).toHaveLength(2);
    });

    it('should throw 403 for unauthorized user', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);

      await expect(chatService.getMessages(CHAT_ID, OUTSIDER, { cursor: null, limit: 20 })).rejects.toThrow(
        'User is not a participant',
      );
    });

    it('should throw if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);

      await expect(chatService.getMessages(CHAT_ID, USER_A, { cursor: null, limit: 20 })).rejects.toThrow(
        'Chat not found',
      );
    });
  });

  // ──────────────────────────────────────────
  // markMessagesRead
  // ──────────────────────────────────────────
  describe('markMessagesRead', () => {
    it('should mark messages as read and return count', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);
      messageRepository.markRead.mockResolvedValue(5);

      const count = await chatService.markMessagesRead(CHAT_ID, USER_B);

      expect(messageRepository.markRead).toHaveBeenCalledWith(CHAT_ID, USER_B);
      expect(count).toBe(5);
    });

    it('should return 0 if chat not found', async () => {
      prisma.chat.findUnique.mockResolvedValue(null);

      const count = await chatService.markMessagesRead(CHAT_ID, USER_B);
      expect(count).toBe(0);
    });

    it('should return 0 for non-participant', async () => {
      prisma.chat.findUnique.mockResolvedValue(mockChat);

      const count = await chatService.markMessagesRead(CHAT_ID, OUTSIDER);
      expect(count).toBe(0);
    });
  });

  // ──────────────────────────────────────────
  // getUnreadCount
  // ──────────────────────────────────────────
  describe('getUnreadCount', () => {
    it('should return aggregate unread count', async () => {
      messageRepository.getUnreadCounts.mockResolvedValue(12);

      const count = await chatService.getUnreadCount(USER_A);
      expect(count).toBe(12);
      expect(messageRepository.getUnreadCounts).toHaveBeenCalledWith(USER_A);
    });
  });

  // ──────────────────────────────────────────
  // archiveChat
  // ──────────────────────────────────────────
  describe('archiveChat', () => {
    it('should set isActive to false', async () => {
      prisma.chat.update.mockResolvedValue({ ...mockChat, isActive: false });

      const result = await chatService.archiveChat(CHAT_ID);

      expect(prisma.chat.update).toHaveBeenCalledWith({
        where: { id: CHAT_ID },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
