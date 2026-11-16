const { timingSafeEqual } = require('crypto');

module.exports = function integrationAuth(req, res, next) {
  const secret = process.env.BARAJA_STORE_INTEGRATION_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Store integration is not configured' });
  }

  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const supplied = Buffer.from(token);
  const expected = Buffer.from(secret);

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ success: false, message: 'Invalid integration credentials' });
  }

  return next();
};
