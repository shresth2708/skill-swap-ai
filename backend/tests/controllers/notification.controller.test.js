const notificationController = require('../../controllers/notification.controller');
const NotificationService = require('../../services/notification.service');

jest.mock('../../services/notification.service');

describe('NotificationController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      user: { id: 'u1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('getNotifications success', async () => {
    const mockService = { getNotifications: jest.fn().mockResolvedValue({ data: [] }) };
    NotificationService.mockImplementation(() => mockService);
    await notificationController.getNotifications(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getNotifications fails', async () => {
    NotificationService.mockImplementation(() => ({
        getNotifications: jest.fn().mockRejectedValue(new Error('fail'))
    }));
    await notificationController.getNotifications(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('getUnreadCount success', async () => {
    const mockService = { getUnreadCount: jest.fn().mockResolvedValue({ count: 5 }) };
    NotificationService.mockImplementation(() => mockService);
    await notificationController.getUnreadCount(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  describe('markRead', () => {
    it('success', async () => {
        const mockService = { markRead: jest.fn().mockResolvedValue({}) };
        NotificationService.mockImplementation(() => mockService);
        await notificationController.markRead(req, res, next);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles Forbidden (403)', async () => {
        const err = new Error('Forbidden');
        err.statusCode = 403;
        NotificationService.mockImplementation(() => ({
            markRead: jest.fn().mockRejectedValue(err)
        }));
        await notificationController.markRead(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('passes generic error to next', async () => {
        NotificationService.mockImplementation(() => ({
            markRead: jest.fn().mockRejectedValue(new Error('kaboom'))
        }));
        await notificationController.markRead(req, res, next);
        expect(next).toHaveBeenCalled();
    });
  });

  it('markAllRead success', async () => {
    const mockService = { markAllRead: jest.fn().mockResolvedValue({}) };
    NotificationService.mockImplementation(() => mockService);
    await notificationController.markAllRead(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
