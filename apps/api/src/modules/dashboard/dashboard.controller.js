const dashboardService = require('./dashboard.service');
const { sendSuccess, sendError } = require('../../utils/response');

class DashboardController {
  async getMetrics(req, res) {
    try {
      const data = await dashboardService.getDashboardMetrics();
      return sendSuccess(res, 'Dashboard metrics retrieved', data);
    } catch (error) {
      return sendError(res, 'Failed to fetch dashboard metrics', error.message, 500);
    }
  }
}

module.exports = new DashboardController();
