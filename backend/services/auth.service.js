const userRepository = require('../repositories/user.repository');
const UserFactory = require('../factories/user.factory');
const { hashString, compareHash } = require('../utils/hash.util');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt.util');

class AuthService {
  async register(dto) {
    const existingUser = await userRepository.findByEmail(dto.email);
    if (existingUser) {
      const error = new Error('Email already in use');
      error.statusCode = 409;
      error.errorCode = 'DUPLICATE_EMAIL';
      throw error;
    }

    const hashedPassword = await hashString(dto.password);
    const userRolePayload = UserFactory.createRegularUser(dto, hashedPassword);
    const newUser = await userRepository.createUserWithProfile(userRolePayload);

    return this.#generateAuthResponse(newUser);
  }

  async login(credentials) {
    const user = await userRepository.findByEmail(credentials.email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isMatch = await compareHash(credentials.password, user.passwordHash);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      error.errorCode = 'INVALID_CREDENTIALS';
      throw error;
    }

    return this.#generateAuthResponse(user);
  }

  async refreshToken(token) {
    if (!token) {
      const error = new Error('Refresh token is required');
      error.statusCode = 400;
      throw error;
    }

    const record = await userRepository.findRefreshToken(token);
    if (!record || record.isRevoked || record.expiresAt < new Date()) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    // Verify cryptographic validity
    const decoded = verifyToken(token, true);

    // Issue new access token
    const accessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    return { accessToken };
  }

  async logout(userId) {
    await userRepository.revokeRefreshToken(userId);
  }

  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Avoid revealing if user exists
      return; 
    }

    // In a real implementation: Generate reset token -> store hash in DB -> send email
    // For this boilerplate:
    const resetToken = 'mock_reset_token_' + Date.now();
    console.log(`[Mock] Send this token to ${email}: ${resetToken}`);
    // A reset entity or adding token fields to DB would typically be done here
  }

  async resetPassword(token, newPass) {
    // In a real implementation: Validate token -> update hash
    // Example: verify token against DB record
    // userRepository.updatePassword(userId, newHashedPassword)
    console.log('Resetting password for token:', token);
    const hashedPassword = await hashString(newPass);
    // await userRepository.updatePassword(targetUserId, hashedPassword);
  }

  // Private helper to issue tokens
  async #generateAuthResponse(user) {
    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Calculate approx 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

    // Remove sensitive data
    const userResponse = { ...user };
    delete userResponse.passwordHash;

    return {
      user: userResponse,
      accessToken,
      refreshToken
    };
  }
}

module.exports = new AuthService();
