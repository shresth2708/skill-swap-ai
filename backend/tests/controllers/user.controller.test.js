const userController = require('../../controllers/user.controller');
const userService = require('../../services/user.service');

jest.mock('../../services/user.service');

describe('UserController', () => {
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

  it('getOwnProfile hits service', async () => {
    userService.getProfile.mockResolvedValue({});
    await userController.getOwnProfile(req, res, next);
    expect(userService.getProfile).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getOwnProfile handles error', async () => {
    userService.getProfile.mockRejectedValue(new Error('fail'));
    await userController.getOwnProfile(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('getPublicProfile hits service', async () => {
    req.params.id = 'u2';
    userService.getPublicProfile.mockResolvedValue({});
    await userController.getPublicProfile(req, res, next);
    expect(userService.getPublicProfile).toHaveBeenCalledWith('u2');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updateProfile hits service', async () => {
    req.body = { bio: 'hi' };
    userService.updateProfile.mockResolvedValue({});
    await userController.updateProfile(req, res, next);
    expect(userService.updateProfile).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updateNotificationPreferences hits service', async () => {
    userService.updateNotificationPreferences.mockResolvedValue({});
    await userController.updateNotificationPreferences(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('searchUsers hits service with query', async () => {
    req.query = { q: 'java', type: 'offer' };
    userService.searchUsers.mockResolvedValue([]);
    await userController.searchUsers(req, res, next);
    expect(userService.searchUsers).toHaveBeenCalledWith('java', expect.objectContaining({ type: 'offer' }));
  });

  it('addSkill hits service', async () => {
    userService.addSkill.mockResolvedValue({});
    await userController.addSkill(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('removeSkill hits service', async () => {
    req.params.id = 's1';
    await userController.removeSkill(req, res, next);
    expect(userService.removeSkill).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updateSkillLevel hits service', async () => {
    req.body = { proficiencyLevel: 'expert' };
    await userController.updateSkillLevel(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('addAvailabilitySlot hits service', async () => {
    await userController.addAvailabilitySlot(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('removeAvailabilitySlot hits service', async () => {
    await userController.removeAvailabilitySlot(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
