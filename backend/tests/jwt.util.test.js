const jwt = require('jsonwebtoken');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt.util');
const { envConfig } = require('../config/env.config');

describe('jwt.util', () => {
  const payload = { id: 'user-1' };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = jwt.verify(token, envConfig.JWT_SECRET);
      expect(decoded.id).toBe(payload.id);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token with jti', () => {
      const token = generateRefreshToken(payload);
      const decoded = jwt.verify(token, envConfig.JWT_REFRESH_SECRET);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.jti).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(payload.id);
    });

    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(payload);
      const decoded = verifyToken(token, true);
      expect(decoded.id).toBe(payload.id);
    });

    it('should throw 401 for invalid signature', () => {
      const token = generateAccessToken(payload);
      const invalidToken = token + 'wrong';
      try {
        verifyToken(invalidToken);
        fail('Should have thrown');
      } catch (error) {
        expect(error.statusCode).toBe(401);
        expect(error.message).toBe('Invalid token signature');
      }
    });

    it('should throw 401 for expired token', () => {
      const expiredToken = jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn: '0s' });
      try {
        verifyToken(expiredToken);
        fail('Should have thrown');
      } catch (error) {
        expect(error.statusCode).toBe(401);
        expect(error.errorCode).toBe('INVALID_TOKEN');
      }
    });

    it('should throw original error for non-JWT errors', () => {
      // Mocking jwt.verify to throw a different error
      const spy = jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
        throw new Error('Other error');
      });
      try {
        verifyToken('anything');
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Other error');
      }
      spy.mockRestore();
    });
  });
});
