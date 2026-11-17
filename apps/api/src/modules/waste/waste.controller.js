const wasteService = require('./waste.service');

class WasteController {
  async list(req, res, next) {
    try {
      const data = await wasteService.listWaste(req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await wasteService.createWaste(req.body, req.user);
      res.status(201).json({
        success: true,
        message: data.integration_status === 'sync_failed'
          ? `Waste tercatat, tetapi sinkronisasi ke Baraja Coffee gagal: ${data.integration_error}`
          : 'Waste berhasil dicatat dengan harga pembelian terakhir.',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async retrySync(req, res, next) {
    try {
      const data = await wasteService.retryWasteSync(req.params.id);
      res.status(202).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WasteController();
