const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response.util');

class AuthController {
  constructor() {
    const methods = Object.getOwnPropertyNames(AuthController.prototype)
      .filter(m => m !== 'constructor');
    for (const m of methods) {
      if (typeof this[m] === 'function') {
        this[m] = this[m].bind(this);
      }
    }
  }

  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      return sendSuccess(res, 201, 'User registered successfully', data);
    } catch (error) {
      if (error.errorCode === 'DUPLICATE_EMAIL') {
        return sendError(res, error.statusCode, error.errorCode, error.message);
      }
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const data = await authService.login(req.body);
      return sendSuccess(res, 200, 'Logged in successfully', data);
    } catch (error) {
      if (error.errorCode === 'INVALID_CREDENTIALS') {
        return sendError(res, error.statusCode, error.errorCode, error.message);
      }
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const data = await authService.refreshToken(refreshToken);
      return sendSuccess(res, 200, 'Token refreshed successfully', data);
    } catch (error) {
      return sendError(res, error.statusCode || 401, 'INVALID_TOKEN', error.message);
    }
  }

  async logout(req, res, next) {
    try {
      // Assuming userId is attached via auth middleware if we are securing the logout route
      // or we extract it from the refresh token
      await authService.logout(req.user.id);
      return sendSuccess(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      return sendSuccess(res, 200, 'If that email exists, a reset link has been sent.');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      return sendSuccess(res, 200, 'Password has been reset successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
