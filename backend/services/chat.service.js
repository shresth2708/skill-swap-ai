const prisma = require('../config/db.config');
const messageRepository = require('../repositories/message.repository');

class ChatService {
  /**
   * Create a Chat record when a swap is ACCEPTED.
   * Check if chat already exists for swap to avoid unique constraint errors.
   */
  async createChatForSwap(swapId) {
    const existing = await prisma.chat.findUnique({ where: { swapId } });
    if (existing) return existing;

    return await prisma.chat.create({
      data: { swapId },
    });
  }

  /**
   * Send a message in a chat.
   */
  async sendMessage(chatId, senderId, dto) {
    const { content, msgType } = dto;
    
    // Validate chat exists and user is participant
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { swap: true },
    });
    
    if (!chat) throw new Error('Chat not found');
    if (!chat.isActive) throw new Error('Chat is inactive');
    if (chat.swap.initiatorId !== senderId && chat.swap.receiverId !== senderId) {
      throw new Error('User is not a participant of this chat');
    }

    const message = await messageRepository.createMessage({
      chatId,
      senderId,
      content,
      msgType: msgType || 'TEXT',
    });

    return message;
  }

  /**
   * Get messages with cursor-based pagination.
   */
  async getMessages(chatId, userId, { cursor, limit }) {
    // Validate user is participant
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { swap: true },
    });

    if (!chat) throw new Error('Chat not found');
    if (chat.swap.initiatorId !== userId && chat.swap.receiverId !== userId) {
      throw new Error('User is not a participant');
    }

    // Usually frontend displays oldest at top, newest at bottom, but infinite scroll means fetching
    // descending chunks and reversing, or the frontend handles it. 
    // Repo returns newest first (DESC).
    const messages = await messageRepository.getMessagesByCursor(chatId, cursor, Number(limit) || 50);
    
    return messages;
  }

  /**
   * Mark messages as read.
   */
  async markMessagesRead(chatId, userId) {
    // Validate participation
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { swap: true },
    });
    if (!chat) return 0;
    if (chat.swap.initiatorId !== userId && chat.swap.receiverId !== userId) return 0;

    return await messageRepository.markRead(chatId, userId);
  }

  /**
   * Get unread count.
   */
  async getUnreadCount(userId) {
    return await messageRepository.getUnreadCounts(userId);
  }

  /**
   * Archive chat (when swap is completed or cancelled)
   */
  async archiveChat(chatId) {
    return await prisma.chat.update({
      where: { id: chatId },
      data: { isActive: false },
    });
  }
}

module.exports = new ChatService();
