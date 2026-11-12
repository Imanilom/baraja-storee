const mongoose = require('mongoose');
const Waste = require('./waste.model');
const Product = require('../products/product.model');
const ProductPrice = require('../prices/product-price.model');
const { PRICE_SOURCES } = require('@purchasing/constants');

class WasteService {
  async listWaste(query = {}) {
    const filter = {};
    if (query.startDate || query.endDate) {
      filter.wasted_at = {};
      if (query.startDate) filter.wasted_at.$gte = new Date(query.startDate);
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filter.wasted_at.$lte = endDate;
      }
    }

    return Waste.find(filter)
      .populate('product_id', 'name sku')
      .populate('recorded_by', 'name')
      .sort({ wasted_at: -1, createdAt: -1 })
      .limit(Math.min(Number(query.limit) || 100, 500));
  }

  async createWaste(data, user) {
    if (!mongoose.Types.ObjectId.isValid(data.product_id)) {
      throw new Error('Produk tidak valid.');
    }
    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Jumlah waste harus lebih besar dari 0.');
    }
    const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
    if (!reason) {
      throw new Error('Alasan waste wajib diisi.');
    }

    const wastedAt = data.wasted_at ? new Date(data.wasted_at) : new Date();
    if (Number.isNaN(wastedAt.getTime())) {
      throw new Error('Tanggal waste tidak valid.');
    }

    const product = await Product.findById(data.product_id).populate('unit_id', 'name abbreviation');
    if (!product) {
      throw new Error('Produk tidak ditemukan.');
    }

    const latestPurchasePrice = await ProductPrice.findOne({
      product_id: product._id,
      source: PRICE_SOURCES.PURCHASE
    }).sort({ recorded_at: -1 });
    const unitPurchasePrice = Number(
      latestPurchasePrice?.price || product.last_purchase_price || 0
    );
    if (unitPurchasePrice <= 0) {
      throw new Error('Produk belum memiliki harga pembelian. Catat transaksi pembelian terlebih dahulu.');
    }

    return Waste.create({
      product_id: product._id,
      product_name: product.name,
      unit_name: product.unit_id?.abbreviation || product.unit_id?.name || '',
      quantity,
      unit_purchase_price: unitPurchasePrice,
      total_cost: quantity * unitPurchasePrice,
      reason,
      wasted_at: wastedAt,
      recorded_by: user._id
    });
  }
}

module.exports = new WasteService();
