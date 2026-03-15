const prisma = require('../config/db.config');

class MessageRepository {
  /**
   * Create a new message in the database.
   * @param {Object} data - { chatId, senderId, content, msgType }
   */
  async createMessage(data) {
    return await prisma.message.create({
      data,
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  /**
   * Fetch messages with cursor-based pagination. Wait, sender profile might need to be resolved.
   * Based on the schema User doesn't have displayName directly, Profile has it. 
   * Let's include profile.
   */
  async getMessagesByCursor(chatId, cursorId, limit = 50) {
    const args = {
      where: { chatId, isDeleted: false },
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true },
            },
          },
        },
      },
    };

    if (cursorId) {
      args.cursor = { id: cursorId };
      args.skip = 1; // Skip the cursor message itself
    }

    const messages = await prisma.message.findMany(args);
    return messages; // Descending order: newest first
  }

  /**
   * Mark messages in a chat as read by a specific user up to a certain time or message.
   * Since there's no readBy array (just isRead boolean and readAt datetime), we mark all unread
   * messages not from this user as read.
   */
  async markRead(chatId, userId) {
    const updated = await prisma.message.updateMany({
      where: {
        chatId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return updated.count;
  }

  /**
   * Get unread count for user across all their chats.
   * Since message doesn't have "receiverId", we find all messages in chats the user is part of,
   * where senderId is NOT the user, and isRead is false.
   */
  async getUnreadCounts(userId) {
    // A user is in a chat if the chat's swap's initiatorId or receiverId is the user.
    const count = await prisma.message.count({
      where: {
        isRead: false,
        senderId: { not: userId },
        chat: {
          swap: {
            OR: [{ initiatorId: userId }, { receiverId: userId }],
          },
        },
      },
    });
    return count;
  }
  
  /**
   * Soft delete a message
   */
  async deleteMessage(messageId, userId) {
    return await prisma.message.updateMany({
      where: {
        id: messageId,
        senderId: userId, // only sender can delete
      },
      data: {
        isDeleted: true,
      },
    });
  }
}

module.exports = new MessageRepository();
