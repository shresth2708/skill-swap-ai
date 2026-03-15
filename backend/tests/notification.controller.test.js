const notificationController = require('../controllers/notification.controller');
const NotificationService = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/response.util');

jest.mock('../services/notification.service');
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

describe('NotificationController', () => {
  let req, res, next;
  let mockServiceInstance;

  beforeEach(() => {
    req = { user: { id: 'user-1' }, query: {}, params: {} };
    res = {};
    next = jest.fn();

    mockServiceInstance = {
      getNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    NotificationService.mockImplementation(() => mockServiceInstance);
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return successfully via service data', async () => {
      req.query = { page: 2, limit: 10 };
      mockServiceInstance.getNotifications.mockResolvedValueOnce('data');
      
      await notificationController.getNotifications(req, res, next);
      
      expect(mockServiceInstance.getNotifications).toHaveBeenCalledWith('user-1', { page: 2, limit: 10 });
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Notifications retrieved', 'data');
    });

    it('should pass error to next', async () => {
      const err = new Error('db error');
      mockServiceInstance.getNotifications.mockRejectedValueOnce(err);
      
      await notificationController.getNotifications(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('getUnreadCount', () => {
    it('should return successfully via service', async () => {
      mockServiceInstance.getUnreadCount.mockResolvedValueOnce({ count: 5 });
      
      await notificationController.getUnreadCount(req, res, next);
      expect(mockServiceInstance.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Unread count retrieved', { count: 5 });
    });

    it('should pass error to next', async () => {
      const err = new Error('error');
      mockServiceInstance.getUnreadCount.mockRejectedValueOnce(err);
      await notificationController.getUnreadCount(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('markRead', () => {
    it('should return successfully if marked read', async () => {
      req.params.id = 'notif-1';
      mockServiceInstance.markRead.mockResolvedValueOnce({ id: 'notif-1', isRead: true });
      
      await notificationController.markRead(req, res, next);
      expect(mockServiceInstance.markRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'Notification marked read', { id: 'notif-1', isRead: true });
    });

    it('should intercept 403 errors and return forbidden', async () => {
      req.params.id = 'notif-1';
      const err = new Error('forbidden');
      err.statusCode = 403;
      mockServiceInstance.markRead.mockRejectedValueOnce(err);
      
      await notificationController.markRead(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 403, 'FORBIDDEN', 'Forbidden');
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass other errors to next', async () => {
      const err = new Error('error');
      mockServiceInstance.markRead.mockRejectedValueOnce(err);
      await notificationController.markRead(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('markAllRead', () => {
    it('should return successfully on marking all', async () => {
      mockServiceInstance.markAllRead.mockResolvedValueOnce({ count: 10 });
      await notificationController.markAllRead(req, res, next);
      
      expect(mockServiceInstance.markAllRead).toHaveBeenCalledWith('user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, 'All notifications marked read', { count: 10 });
    });

    it('should pass error to next', async () => {
      const err = new Error('error');
      mockServiceInstance.markAllRead.mockRejectedValueOnce(err);
      await notificationController.markAllRead(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
