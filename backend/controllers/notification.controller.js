const NotificationService = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/response.util');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const service = new NotificationService();
      const data = await service.getNotifications(req.user.id, {
        page: req.query.page,
        limit: req.query.limit,
      });
      return sendSuccess(res, 200, 'Notifications retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const service = new NotificationService();
      const data = await service.getUnreadCount(req.user.id);
      return sendSuccess(res, 200, 'Unread count retrieved', data);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req, res, next) {
    try {
      const service = new NotificationService();
      const updated = await service.markRead(req.params.id, req.user.id);
      return sendSuccess(res, 200, 'Notification marked read', updated);
    } catch (error) {
      if (error.statusCode === 403) {
        return sendError(res, 403, 'FORBIDDEN', 'Forbidden');
      }
      next(error);
    }
  }

  async markAllRead(req, res, next) {
    try {
      const service = new NotificationService();
      const data = await service.markAllRead(req.user.id);
      return sendSuccess(res, 200, 'All notifications marked read', data);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();

