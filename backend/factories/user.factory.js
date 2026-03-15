/**
 * Factory pattern for creating user database inputs
 * Applies OCP and SRP by isolating user entity creation rules.
 */
class UserFactory {
  /**
   * Creates a default user creation payload
   * @param {Object} dto - Data transfer object containing raw user input
   * @param {string} hashedPassword - The hashed password
   * @returns {Object} Prisma user create input
   */
  static createRegularUser(dto, hashedPassword) {
    return {
      email: dto.email,
      passwordHash: hashedPassword,
      isActive: true,
      isVerified: false,
      profile: {
        create: {
          displayName: dto.displayName || dto.email.split('@')[0],
        }
      }
    };
  }

  /**
   * Creates an admin user creation payload
   * @param {Object} dto - Data transfer object
   * @param {string} hashedPassword - The hashed password
   * @returns {Object} Prisma user create input
   */
  static createAdminUser(dto, hashedPassword) {
    return {
      email: dto.email,
      passwordHash: hashedPassword,
      isActive: true,
      isVerified: true, // Auto verify admins
      profile: {
        create: {
          displayName: dto.displayName || 'Admin',
        }
      }
    };
  }

  /**
   * Creates a guest user schema
   * @returns {Object} Prisma user create input
   */
  static createGuestUser() {
    const guestId = `guest_${Date.now()}`;
    return {
      email: `${guestId}@guest.skillswap.local`,
      passwordHash: 'none', // Handle carefully downstream
      isActive: true,
      isVerified: false,
      profile: {
        create: {
          displayName: 'Guest User',
        }
      }
    };
  }

  /**
   * Create user from OAuth
   * @param {string} provider - OAuth provider (e.g., 'google')
   * @param {Object} tokenData - Data from OAuth token
   * @returns {Object} Prisma user create input
   */
  static fromOAuth(provider, tokenData) {
    return {
      email: tokenData.email,
      passwordHash: `oauth_${provider}`, // Usually an actual OAuth provider handles this differently
      isActive: true,
      isVerified: true, // Assumed verified via OAuth
      profile: {
        create: {
          displayName: tokenData.name,
          avatarUrl: tokenData.picture,
        }
      }
    };
  }
}

module.exports = UserFactory;
