const NotificationService = require('../services/notification.service');
const { SwapEvents, SwapEventEmitter } = require('../events/swap.events');
const { SessionEvents, SessionEventEmitter } = require('../events/session.events');
const { ReviewEvents, ReviewEventEmitter } = require('../events/review.events');
const prisma = require('../config/db.config');
const logger = require('../utils/logger');

jest.mock('../config/db.config', () => ({
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('NotificationService', () => {
  let notificationService;
  let mockSwapEmitter;
  let mockSessionEmitter;
  let mockReviewEmitter;

  const mockUser = { id: 'user-1', email: 'test@test.com', profile: { displayName: 'Alice', notifyEmail: true, notifyInApp: true } };

  beforeEach(() => {
    mockSwapEmitter = new SwapEventEmitter();
    mockSessionEmitter = new SessionEventEmitter();
    mockReviewEmitter = new ReviewEventEmitter();
    notificationService = new NotificationService(mockSwapEmitter, mockSessionEmitter, mockReviewEmitter);
    jest.clearAllMocks();
  });

  describe('Database Operations', () => {
    it('should get notifications with pagination', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await notificationService.getNotifications('user-1', { page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
    });

    it('should mark a notification as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', isRead: true });

      const result = await notificationService.markRead('n1', 'user-1');
      expect(result.id).toBe('n1');
    });

    it('should mark all as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await notificationService.markAllRead('user-1');
      expect(result.updated).toBe(5);
    });

    it('should get unread count', async () => {
      prisma.notification.count.mockResolvedValue(3);
      const result = await notificationService.getUnreadCount('user-1');
      expect(result.count).toBe(3);
    });
  });

  describe('Observers and Channels', () => {
    it('should notify observers if channel is enabled', async () => {
      const mockObserver = { getChannel: () => 'inapp', update: jest.fn().mockResolvedValue() };
      notificationService.addObserver(mockObserver);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      await notificationService.send('user-1', 'SWAP_CREATED', { actorName: 'Bob' });
      expect(mockObserver.update).toHaveBeenCalled();
    });

    it('should NOT notify observers if channel is disabled', async () => {
      const mockObserver = { getChannel: () => 'email', update: jest.fn().mockResolvedValue() };
      notificationService.addObserver(mockObserver);
      
      const userNoEmail = { ...mockUser, profile: { notifyEmail: false } };
      prisma.user.findUnique.mockResolvedValue(userNoEmail);
      
      await notificationService.send('user-1', 'TEST');
      expect(mockObserver.update).not.toHaveBeenCalled();
    });

    it('should isolate observer failures', async () => {
      const observer1 = { getChannel: () => 'inapp', update: jest.fn().mockRejectedValue(new Error('Fail')) };
      notificationService.addObserver(observer1);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      await notificationService.send('user-1', 'TEST');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Event Bus Adapters', () => {
    it('should handle session events', async () => {
      const mockObserver = { getChannel: () => 'inapp', update: jest.fn() };
      notificationService.addObserver(mockObserver);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      notificationService.registerListeners();
      
      const session = { id: 's1', scheduledAt: new Date().toISOString() };
      const initiator = { id: 'u1', profile: { displayName: 'Alice' } };
      const receiver = { id: 'user-1', profile: { displayName: 'Bob' } };
      
      mockSessionEmitter.emitSessionScheduled(session, { id: 'sw1' }, initiator, receiver);
      
      await new Promise(resolve => setImmediate(resolve));
      expect(mockObserver.update).toHaveBeenCalled();
    });

    it('should handle review events', async () => {
      const mockObserver = { getChannel: () => 'inapp', update: jest.fn() };
      notificationService.addObserver(mockObserver);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      notificationService.registerListeners();
      
      const review = { id: 'r1', rating: 5, swapId: 'sw1' };
      const reviewer = { profile: { displayName: 'Alice' } };
      const reviewee = { id: 'user-1' };
      
      mockReviewEmitter.emitReviewReceived(review, reviewer, reviewee);
      
      await new Promise(resolve => setImmediate(resolve));
      expect(mockObserver.update).toHaveBeenCalled();
    });

    it('should handle swap events', async () => {
      const mockObserver = { getChannel: () => 'inapp', update: jest.fn() };
      notificationService.addObserver(mockObserver);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      
      notificationService.registerListeners();
      
      const swap = { id: 'sw1' };
      const initiator = { id: 'u1', profile: { displayName: 'Alice' } };
      const receiver = { id: 'user-1' };
      
      mockSwapEmitter.emitSwapCreated(swap, initiator, receiver);
      
      await new Promise(resolve => setImmediate(resolve));
      expect(mockObserver.update).toHaveBeenCalled();
    });
  });
});
