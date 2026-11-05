const profitLossService = require('./profit-loss.service');
const { sendSuccess, sendError } = require('../../utils/response');

class ProfitLossController {
  async getReport(req, res) {
    try {
      const data = await profitLossService.calculateProfitLoss(req.query);
      return sendSuccess(res, 'Profit and Loss (Laba Rugi) calculation retrieved successfully', data);
    } catch (error) {
      return sendError(res, 'Failed to calculate Profit and Loss', error.message, 500);
    }
  }
}

module.exports = new ProfitLossController();

