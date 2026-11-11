const marketlistService = require('./marketlist.service');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response');

class MarketlistController {
  async list(req, res) {
    try {
      const { items, total, page, limit } = await marketlistService.getAllMarketlists(req.query, req.user);
      return sendPaginated(res, 'Marketlists retrieved', items, total, page, limit);
    } catch (error) {
      return sendError(res, 'Failed to fetch marketlists', error.message, 500);
    }
  }

  async getAggregate(req, res) {
    try {
      const data = await marketlistService.getMarketlistAggregate(req.query);
      return sendSuccess(res, 'Marketlist aggregate retrieved', data);
    } catch (error) {
      return sendError(res, 'Failed to fetch aggregate', error.message, 500);
    }
  }

  async getDailyPrint(req, res) {
    const { required_date: requiredDate } = req.query;
    const parsedDate = typeof requiredDate === 'string'
      ? new Date(`${requiredDate}T00:00:00.000Z`)
      : null;

    if (
      !parsedDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(requiredDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== requiredDate
    ) {
      return sendError(res, 'Invalid required_date. Use YYYY-MM-DD.', null, 400);
    }

    try {
      const data = await marketlistService.getDailyPrintData(parsedDate);
      return sendSuccess(res, 'Daily marketlist print data retrieved', data);
    } catch (error) {
      return sendError(res, 'Failed to fetch daily print data', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const marketlist = await marketlistService.getMarketlistById(req.params.id);
      if (!marketlist) {
        return sendError(res, 'Marketlist not found', null, 404);
      }
      return sendSuccess(res, 'Marketlist details', marketlist);
    } catch (error) {
      return sendError(res, 'Failed to fetch marketlist', error.message, 500);
    }
  }

  async create(req, res) {
    try {
      const result = await marketlistService.createMarketlist(req.body, req.user);
      return sendSuccess(res, 'Marketlist created successfully', result, 201);
    } catch (error) {
      return sendError(res, 'Failed to create marketlist', error.message, 400);
    }
  }

  async update(req, res) {
    try {
      const result = await marketlistService.updateMarketlist(req.params.id, req.body, req.user);
      return sendSuccess(res, 'Marketlist updated successfully', result);
    } catch (error) {
      return sendError(res, 'Failed to update marketlist', error.message, 400);
    }
  }

  async submit(req, res) {
    try {
      const result = await marketlistService.submitMarketlist(req.params.id, req.user);
      return sendSuccess(res, 'Marketlist submitted for approval', result);
    } catch (error) {
      return sendError(res, 'Failed to submit marketlist', error.message, 400);
    }
  }

  async approve(req, res) {
    try {
      const { note } = req.body;
      const result = await marketlistService.approveMarketlist(req.params.id, req.user, note);
      return sendSuccess(res, 'Marketlist approved successfully', result);
    } catch (error) {
      return sendError(res, 'Failed to approve marketlist', error.message, 400);
    }
  }

  async reject(req, res) {
    try {
      const { reason } = req.body;
      const result = await marketlistService.rejectMarketlist(req.params.id, req.user, reason);
      return sendSuccess(res, 'Marketlist rejected', result);
    } catch (error) {
      return sendError(res, 'Failed to reject marketlist', error.message, 400);
    }
  }

  async requestRevision(req, res) {
    try {
      const { note } = req.body;
      const result = await marketlistService.requestRevision(req.params.id, req.user, note);
      return sendSuccess(res, 'Revision requested', result);
    } catch (error) {
      return sendError(res, 'Failed to request revision', error.message, 400);
    }
  }

  async approveItems(req, res) {
    try {
      const result = await marketlistService.approveItems(req.params.id, req.body.items || [], req.user);
      return sendSuccess(res, 'Item review berhasil disimpan', result);
    } catch (error) {
      return sendError(res, 'Gagal mereview item', error.message, 400);
    }
  }
}

module.exports = new MarketlistController();
