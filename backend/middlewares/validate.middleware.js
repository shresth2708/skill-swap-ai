const { sendError } = require('../utils/response.util');

/**
 * Middleware factory to validate request body against a Zod schema
 * @param {import('zod').ZodSchema} schema 
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Validation failed', error.errors);
    }
    next(error);
  }
};

module.exports = {
  validateBody
};
