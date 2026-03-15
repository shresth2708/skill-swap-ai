const { verifyToken } = require('../utils/jwt.util');
const { sendError } = require('../utils/response.util');

/**
 * Middleware to verify JWT and attach user payload to the request
 */
const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'UNAUTHORIZED', 'No token provided or invalid format');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token, false);
    req.user = decoded; // Attach user info across the request lifecycle
    next();
  } catch (err) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Token is invalid or expired', err.message);
  }
};

module.exports = {
  verifyAccessToken
};
