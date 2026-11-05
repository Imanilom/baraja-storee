const { sendError } = require('../utils/response');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  } catch (error) {
    if (error.errors) {
      const formatted = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return sendError(res, 'Validation Error', formatted, 422);
    }
    return sendError(res, 'Invalid request data', error.message, 422);
  }
};

module.exports = validate;

