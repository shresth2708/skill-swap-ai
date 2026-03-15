const { sendError } = require('../utils/response.util');

/**
 * Centralized error handler
 * Captures all unhandled errors and formats them into a standardized JSON response
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';
  const details = process.env.NODE_ENV === 'development' ? err.stack : null;

  sendError(res, statusCode, errorCode, message, details);
};

module.exports = errorHandler;
