const prisma = require('../../config/db.config');
const userRepository = require('../../repositories/user.repository');

jest.mock('../../config/db.config', () => ({
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  profile: {
    update: jest.fn(),
  },
  userSkill: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  availabilitySlot: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Operations', () => {
    it('createUserWithProfile calls prisma.create', async () => {
      prisma.user.create.mockResolvedValue({ id: 'u1' });
      await userRepository.createUserWithProfile({ email: 'test@test.com' });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: 'test@test.com' },
        include: { profile: true }
      });
    });

    it('findByEmail calls prisma.findUnique', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await userRepository.findByEmail('test@test.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        include: { profile: true }
      });
    });

    it('findById calls prisma.findUnique with skills', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await userRepository.findById('u1');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'u1' }
      }));
    });

    it('findWithSkillsAndAvailability calls prisma.findUnique', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await userRepository.findWithSkillsAndAvailability('u1');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        include: expect.objectContaining({ availabilitySlots: true })
      }));
    });

    it('updatePassword calls prisma.update', async () => {
      prisma.user.update.mockResolvedValue({});
      await userRepository.updatePassword('u1', 'hash');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('Profile Operations', () => {
    it('updateProfile calls prisma.profile.update', async () => {
      prisma.profile.update.mockResolvedValue({});
      await userRepository.updateProfile('u1', { bio: 'hello' });
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        data: { bio: 'hello' }
      });
    });
  });

  describe('UserSkill Operations', () => {
    it('createUserSkill calls prisma.userSkill.create', async () => {
      prisma.userSkill.create.mockResolvedValue({});
      await userRepository.createUserSkill({ userId: 'u1' });
      expect(prisma.userSkill.create).toHaveBeenCalled();
    });

    it('findUserSkillById calls prisma.findUnique', async () => {
      prisma.userSkill.findUnique.mockResolvedValue({});
      await userRepository.findUserSkillById('s1');
      expect(prisma.userSkill.findUnique).toHaveBeenCalled();
    });

    it('deleteUserSkill calls prisma.delete', async () => {
      prisma.userSkill.delete.mockResolvedValue({});
      await userRepository.deleteUserSkill('s1');
      expect(prisma.userSkill.delete).toHaveBeenCalled();
    });

    it('updateUserSkillLevel calls prisma.update', async () => {
      prisma.userSkill.update.mockResolvedValue({});
      await userRepository.updateUserSkillLevel('s1', 'advanced');
      expect(prisma.userSkill.update).toHaveBeenCalled();
    });
  });

  describe('AvailabilitySlot Operations', () => {
    it('createAvailabilitySlot calls prisma.create', async () => {
      prisma.availabilitySlot.create.mockResolvedValue({});
      await userRepository.createAvailabilitySlot({ dayOfWeek: 1 });
      expect(prisma.availabilitySlot.create).toHaveBeenCalled();
    });

    it('findAvailabilitySlotById calls prisma.findUnique', async () => {
      prisma.availabilitySlot.findUnique.mockResolvedValue({});
      await userRepository.findAvailabilitySlotById('as1');
      expect(prisma.availabilitySlot.findUnique).toHaveBeenCalled();
    });

    it('deleteAvailabilitySlot calls prisma.delete', async () => {
      prisma.availabilitySlot.delete.mockResolvedValue({});
      await userRepository.deleteAvailabilitySlot('as1');
      expect(prisma.availabilitySlot.delete).toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('builds where clause with searchQuery and typeFilter', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await userRepository.searchUsers('java', 'offer', 0, 10);

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
            expect.objectContaining({ skills: expect.any(Object) })
          ])
        })
      }));
    });

    it('works without filters', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);
      await userRepository.searchUsers(null, null, 0, 10);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true }
      }));
    });
  });

  describe('RefreshToken Operations', () => {
    it('saveRefreshToken calls prisma.create', async () => {
      prisma.refreshToken.create.mockResolvedValue({});
      await userRepository.saveRefreshToken('u1', 'token', new Date());
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('findRefreshToken calls prisma.findUnique', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({});
      await userRepository.findRefreshToken('token');
      expect(prisma.refreshToken.findUnique).toHaveBeenCalled();
    });

    it('revokeRefreshToken calls prisma.updateMany', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({});
      await userRepository.revokeRefreshToken('u1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });
});
