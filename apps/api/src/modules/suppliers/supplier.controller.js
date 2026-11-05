const supplierService = require('./supplier.service');
const { sendSuccess, sendError } = require('../../utils/response');

class SupplierController {
  async list(req, res) {
    try {
      const suppliers = await supplierService.getAllSuppliers(req.query);
      return sendSuccess(res, 'Suppliers retrieved successfully', suppliers);
    } catch (error) {
      return sendError(res, 'Failed to fetch suppliers', error.message, 500);
    }
  }

  async getById(req, res) {
    try {
      const supplier = await supplierService.getSupplierById(req.params.id);
      if (!supplier) {
        return sendError(res, 'Supplier not found', null, 404);
      }
      return sendSuccess(res, 'Supplier details', supplier);
    } catch (error) {
      return sendError(res, 'Failed to fetch supplier', error.message, 500);
    }
  }

  async create(req, res) {
    try {
      const supplier = await supplierService.createSupplier(req.body);
      return sendSuccess(res, 'Supplier created successfully', supplier, 201);
    } catch (error) {
      return sendError(res, 'Failed to create supplier', error.message, 400);
    }
  }

  async update(req, res) {
    try {
      const supplier = await supplierService.updateSupplier(req.params.id, req.body);
      if (!supplier) {
        return sendError(res, 'Supplier not found', null, 404);
      }
      return sendSuccess(res, 'Supplier updated successfully', supplier);
    } catch (error) {
      return sendError(res, 'Failed to update supplier', error.message, 400);
    }
  }
}

module.exports = new SupplierController();
