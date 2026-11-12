const inventoryService = require('./inventory.service');

class InventoryController {
  async getDailyReconciliation(req, res, next) {
    try {
      const data = await inventoryService.getDailyReconciliation(req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
