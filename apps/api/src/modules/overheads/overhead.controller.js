const overheadService = require('./overhead.service');

class OverheadController {
  async create(req, res, next) {
    try {
      const result = await overheadService.createOverhead(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Biaya overhead berhasil dicatat',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const result = await overheadService.listOverheads(req.query);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async getSummary(req, res, next) {
    try {
      const result = await overheadService.getOverheadSummary(req.query);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async listDebts(req, res, next) {
    try {
      const result = await overheadService.getOverheadDebts(req.query);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const result = await overheadService.getOverheadById(req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const result = await overheadService.updateOverhead(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Data biaya overhead berhasil diperbarui',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await overheadService.deleteOverhead(req.params.id, req.user);
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const result = await overheadService.recordPayment(req.params.id, req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Pembayaran tagihan overhead berhasil dicatat',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async getPayments(req, res, next) {
    try {
      const result = await overheadService.getPayments(req.params.id);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new OverheadController();

