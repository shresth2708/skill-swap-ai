const authService = require('../services/auth.service');
const userRepository = require('../repositories/user.repository');
const { hashString, compareHash } = require('../utils/hash.util');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt.util');

// Mock dependencies
jest.mock('../repositories/user.repository');
jest.mock('../utils/hash.util');
jest.mock('../utils/jwt.util');
jest.mock('../factories/user.factory', () => ({
  createRegularUser: jest.fn().mockImplementation((dto, hash) => ({ ...dto, passwordHash: hash }))
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register()', () => {
    it('should register a new user successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      hashString.mockResolvedValue('hashedPass');
      userRepository.createUserWithProfile.mockResolvedValue({ id: 1, email: 'test@test.com' });
      generateAccessToken.mockReturnValue('at');
      generateRefreshToken.mockReturnValue('rt');

      const result = await authService.register({ email: 'test@test.com', password: 'pw' });
      expect(result.accessToken).toBe('at');
    });

    it('should throw 409 for duplicate email', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 1 });
      await expect(authService.register({ email: 'test@test.com' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('login()', () => {
    it('should login valid credentials successfully', async () => {
      const mockUser = { id: 1, email: 'test@test.com', passwordHash: 'hashedPass' };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      compareHash.mockResolvedValue(true);
      generateAccessToken.mockReturnValue('at');
      generateRefreshToken.mockReturnValue('rt');

      const result = await authService.login({ email: 'test@test.com', password: 'pw' });
      expect(result.accessToken).toBe('at');
    });

    it('should throw 401 for wrong password', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 1, passwordHash: 'h' });
      compareHash.mockResolvedValue(false);
      await expect(authService.login({ email: 't@t.com', password: 'p' })).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      await expect(authService.login({ email: 't@t.com', password: 'p' })).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('refreshToken()', () => {
    it('should throw 400 if token is missing', async () => {
      await expect(authService.refreshToken(null)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 401 if record is missing or invalid', async () => {
      userRepository.findRefreshToken.mockResolvedValue(null);
      await expect(authService.refreshToken('bad')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 if record is expired', async () => {
      userRepository.findRefreshToken.mockResolvedValue({ expiresAt: new Date(0) });
      await expect(authService.refreshToken('expired')).rejects.toMatchObject({ statusCode: 401 });
    });
    
    it('should verify token and issue new access token', async () => {
      userRepository.findRefreshToken.mockResolvedValue({ expiresAt: new Date(Date.now() + 100000), isRevoked: false });
      verifyToken.mockReturnValue({ id: 'u1', email: 'u1@t.com' });
      generateAccessToken.mockReturnValue('new-at');
      
      const result = await authService.refreshToken('valid-rt');
      expect(result.accessToken).toBe('new-at');
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('should handle forgotPassword (mock)', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'u1' });
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await authService.forgotPassword('u1@t.com');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Send this token'));
      spy.mockRestore();
    });

    it('should return early if user not found in forgotPassword', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      await authService.forgotPassword('none@t.com');
      expect(userRepository.findByEmail).toHaveBeenCalled();
    });

    it('should handle resetPassword (mock)', async () => {
      hashString.mockResolvedValue('new-hash');
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await authService.resetPassword('token123', 'new-pass');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Resetting password'), expect.anything());
      spy.mockRestore();
    });
  });

  describe('logout()', () => {
    it('should revoke token', async () => {
      await authService.logout('u1');
      expect(userRepository.revokeRefreshToken).toHaveBeenCalledWith('u1');
    });
  });
});
