const prisma = require('../config/db.config');

/**
 * @typedef {Object} IUserRepository
 * @property {function} createUserWithProfile
 * @property {function} findById
 * @property {function} findByEmail
 * @property {function} findWithSkillsAndAvailability
 * @property {function} updateProfile
 * @property {function} createUserSkill
 * @property {function} findUserSkillById
 * @property {function} deleteUserSkill
 * @property {function} updateUserSkillLevel
 * @property {function} createAvailabilitySlot
 * @property {function} findAvailabilitySlotById
 * @property {function} deleteAvailabilitySlot
 * @property {function} searchUsers
 */

/**
 * Encapsulates database queries for the User model.
 * Adheres to SRP by handling only DB operations.
 * Implements IUserRepository
 */
class UserRepository {
  async createUserWithProfile(createInput) {
    return await prisma.user.create({
      data: createInput,
      include: { profile: true }
    });
  }

  async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
  }

  async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        skills: {
          include: { skill: true }
        }
      }
    });
  }

  async findWithSkillsAndAvailability(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        skills: {
          include: { skill: true }
        },
        availabilitySlots: true
      }
    });
  }

  async updatePassword(id, passwordHash) {
    return await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });
  }

  async updateProfile(userId, profileData) {
    return await prisma.profile.update({
      where: { userId },
      data: profileData
    });
  }

  async createUserSkill(data) {
    return await prisma.userSkill.create({
      data,
      include: { skill: true }
    });
  }

  async findUserSkillById(id) {
    return await prisma.userSkill.findUnique({
      where: { id }
    });
  }

  async deleteUserSkill(id) {
    return await prisma.userSkill.delete({
      where: { id }
    });
  }

  async updateUserSkillLevel(id, proficiencyLevel) {
    return await prisma.userSkill.update({
      where: { id },
      data: { proficiencyLevel }
    });
  }

  async createAvailabilitySlot(data) {
    return await prisma.availabilitySlot.create({
      data
    });
  }

  async findAvailabilitySlotById(id) {
    return await prisma.availabilitySlot.findUnique({
      where: { id }
    });
  }

  async deleteAvailabilitySlot(id) {
    return await prisma.availabilitySlot.delete({
      where: { id }
    });
  }

  async replaceAvailabilitySlots(userId, slots) {
    return await prisma.$transaction([
      prisma.availabilitySlot.deleteMany({ where: { userId } }),
      prisma.availabilitySlot.createMany({ data: slots })
    ]);
  }

  /**
   * Search users by displayName and skills
   */
  async searchUsers(searchQuery, typeFilter, skip, take) {
    // Prisma full-text search or basic wildcard matching. 
    // For simplicity and broad compatibility across postgres setups without specific indices, 
    // we use `contains` with `mode: 'insensitive'`.

    const whereClause = {
      isActive: true
    };

    if (searchQuery || typeFilter) {
      whereClause.AND = [];
      const OR = [];

      if (searchQuery) {
        OR.push({
          profile: {
            displayName: { contains: searchQuery, mode: 'insensitive' }
          }
        });
        OR.push({
          profile: {
            bio: { contains: searchQuery, mode: 'insensitive' }
          }
        });
        OR.push({
          skills: {
            some: {
              skill: { name: { contains: searchQuery, mode: 'insensitive' } }
            }
          }
        });
      }

      if (OR.length > 0) {
        whereClause.AND.push({ OR });
      }

      if (typeFilter) {
        whereClause.AND.push({
          skills: {
            some: { type: typeFilter } // 'offer' or 'want'
          }
        });
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          profile: true,
          skills: { include: { skill: true } },
          availabilitySlots: true
        },
        skip,
        take,
      }),
      prisma.user.count({ where: whereClause })
    ]);

    return { users, total };
  }

  // Refresh token management
  async saveRefreshToken(userId, token, expiresAt) {
    return await prisma.refreshToken.create({
      data: { userId, token, expiresAt }
    });
  }

  async findRefreshToken(token) {
    return await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true }
    });
  }

  async revokeRefreshToken(userId) {
    return await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
  }
}

module.exports = new UserRepository();
