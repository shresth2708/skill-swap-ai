const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response.util');
const { isUserOnline } = require('../socket/chat.socket');

class UserController {
  constructor() {
    const methods = Object.getOwnPropertyNames(UserController.prototype)
      .filter(m => m !== 'constructor');
    for (const m of methods) {
      if (typeof this[m] === 'function') {
        this[m] = this[m].bind(this);
      }
    }
  }

  async getOwnProfile(req, res, next) {
    try {
      const data = await userService.getProfile(req.user.id);
      return sendSuccess(res, 200, 'Profile retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  async getPublicProfile(req, res, next) {
    try {
      const { id } = req.params;
      const data = await userService.getPublicProfile(id);
      return sendSuccess(res, 200, 'Public profile retrieved successfully', data);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const data = await userService.updateProfile(req.user.id, req.body);
      return sendSuccess(res, 200, 'Profile updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req, res, next) {
    try {
      const data = await userService.updateNotificationPreferences(req.user.id, req.body);
      return sendSuccess(res, 200, 'Notification preferences updated', data);
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const query = req.query.q || '';
      const type = req.query.type;
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;

      const results = await userService.searchUsers(query, { type, page, limit });
      return sendSuccess(res, 200, 'Search successful', results);
    } catch (error) {
      next(error);
    }
  }

  async addSkill(req, res, next) {
    try {
      const newSkill = await userService.addSkill(req.user.id, req.body);
      return sendSuccess(res, 201, 'Skill added successfully', newSkill);
    } catch (error) {
      next(error);
    }
  }

  async removeSkill(req, res, next) {
    try {
      const { id } = req.params;
      await userService.removeSkill(req.user.id, id);
      return sendSuccess(res, 200, 'Skill removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateSkillLevel(req, res, next) {
    try {
      const { id } = req.params;
      const { proficiencyLevel } = req.body;
      const updatedSkill = await userService.updateSkillLevel(req.user.id, id, proficiencyLevel);
      return sendSuccess(res, 200, 'Skill level updated successfully', updatedSkill);
    } catch (error) {
      next(error);
    }
  }

  async addAvailabilitySlot(req, res, next) {
    try {
      const newSlot = await userService.addAvailabilitySlot(req.user.id, req.body);
      return sendSuccess(res, 201, 'Availability slot added successfully', newSlot);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateAvailability(req, res, next) {
    try {
      const data = await userService.bulkUpdateAvailability(req.user.id, req.body.availability);
      return sendSuccess(res, 200, 'Availability updated successfully', data);
    } catch (error) {
      next(error);
    }
  }

  async removeAvailabilitySlot(req, res, next) {
    try {
      const { id } = req.params;
      await userService.removeAvailabilitySlot(req.user.id, id);
      return sendSuccess(res, 200, 'Availability slot removed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOnlineStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isOnline, presenceAvailable } = await isUserOnline(id);
      return sendSuccess(res, 200, 'Online status retrieved', { isOnline, presenceAvailable });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
