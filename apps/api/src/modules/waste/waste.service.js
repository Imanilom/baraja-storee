const mongoose = require('mongoose');
const Waste = require('./waste.model');
const Product = require('../products/product.model');
const ProductPrice = require('../prices/product-price.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
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
      .populate('marketlist_id', 'marketlist_number date required_date status')
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
    const stage = data.stage || 'other';
    const validStages = ['received', 'processing', 'finished_product', 'spoiled', 'other'];
    if (!validStages.includes(stage)) {
      throw new Error('Tahap waste tidak valid.');
    }
    const isStockWaste = Boolean(data.stage && stage !== 'received');
    if (stage === 'received' && !data.marketlist_id) {
      throw new Error('Marketlist wajib dipilih untuk waste saat penerimaan.');
    }
    if (isStockWaste && (data.marketlist_id || data.marketlist_item_id)) {
      throw new Error('Waste setelah penerimaan dicatat dari stok, tanpa Marketlist.');
    }
    const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
    if (notes.length > 1000) {
      throw new Error('Catatan waste maksimal 1000 karakter.');
    }

    const wastedAt = data.wasted_at ? new Date(data.wasted_at) : new Date();
    if (Number.isNaN(wastedAt.getTime())) {
      throw new Error('Tanggal waste tidak valid.');
    }

    const product = await Product.findById(data.product_id).populate('unit_id', 'name abbreviation');
    if (!product) {
      throw new Error('Produk tidak ditemukan.');
    }

    let marketlistItem = null;
    if (data.marketlist_id) {
      if (!mongoose.Types.ObjectId.isValid(data.marketlist_id)) {
        throw new Error('Marketlist tidak valid.');
      }
      const marketlist = await Marketlist.findById(data.marketlist_id).select('_id status');
      if (!marketlist) throw new Error('Marketlist tidak ditemukan.');
      marketlistItem = await MarketlistItem.findOne({
        marketlist_id: marketlist._id,
        product_id: product._id,
        item_status: { $ne: 'rejected' }
      }).select('_id');
      if (!marketlistItem) {
        throw new Error('Produk tidak terdaftar pada Marketlist yang dipilih atau telah ditolak.');
      }
    } else if (data.marketlist_item_id) {
      throw new Error('Marketlist wajib dipilih untuk mengaitkan item waste.');
    }

    const latestPurchasePrice = await ProductPrice.findOne({
      product_id: product._id,
      source: PRICE_SOURCES.PURCHASE
    }).sort({ recorded_at: -1 });
    const marketlistPurchases = data.marketlist_id
      ? await Purchase.find({
        marketlist_id: data.marketlist_id,
        status: 'verified'
      }).select('_id')
      : [];
    const marketlistPurchaseItem = marketlistItem && marketlistPurchases.length
      ? await PurchaseItem.findOne({
        purchase_id: { $in: marketlistPurchases.map((purchase) => purchase._id) },
        marketlist_item_id: marketlistItem._id
      }).sort({ createdAt: -1 })
      : null;
    const unitPurchasePrice = Number(
      marketlistPurchaseItem?.actual_unit_price ||
      latestPurchasePrice?.price ||
      product.last_purchase_price ||
      0
    );
    if (unitPurchasePrice <= 0) {
      throw new Error('Produk belum memiliki harga pembelian. Catat transaksi pembelian terlebih dahulu.');
    }

    if (isStockWaste) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product._id, current_stock: { $gte: quantity } },
        { $inc: { current_stock: -quantity } },
        { new: true }
      );
      if (!updatedProduct) {
        throw new Error(
          `Stok tidak cukup. Stok tersedia: ${Number(product.current_stock) || 0}.`
        );
      }
    }

    try {
      return await Waste.create({
      product_id: product._id,
      marketlist_id: data.marketlist_id || null,
      marketlist_item_id: marketlistItem?._id || null,
      product_name: product.name,
      unit_name: product.unit_id?.abbreviation || product.unit_id?.name || '',
      quantity,
      unit_purchase_price: unitPurchasePrice,
      total_cost: quantity * unitPurchasePrice,
      stage,
      reason,
      notes,
      wasted_at: wastedAt,
      recorded_by: user._id
      });
    } catch (error) {
      if (isStockWaste) {
        await Product.updateOne(
          { _id: product._id },
          { $inc: { current_stock: quantity } }
        );
      }
      throw error;
    }
  }
}

module.exports = new WasteService();
