const authController = require('../../controllers/auth.controller');
const authService = require('../../services/auth.service');

jest.mock('../../services/auth.service');

describe('AuthController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: { id: 'u1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('register', () => {
    it('success', async () => {
      authService.register.mockResolvedValue({});
      await authController.register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('handles DUPLICATE_EMAIL', async () => {
      const err = new Error('Email exists');
      err.errorCode = 'DUPLICATE_EMAIL';
      err.statusCode = 409;
      authService.register.mockRejectedValue(err);
      await authController.register(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('passes generic error to next', async () => {
      authService.register.mockRejectedValue(new Error('kaboom'));
      await authController.register(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('success', async () => {
      authService.login.mockResolvedValue({});
      await authController.login(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles INVALID_CREDENTIALS', async () => {
      const err = new Error('Bad creds');
      err.errorCode = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      authService.login.mockRejectedValue(err);
      await authController.login(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('refreshToken', () => {
    it('success', async () => {
      req.body = { refreshToken: 'rt' };
      authService.refreshToken.mockResolvedValue({});
      await authController.refreshToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles refresh error', async () => {
      authService.refreshToken.mockRejectedValue(new Error('expired'));
      await authController.refreshToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  it('logout success', async () => {
    await authController.logout(req, res, next);
    expect(authService.logout).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('forgotPassword success', async () => {
    await authController.forgotPassword(req, res, next);
    expect(authService.forgotPassword).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resetPassword success', async () => {
    await authController.resetPassword(req, res, next);
    expect(authService.resetPassword).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
