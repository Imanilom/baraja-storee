const receivingService = require('./receiving.service');
const { sendSuccess, sendError } = require('../../utils/response');

class ReceivingController {
  async getByMarketlist(req, res) {
    try {
      const receipts = await receivingService.getReceiptsByMarketlist(req.params.marketlistId);
      return sendSuccess(res, 'Goods receipts retrieved', receipts);
    } catch (error) {
      return sendError(res, 'Failed to fetch goods receipts', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const receipt = await receivingService.getReceiptById(req.params.id);
      if (!receipt) {
        return sendError(res, 'Goods receipt not found', null, 404);
      }
      return sendSuccess(res, 'Goods receipt details', receipt);
    } catch (error) {
      return sendError(res, 'Failed to fetch receipt', error.message, 500);
    }
  }

  async create(req, res) {
    try {
      const receipt = await receivingService.createReceipt(req.params.marketlistId, req.body, req.user);
      return sendSuccess(res, 'Goods receipt recorded successfully', receipt, 201);
    } catch (error) {
      return sendError(res, 'Failed to record goods receipt', error.message, 400);
    }
  }

  async update(req, res) {
    try {
      const receiptId = req.params.receiptId || req.params.id;
      const receipt = await receivingService.updateReceipt(
        receiptId,
        req.body,
        req.user,
        req.params.marketlistId
      );
      return sendSuccess(res, 'Goods receipt updated successfully', receipt);
    } catch (error) {
      return sendError(res, 'Failed to update goods receipt', error.message, 400);
    }
  }
}

module.exports = new ReceivingController();
