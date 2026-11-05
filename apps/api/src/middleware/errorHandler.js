const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error('[Error Details]', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return sendError(res, 'Mongoose Validation Error', messages.join(', '), 422);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return sendError(res, `Duplicate entry for ${field}`, `Record with this ${field} already exists.`, 409);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid Token', err.message, 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token Expired', 'Session expired. Please log in again.', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(res, message, process.env.NODE_ENV === 'development' ? err.stack : undefined, statusCode);
};

module.exports = errorHandler;
