const purchaseService = require('./purchase.service');

class PurchaseController {
  async create(req, res, next) {
    try {
      const purchase = await purchaseService.createPurchase(req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'Transaksi pembelian berhasil dicatat.',
        data: purchase
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const result = await purchaseService.getPurchases(req.query);
      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const purchase = await purchaseService.getPurchaseById(req.params.id);
      return res.status(200).json({
        success: true,
        data: purchase
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PurchaseController();

