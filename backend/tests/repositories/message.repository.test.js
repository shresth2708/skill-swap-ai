const prisma = require('../../config/db.config');
const messageRepository = require('../../repositories/message.repository');

jest.mock('../../config/db.config', () => ({
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
}));

describe('MessageRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createMessage calls prisma.create', async () => {
    prisma.message.create.mockResolvedValue({ id: 'm1' });
    await messageRepository.createMessage({ chatId: 'c1', senderId: 'u1', content: 'hi' });
    expect(prisma.message.create).toHaveBeenCalled();
  });

  describe('getMessagesByCursor', () => {
    it('hits findMany with correct args', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      await messageRepository.getMessagesByCursor('c1', null, 20);
      expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { chatId: 'c1', isDeleted: false },
        take: 20
      }));
    });

    it('handles cursor and skip', async () => {
      prisma.message.findMany.mockResolvedValue([]);
      await messageRepository.getMessagesByCursor('c1', 'msg-123', 20);
      expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
        cursor: { id: 'msg-123' },
        skip: 1
      }));
    });
  });

  it('markRead hits updateMany', async () => {
    prisma.message.updateMany.mockResolvedValue({ count: 5 });
    const res = await messageRepository.markRead('c1', 'u1');
    expect(res).toBe(5);
    expect(prisma.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ chatId: 'c1', senderId: { not: 'u1' } })
    }));
  });

  it('getUnreadCounts hits count', async () => {
    prisma.message.count.mockResolvedValue(10);
    const res = await messageRepository.getUnreadCounts('u1');
    expect(res).toBe(10);
    expect(prisma.message.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ senderId: { not: 'u1' } })
    }));
  });

  it('deleteMessage hits updateMany', async () => {
    prisma.message.updateMany.mockResolvedValue({ count: 1 });
    await messageRepository.deleteMessage('m1', 'u1');
    expect(prisma.message.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'm1', senderId: 'u1' }
    }));
  });
});
