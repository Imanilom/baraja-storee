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
}

module.exports = new MarketlistController();

