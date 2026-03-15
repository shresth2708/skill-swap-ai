const jwt = require('jsonwebtoken');
const { envConfig } = require('../config/env.config');

/**
 * Generates an access token
 * @param {Object} payload - Data to encode in the token
 * @returns {string} - The JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, envConfig.JWT_SECRET, { expiresIn: '15m' });
};

const crypto = require('crypto');

/**
 * Generates a refresh token
 * @param {Object} payload - Data to encode in the token
 * @returns {string} - The JWT refresh token
 */
const generateRefreshToken = (payload) => {
  const uniquePayload = { ...payload, jti: crypto.randomUUID() };
  return jwt.sign(uniquePayload, envConfig.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

/**
 * Verifies a JWT token
 * @param {string} token - The token to verify
 * @param {boolean} isRefresh - Whether this is a refresh token
 * @returns {Object} - The decoded payload
 */
const verifyToken = (token, isRefresh = false) => {
  const secret = isRefresh ? envConfig.JWT_REFRESH_SECRET : envConfig.JWT_SECRET;
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const err = new Error(error.name === 'JsonWebTokenError' && error.message === 'invalid signature' ? 'Invalid token signature' : 'Invalid or expired token');
      err.statusCode = 401;
      err.errorCode = 'INVALID_TOKEN';
      throw err;
    }
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken
};
