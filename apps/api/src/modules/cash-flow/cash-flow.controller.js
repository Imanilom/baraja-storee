const cashFlowService = require('./cash-flow.service');

class CashFlowController {
  async getSummary(req, res, next) {
    try {
      const summary = await cashFlowService.getSummary(req.query);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  }

  async getMutations(req, res, next) {
    try {
      const result = await cashFlowService.getMutations(req.query);
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

  async recordIn(req, res, next) {
    try {
      const trx = await cashFlowService.recordCashIn(req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'Uang masuk berhasil dicatat.',
        data: trx
      });
    } catch (error) {
      next(error);
    }
  }

  async recordWithdrawal(req, res, next) {
    try {
      const trx = await cashFlowService.recordWithdrawal(req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'Tarik tunai berhasil dicatat. Saldo rekening berkurang dan saldo kas bertambah.',
        data: trx
      });
    } catch (error) {
      next(error);
    }
  }

  async recordOut(req, res, next) {
    try {
      const trx = await cashFlowService.recordCashOut(req.body, req.user);
      return res.status(201).json({
        success: true,
        message: 'Pengeluaran kas manual berhasil dicatat.',
        data: trx
      });
    } catch (error) {
      next(error);
    }
  }

  async recordPettyCashFund(req, res, next) {
    try {
      const trx = await cashFlowService.recordPettyCashTransfer(req.body, req.user, 'fund');
      return res.status(201).json({
        success: true,
        message: 'Dana kas kecil berhasil dicatat dari kas besar.',
        data: trx
      });
    } catch (error) {
      next(error);
    }
  }

  async recordPettyCashReturn(req, res, next) {
    try {
      const trx = await cashFlowService.recordPettyCashTransfer(req.body, req.user, 'return');
      return res.status(201).json({
        success: true,
        message: 'Sisa kas kecil berhasil dikembalikan ke kas besar.',
        data: trx
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await cashFlowService.deleteTransaction(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CashFlowController();
