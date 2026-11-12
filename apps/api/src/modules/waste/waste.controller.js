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
        message: 'Waste berhasil dicatat dengan harga pembelian terakhir.',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WasteController();
