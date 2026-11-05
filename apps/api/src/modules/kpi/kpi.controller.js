const kpiService = require('./kpi.service');
const { sendSuccess, sendError } = require('../../utils/response');

class KpiController {
  async getSummary(req, res) {
    try {
      const summary = await kpiService.getKpiSummary();
      return sendSuccess(res, 'KPI summary retrieved', summary);
    } catch (error) {
      return sendError(res, 'Failed to fetch KPI summary', error.message, 500);
    }
  }

  async calculateForMarketlist(req, res) {
    try {
      const { score, comment } = req.body;
      const result = await kpiService.calculateMarketlistKpi(req.params.marketlistId, req.user._id, { score, comment });
      return sendSuccess(res, 'Marketlist KPI calculated successfully', result);
    } catch (error) {
      return sendError(res, 'Failed to calculate KPI', error.message, 400);
    }
  }
}

module.exports = new KpiController();
