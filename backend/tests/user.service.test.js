const defaultUserRepository = require('../repositories/user.repository');

jest.mock('../services/matching.service', () => {
  const actual = jest.requireActual('../services/matching.service');
  return {
    ...actual,
    invalidateMatchesCacheGlobally: jest.fn().mockResolvedValue(0),
  };
});

const userService = require('../services/user.service');

jest.mock('../repositories/user.repository');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile()', () => {
    it('should return user profile and remove passwordHash', async () => {
      const mockUser = { id: 1, email: 't@t.com', passwordHash: 'secret' };
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue(mockUser);
      
      const result = await userService.getProfile(1);
      expect(result.passwordHash).toBeUndefined();
    });

    it('should throw 404 if user not found', async () => {
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue(null);
      await expect(userService.getProfile(1)).rejects.toMatchObject({ statusCode: 404, errorCode: 'USER_NOT_FOUND' });
    });
  });

  describe('getPublicProfile()', () => {
    it('should return a stripped public profile', async () => {
      const mockUser = { id: 1, email: 't@t.com', isActive: true, profile: { bio: 'Hi' }, passwordHash: 's' };
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue(mockUser);
      
      const result = await userService.getPublicProfile(1);
      expect(result).toHaveProperty('profile');
      expect(result.passwordHash).toBeUndefined();
    });
  });

  describe('updateProfile()', () => {
    it('should update profile successfully', async () => {
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue({ id: 1, displayName: 'New' });
      defaultUserRepository.updateProfile.mockResolvedValue({ displayName: 'New' });
      
      const result = await userService.updateProfile(1, { displayName: 'New' });
      expect(result.displayName).toBe('New');
    });
  });

  describe('updateNotificationPreferences()', () => {
    it('should update preferences successfully', async () => {
      defaultUserRepository.findWithSkillsAndAvailability.mockResolvedValue({ id: 1, notifyEmail: true });
      defaultUserRepository.updateProfile.mockResolvedValue({ notifyEmail: true });
      
      const result = await userService.updateNotificationPreferences(1, { notifyEmail: true });
      expect(result.notifyEmail).toBe(true);
    });
  });

  describe('addSkill()', () => {
    const payload = { skillId: 's1', type: 'offer' };
    
    it('should add skill successfully', async () => {
      defaultUserRepository.createUserSkill.mockResolvedValue({ id: 'us1' });
      const result = await userService.addSkill(1, payload);
      expect(result.id).toBe('us1');
    });

    it('should throw 409 for P2002', async () => {
      const error = new Error('Dup'); error.code = 'P2002';
      defaultUserRepository.createUserSkill.mockRejectedValue(error);
      await expect(userService.addSkill(1, payload)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 400 for P2003', async () => {
      const error = new Error('FK'); error.code = 'P2003';
      defaultUserRepository.createUserSkill.mockRejectedValue(error);
      await expect(userService.addSkill(1, payload)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should rethrow unknown errors', async () => {
      defaultUserRepository.createUserSkill.mockRejectedValue(new Error('Unknown'));
      await expect(userService.addSkill(1, payload)).rejects.toThrow('Unknown');
    });
  });

  describe('removeSkill()', () => {
    it('should remove if owned', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 'us1', userId: 1 });
      await userService.removeSkill(1, 'us1');
      expect(defaultUserRepository.deleteUserSkill).toHaveBeenCalled();
    });

    it('should throw 403 if not owned', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 'us1', userId: 2 });
      await expect(userService.removeSkill(1, 'us1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if missing', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue(null);
      await expect(userService.removeSkill(1, 'us1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateSkillLevel()', () => {
    it('should update level successfully', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 'us1', userId: 1 });
      defaultUserRepository.updateUserSkillLevel.mockResolvedValue({ id: 'us1', proficiencyLevel: 'EXPERT' });
      const result = await userService.updateSkillLevel(1, 'us1', 'EXPERT');
      expect(result.proficiencyLevel).toBe('EXPERT');
    });

    it('should throw 403 if not owned', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue({ id: 'us1', userId: 2 });
      await expect(userService.updateSkillLevel(1, 'us1', 'EXPERT')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if missing', async () => {
      defaultUserRepository.findUserSkillById.mockResolvedValue(null);
      await expect(userService.updateSkillLevel(1, 'us1', 'EXPERT')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Availability Slots', () => {
    it('should add slot successfully', async () => {
      defaultUserRepository.createAvailabilitySlot.mockResolvedValue({ id: 'slot1' });
      const result = await userService.addAvailabilitySlot(1, { dayOfWeek: 1, slotStart: '2025-01-01T10:00:00Z', slotEnd: '2025-01-01T12:00:00Z' });
      expect(result.id).toBe('slot1');
    });

    it('should throw 400 for invalid range', async () => {
      await expect(userService.addAvailabilitySlot(1, { slotStart: '2025-01-01T12:00:00Z', slotEnd: '2025-01-01T10:00:00Z' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('should remove slot successfully', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue({ id: 'slot1', userId: 1 });
      await userService.removeAvailabilitySlot(1, 'slot1');
      expect(defaultUserRepository.deleteAvailabilitySlot).toHaveBeenCalled();
    });

    it('should throw 403 if not owned', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue({ id: 'slot1', userId: 2 });
      await expect(userService.removeAvailabilitySlot(1, 'slot1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 404 if missing', async () => {
      defaultUserRepository.findAvailabilitySlotById.mockResolvedValue(null);
      await expect(userService.removeAvailabilitySlot(1, 'slot1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('searchUsers()', () => {
    it('should return paginated results', async () => {
      defaultUserRepository.searchUsers.mockResolvedValue({ users: [{ id: 1, passwordHash: 's' }], total: 1 });
      const result = await userService.searchUsers('dev', { page: 1, limit: 10 });
      expect(result.data[0].passwordHash).toBeUndefined();
      expect(result.totalPages).toBe(1);
    });
  });
});
