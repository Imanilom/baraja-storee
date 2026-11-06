const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const User = require('../modules/users/user.model');
const { sendError } = require('../utils/response');

const authenticate = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return sendError(res, 'Authentication required', 'No Bearer token provided in Authorization header or query parameter', 401);
    }
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password_hash');
    if (!user || !user.is_active) {
      return sendError(res, 'Unauthorized', 'User does not exist or has been deactivated', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token Expired', 'Session expired. Please refresh your token.', 401);
    }
    return sendError(res, 'Invalid Token', error.message, 401);
  }
};

module.exports = authenticate;

