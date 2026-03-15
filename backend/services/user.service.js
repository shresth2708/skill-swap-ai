const prisma = require('../config/db.config'); // Fallback if we need specific raw queries, but try to use repo
const defaultUserRepository = require('../repositories/user.repository');
const { invalidateMatchesCacheGlobally } = require('./matching.service');

/**
 * Encapsulates the core business logic for user profiles, skills, and availability.
 * Follows the Dependency Inversion Principle mapping to an interface abstraction representation.
 */
class UserService {
  /**
   * @param {import('../repositories/user.repository.js').IUserRepository} userRepository 
   */
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async getProfile(userId) {
    const user = await this.userRepository.findWithSkillsAndAvailability(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      error.errorCode = 'USER_NOT_FOUND';
      throw error;
    }
    
    // Safety check - never return password
    delete user.passwordHash;
    return user;
  }

  async getPublicProfile(userId) {
    const user = await this.getProfile(userId);
    
    // Abstract public profile safe DTO shape
    return {
      id: user.id,
      email: user.email, // Depending on privacy settings, you might want to hide this
      isActive: user.isActive,
      avgRating: user.avgRating,
      totalSwaps: user.totalSwaps,
      profile: user.profile,
      skills: user.skills, // Publicly visible skills
      availabilitySlots: user.availabilitySlots
    };
  }

  async updateProfile(userId, dto) {
    // Basic verification
    await this.getProfile(userId);

    await this.userRepository.updateProfile(userId, {
      displayName: dto.displayName,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
      location: dto.location,
      timezone: dto.timezone
    });

    await invalidateMatchesCacheGlobally();
    return await this.getProfile(userId);
  }

  async updateNotificationPreferences(userId, dto) {
    await this.getProfile(userId);

    await this.userRepository.updateProfile(userId, {
      notifyEmail: dto.notifyEmail,
      notifyPush: dto.notifyPush,
      notifyInApp: dto.notifyInApp,
    });

    return await this.getProfile(userId);
  }

  async addSkill(userId, skillDto) {
    try {
      let skillId = skillDto.skillId;

      // If no skillId provided but a name is given, find or create the skill
      if (!skillId && skillDto.name) {
        const skillName = skillDto.name.trim();

        // Try to find an existing skill by name (case-insensitive)
        let skill = await prisma.skill.findFirst({
          where: { name: { equals: skillName, mode: 'insensitive' } }
        });

        if (!skill) {
          // Get or create a default "General" category for user-created skills
          let category = await prisma.skillCategory.findUnique({
            where: { name: 'General' }
          });

          if (!category) {
            category = await prisma.skillCategory.create({
              data: { name: 'General' }
            });
          }

          skill = await prisma.skill.create({
            data: { name: skillName, categoryId: category.id }
          });
        }

        skillId = skill.id;
      }

      const newSkill = await this.userRepository.createUserSkill({
        userId,
        skillId,
        type: skillDto.type,
        proficiencyLevel: skillDto.proficiencyLevel,
        description: skillDto.description
      });
      await invalidateMatchesCacheGlobally();
      return newSkill;
    } catch (e) {
      if (e.code === 'P2002') {
        const error = new Error('Skill mapping already exists');
        error.statusCode = 409;
        throw error;
      }
      // Catch FK violation representing non-existent skill
      if (e.code === 'P2003') {
        const error = new Error('Invalid skill ID provided');
        error.statusCode = 400;
        throw error;
      }
      throw e;
    }
  }

  async removeSkill(userId, userSkillId) {
    const userSkill = await this.userRepository.findUserSkillById(userSkillId);
    if (!userSkill) {
      const error = new Error('Skill mapping not found');
      error.statusCode = 404;
      throw error;
    }

    if (userSkill.userId !== userId) {
      const error = new Error('Forbidden action');
      error.statusCode = 403;
      throw error;
    }

    await this.userRepository.deleteUserSkill(userSkillId);
    await invalidateMatchesCacheGlobally();
  }

  async updateSkillLevel(userId, userSkillId, level) {
    const userSkill = await this.userRepository.findUserSkillById(userSkillId);
    if (!userSkill) {
      const error = new Error('Skill mapping not found');
      error.statusCode = 404;
      throw error;
    }

    if (userSkill.userId !== userId) {
      const error = new Error('Forbidden action');
      error.statusCode = 403;
      throw error;
    }

    const out = await this.userRepository.updateUserSkillLevel(userSkillId, level);
    await invalidateMatchesCacheGlobally();
    return out;
  }

  async addAvailabilitySlot(userId, slotDto) {
    const start = new Date(slotDto.slotStart);
    const end = new Date(slotDto.slotEnd);
    
    // Check if slot overlaps midnight (end time is before or same as start time)
    if (start.getTime() >= end.getTime()) {
      const error = new Error('Availability slot cannot span across midnight or have invalid time range');
      error.statusCode = 400;
      throw error;
    }

    // Optionally check if slot perfectly overlaps here 
    // Basic constraint: valid times
    const slot = await this.userRepository.createAvailabilitySlot({
      userId,
      dayOfWeek: slotDto.dayOfWeek,
      slotStart: slotDto.slotStart, // Assuming strictly checked schema date string format (e.g. 1970-01-01T14:30:00.000Z)
      slotEnd: slotDto.slotEnd,
      isRecurring: slotDto.isRecurring
    });
    await invalidateMatchesCacheGlobally();
    return slot;
  }

  async bulkUpdateAvailability(userId, availabilityMap) {
    const dayMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    const slotTimes = {
      'Morning':   { start: '1970-01-01T08:00:00.000Z', end: '1970-01-01T12:00:00.000Z' },
      'Afternoon': { start: '1970-01-01T12:00:00.000Z', end: '1970-01-01T17:00:00.000Z' },
      'Evening':   { start: '1970-01-01T17:00:00.000Z', end: '1970-01-01T21:00:00.000Z' }
    };

    const slots = [];
    for (const [day, daySlots] of Object.entries(availabilityMap)) {
      const dayIndex = dayMap[day];
      if (dayIndex === undefined) continue;

      for (const slotName of daySlots) {
        const times = slotTimes[slotName];
        if (times) {
          slots.push({
            userId,
            dayOfWeek: dayIndex,
            slotStart: new Date(times.start),
            slotEnd: new Date(times.end),
            isRecurring: true
          });
        }
      }
    }

    await this.userRepository.replaceAvailabilitySlots(userId, slots);
    await invalidateMatchesCacheGlobally();
    return await this.getProfile(userId);
  }

  async removeAvailabilitySlot(userId, slotId) {
    const slot = await this.userRepository.findAvailabilitySlotById(slotId);
    if (!slot) {
      const error = new Error('Slot not found');
      error.statusCode = 404;
      throw error;
    }

    if (slot.userId !== userId) {
      const error = new Error('Forbidden action');
      error.statusCode = 403;
      throw error;
    }

    await this.userRepository.deleteAvailabilitySlot(slotId);
    await invalidateMatchesCacheGlobally();
  }

  async searchUsers(query, filters) {
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { users, total } = await this.userRepository.searchUsers(query, filters.type, skip, limit);
    
    // Abstract shapes to omit passhashes before transport
    const safeUsers = users.map(user => {
      delete user.passwordHash;
      return user;
    });

    return {
      data: safeUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

// Inject dependency
module.exports = new UserService(defaultUserRepository);
