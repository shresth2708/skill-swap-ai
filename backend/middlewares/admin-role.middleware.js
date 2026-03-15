const { sendError } = require('../utils/response.util');
const logger = require('../utils/logger');

// Simple admin role check
const isAdmin = (req, res, next) => {
  // In a real app, this would check req.user.role from the DB.
  // For now, assuming all users accessing this route might not be admins unless configured.
  // We'll mock the check by letting it pass if role is 'admin' or email is registered.
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (req.user && adminEmails.includes(req.user.email)) {
    return next();
  }

  logger.warn('Forbidden admin access attempt', { userId: req.user?.id });
  return sendError(res, 403, 'Forbidden: Admin access required', 'FORBIDDEN_ACCESS');
};

module.exports = { isAdmin };