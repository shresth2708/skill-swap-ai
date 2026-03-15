const authController = require('../controllers/auth.controller');
const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/response.util');

jest.mock('../services/auth.service');
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));

describe('AuthController', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: { id: 'user-1' } };
    res = {};
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register successfully', async () => {
      req.body = { email: 't@t.com', password: '123' };
      authService.register.mockResolvedValueOnce({ id: 'u1' });
      await authController.register(req, res, next);
      expect(sendSuccess).toHaveBeenCalledWith(res, 201, expect.any(String), { id: 'u1' });
    });

    it('should handle duplicate email error', async () => {
      const err = new Error('Email exists');
      err.errorCode = 'DUPLICATE_EMAIL';
      err.statusCode = 409;
      authService.register.mockRejectedValueOnce(err);
      await authController.register(req, res, next);
      expect(sendError).toHaveBeenCalledWith(res, 409, 'DUPLICATE_EMAIL', 'Email exists');
    });

    it('should pass generic error to next', async () => {
      const err = new Error('Internal');
      authService.register.mockRejectedValueOnce(err);
      await authController.register(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      authService.login.mockResolvedValueOnce({ accessToken: 'at' });
      await authController.login(req, res, next);
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { accessToken: 'at' });
    });

    it('should pass generic error to next', async () => {
      const err = new Error('Fail');
      authService.login.mockRejectedValueOnce(err);
      await authController.login(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      req.body.refreshToken = 'rt';
      authService.refreshToken.mockResolvedValueOnce({ accessToken: 'at2' });
      await authController.refreshToken(req, res, next);
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { accessToken: 'at2' });
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await authController.logout(req, res, next);
      expect(authService.logout).toHaveBeenCalledWith('user-1');
      expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String));
    });

    it('should handle logout error', async () => {
      authService.logout.mockRejectedValueOnce(new Error('fail'));
      await authController.logout(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should call service for forgot password', async () => {
      req.body.email = 't@t.com';
      await authController.forgotPassword(req, res, next);
      expect(authService.forgotPassword).toHaveBeenCalledWith('t@t.com');
      expect(sendSuccess).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      req.body = { token: 'tok', newPassword: 'new' };
      await authController.resetPassword(req, res, next);
      expect(authService.resetPassword).toHaveBeenCalledWith('tok', 'new');
      expect(sendSuccess).toHaveBeenCalled();
    });
  });
});
