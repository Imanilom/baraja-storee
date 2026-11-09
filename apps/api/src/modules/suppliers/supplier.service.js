const Supplier = require('./supplier.model');

class SupplierService {
  async getAllSuppliers(query = {}) {
    const filter = { is_active: true };
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } }
      ];
    }
    return Supplier.find(filter).sort({ name: 1 });
  }

  async getSupplierById(id) {
    return Supplier.findById(id);
  }

  async createSupplier(data) {
    const payload = { ...data };
    if (!payload.code || payload.code.trim() === '') {
      const count = await Supplier.countDocuments();
      payload.code = `SUP-${String(count + 1).padStart(4, '0')}`;
    }
    if (!payload.email || payload.email.trim() === '') {
      delete payload.email;
    }
    const supplier = new Supplier(payload);
    return supplier.save();
  }

  async updateSupplier(id, data) {
    return Supplier.findByIdAndUpdate(id, data, { new: true });
  }
}

module.exports = new SupplierService();

