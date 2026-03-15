const userController = require('../controllers/user.controller');
const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/response.util');

jest.mock('../services/user.service');
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

describe('UserController', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-1' }, body: {}, params: {}, query: {} };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getOwnProfile', () => {
    it('should return profile successfully', async () => {
      userService.getProfile.mockResolvedValueOnce({ id: 'user-1', email: 't@t.com' });
      await userController.getOwnProfile(req, res, next);
      expect(userService.getProfile).toHaveBeenCalledWith('user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { id: 'user-1', email: 't@t.com' });
    });

    it('should catch error in getOwnProfile', async () => {
      userService.getProfile.mockRejectedValueOnce(new Error('fail'));
      await userController.getOwnProfile(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      req.body = { displayName: 'New Name' };
      userService.updateProfile.mockResolvedValueOnce({ id: 'user-1', displayName: 'New Name' });
      await userController.updateProfile(req, res, next);
      expect(userService.updateProfile).toHaveBeenCalledWith('user-1', { displayName: 'New Name' });
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { id: 'user-1', displayName: 'New Name' });
    });

    it('should catch error in updateProfile', async () => {
      userService.updateProfile.mockRejectedValueOnce(new Error('fail'));
      await userController.updateProfile(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getPublicProfile', () => {
    it('should return public profile', async () => {
      req.params.id = 'user-2';
      userService.getPublicProfile.mockResolvedValueOnce({ id: 'user-2' });
      await userController.getPublicProfile(req, res, next);
      expect(sendSuccess).toHaveBeenCalled();
    });

    it('should catch error in getPublicProfile', async () => {
      userService.getPublicProfile.mockRejectedValueOnce(new Error('fail'));
      await userController.getPublicProfile(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('should search users with query params', async () => {
      req.query = { q: 'react', type: 'offer', page: 1 };
      userService.searchUsers.mockResolvedValueOnce({ results: [] });
      await userController.searchUsers(req, res, next);
      expect(userService.searchUsers).toHaveBeenCalledWith('react', expect.objectContaining({ type: 'offer' }));
      expect(sendSuccess).toHaveBeenCalled();
    });

    it('should catch error in searchUsers', async () => {
      userService.searchUsers.mockRejectedValueOnce(new Error('fail'));
      await userController.searchUsers(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences', async () => {
      req.body = { emailEnabled: true };
      await userController.updateNotificationPreferences(req, res, next);
      expect(userService.updateNotificationPreferences).toHaveBeenCalledWith('user-1', { emailEnabled: true });
      expect(sendSuccess).toHaveBeenCalled();
    });

    it('should catch error in updateNotificationPreferences', async () => {
      userService.updateNotificationPreferences.mockRejectedValueOnce(new Error('fail'));
      await userController.updateNotificationPreferences(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('addSkill', () => {
    it('should add skill successfully', async () => {
      req.body = { skillId: 's1', type: 'offer' };
      userService.addSkill.mockResolvedValueOnce({ id: 'us1' });
      await userController.addSkill(req, res, next);
      expect(userService.addSkill).toHaveBeenCalledWith('user-1', req.body);
      expect(sendSuccess).toHaveBeenCalledWith(res, 201, expect.any(String), { id: 'us1' });
    });

    it('should catch error in addSkill', async () => {
      userService.addSkill.mockRejectedValueOnce(new Error('fail'));
      await userController.addSkill(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('removeSkill', () => {
    it('should remove skill successfully', async () => {
      req.params.id = 'us1';
      await userController.removeSkill(req, res, next);
      expect(userService.removeSkill).toHaveBeenCalledWith('user-1', 'us1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String));
    });

    it('should catch error in removeSkill', async () => {
      userService.removeSkill.mockRejectedValueOnce(new Error('fail'));
      await userController.removeSkill(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('addAvailabilitySlot', () => {
    it('should add slot successfully', async () => {
      req.body = { dayOfWeek: 1, slotStart: '09:00', slotEnd: '10:00' };
      userService.addAvailabilitySlot.mockResolvedValueOnce({ id: 'slot1' });
      await userController.addAvailabilitySlot(req, res, next);
      expect(sendSuccess).toHaveBeenCalledWith(res, 201, expect.any(String), { id: 'slot1' });
    });

    it('should catch error in addAvailabilitySlot', async () => {
      userService.addAvailabilitySlot.mockRejectedValueOnce(new Error('fail'));
      await userController.addAvailabilitySlot(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
