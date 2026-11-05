const authService = require('./auth.service');
const { sendSuccess, sendError } = require('../../utils/response');

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return sendSuccess(res, 'Login successful', result);
    } catch (error) {
      return sendError(res, error.message, null, 401);
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, 'Refresh token is required', null, 400);
      }
      const tokens = await authService.refreshToken(refreshToken);
      return sendSuccess(res, 'Token refreshed successfully', tokens);
    } catch (error) {
      return sendError(res, error.message, null, 401);
    }
  }

  async getProfile(req, res) {
    return sendSuccess(res, 'Profile retrieved', req.user);
  }
}

module.exports = new AuthController();

