const priceService = require('./prices.service');
const { sendSuccess, sendError } = require('../../utils/response');

class PriceController {
  async getProductPrices(req, res) {
    try {
      const history = await priceService.getPriceHistoryByProduct(req.params.id);
      return sendSuccess(res, 'Price history retrieved', history);
    } catch (error) {
      return sendError(res, 'Failed to fetch price history', error.message, 500);
    }
  }

  async getLatestOverview(req, res) {
    try {
      const overview = await priceService.getLatestPrices();
      return sendSuccess(res, 'Price monitoring overview retrieved', overview);
    } catch (error) {
      return sendError(res, 'Failed to fetch price monitoring overview', error.message, 500);
    }
  }
}

module.exports = new PriceController();

