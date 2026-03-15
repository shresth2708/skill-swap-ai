/**
 * Enhanced notification service tests — Phase 4C.
 *
 * Tests observer dispatch with preference checks (notifyAll),
 * resilient dispatch (one observer throws, others still called),
 * and addObserver/removeObserver.
 */

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

const prisma = require('../config/db.config');
const NotificationService = require('../services/notification.service');
const { SwapEventEmitter } = require('../events/swap.events');

// Helper: create a mock observer
function createMockObserver(channel, shouldThrow = false) {
  return {
    getChannel: jest.fn(() => channel),
    update: jest.fn(async () => {
      if (shouldThrow) throw new Error(`${channel} observer exploded`);
    }),
  };
}

describe('NotificationService — Observer Dispatch (Phase 4C)', () => {
  let service;
  let emailObs, pushObs, inappObs;

  beforeEach(() => {
    service = new NotificationService(new SwapEventEmitter());
    emailObs = createMockObserver('email');
    pushObs = createMockObserver('push');
    inappObs = createMockObserver('inapp');

    service.addObserver(emailObs);
    service.addObserver(pushObs);
    service.addObserver(inappObs);

    // Default: user has all channels enabled
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      profile: {
        notifyEmail: true,
        notifyPush: true,
        notifyInApp: true,
      },
    });
  });

  afterEach(() => jest.clearAllMocks());

  const baseEvent = {
    userId: 'user-1',
    type: 'SWAP_CREATED',
    title: 'New swap request',
    body: 'You have a new swap request from Alice',
    payload: {},
    createdAt: new Date(),
  };

  // ──────────────────────────────────────────
  // notifyAll — all observers called
  // ──────────────────────────────────────────
  it('notifyAll(SWAP_CREATED) should call all 3 observers', async () => {
    await service.notifyAll(baseEvent);

    expect(emailObs.update).toHaveBeenCalledWith(baseEvent);
    expect(pushObs.update).toHaveBeenCalledWith(baseEvent);
    expect(inappObs.update).toHaveBeenCalledWith(baseEvent);
  });

  // ──────────────────────────────────────────
  // User has notifyEmail=false -> EmailObserver NOT called
  // ──────────────────────────────────────────
  it('should NOT call EmailObserver when user has notifyEmail=false', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      profile: {
        notifyEmail: false,
        notifyPush: true,
        notifyInApp: true,
      },
    });

    await service.notifyAll(baseEvent);

    expect(emailObs.update).not.toHaveBeenCalled();
    expect(pushObs.update).toHaveBeenCalledWith(baseEvent);
    expect(inappObs.update).toHaveBeenCalledWith(baseEvent);
  });

  // ──────────────────────────────────────────
  // One observer throws -> others still called (resilient dispatch)
  // ──────────────────────────────────────────
  it('should still call remaining observers when one throws', async () => {
    const brokenEmail = createMockObserver('email', true);

    // Replace email observer
    service.removeObserver(emailObs);
    service.addObserver(brokenEmail);

    await service.notifyAll(baseEvent);

    expect(brokenEmail.update).toHaveBeenCalled();
    expect(pushObs.update).toHaveBeenCalledWith(baseEvent);
    expect(inappObs.update).toHaveBeenCalledWith(baseEvent);
  });

  // ──────────────────────────────────────────
  // addObserver / removeObserver
  // ──────────────────────────────────────────
  describe('addObserver / removeObserver', () => {
    it('removeObserver should prevent observer from being called', async () => {
      service.removeObserver(inappObs);

      await service.notifyAll(baseEvent);

      expect(inappObs.update).not.toHaveBeenCalled();
      expect(emailObs.update).toHaveBeenCalled();
      expect(pushObs.update).toHaveBeenCalled();
    });

    it('addObserver should allow new observers to be called', async () => {
      const smsObs = createMockObserver('sms');
      // SMS: no preference check in code means default allow
      service.addObserver(smsObs);

      await service.notifyAll(baseEvent);

      expect(smsObs.update).toHaveBeenCalledWith(baseEvent);
    });
  });

  // ──────────────────────────────────────────
  // getNotifications
  // ──────────────────────────────────────────
  describe('getNotifications', () => {
    it('should return paginated results', async () => {
      const items = [{ id: 'n1' }, { id: 'n2' }];
      prisma.notification.findMany.mockResolvedValue(items);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.getNotifications('user-1', { page: 1, limit: 10 });

      expect(result.items).toEqual(items);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  // ──────────────────────────────────────────
  // markRead / markAllRead / getUnreadCount
  // ──────────────────────────────────────────
  describe('markRead', () => {
    it('should mark notification as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.findUnique.mockResolvedValue({ id: 'n1', isRead: true });

      const result = await service.markRead('n1', 'user-1');
      expect(result.isRead).toBe(true);
    });

    it('should throw 404 if notification not found', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.markRead('nonexistent', 'user-1')).rejects.toThrow('Notification not found');
    });
  });

  describe('markAllRead', () => {
    it('should mark all user notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead('user-1');
      expect(result.updated).toBe(5);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      prisma.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user-1');
      expect(result.count).toBe(7);
    });
  });
});
