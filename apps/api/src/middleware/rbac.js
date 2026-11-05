const { sendError } = require('../utils/response');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 'User not authenticated', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        'Forbidden: Access Denied',
        `Role '${req.user.role}' is not authorized to access this resource. Allowed: [${allowedRoles.join(', ')}]`,
        403
      );
    }

    next();
  };
};

module.exports = authorize;

