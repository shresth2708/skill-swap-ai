const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');
const logger = require('../utils/logger');

const env = global.process?.env || {};
const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const maxRequests = Number(env.RATE_LIMIT_MAX || 100);
const disabled = String(env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';

const authRateLimiter = disabled
  ? (req, res, next) => next()
  : rateLimit({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, _next, options) => {
        const windowMin = Math.round(windowMs / 60_000);
        logger.warn('Rate limit exceeded', {
          method: req.method,
          path: req.originalUrl || req.url,
          ip: req.ip,
          max: maxRequests,
          windowMinutes: windowMin,
          limit: options.limit,
        });
        sendError(res, options.statusCode, 'TOO_MANY_REQUESTS', options.message);
      },
    });

module.exports = authRateLimiter;
