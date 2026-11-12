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

  // GET /purchases/debts — Daftar hutang aktif
  async listDebts(req, res, next) {
    try {
      const result = await purchaseService.getDebtList(req.query);
      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit
      });
    } catch (error) {
      next(error);
    }
  }

  async dailySummary(req, res, next) {
    try {
      const summary = await purchaseService.getDailySummary(req.query);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /purchases/:id/payments — Bayar hutang
  async recordPayment(req, res, next) {
    try {
      const result = await purchaseService.recordDebtPayment(req.params.id, req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'Pembayaran hutang berhasil dicatat.',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /purchases/:id/payments — Riwayat pembayaran hutang
  async getPayments(req, res, next) {
    try {
      const payments = await purchaseService.getDebtPayments(req.params.id);
      return res.status(200).json({
        success: true,
        data: payments
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /purchases/:id — Edit transaksi pembelian
  async update(req, res, next) {
    try {
      const updated = await purchaseService.updatePurchase(req.params.id, req.body, req.user);
      return res.status(200).json({
        success: true,
        message: 'Transaksi pembelian berhasil diperbarui.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /purchases/:id — Hapus transaksi pembelian
  async delete(req, res, next) {
    try {
      const result = await purchaseService.deletePurchase(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PurchaseController();
