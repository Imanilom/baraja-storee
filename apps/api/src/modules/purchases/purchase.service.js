const Purchase = require('./purchase.model');
const PurchaseItem = require('./purchase-item.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const Supplier = require('../suppliers/supplier.model');
const Product = require('../products/product.model');
const ActivityLog = require('../audit/activity-log.model');
const { PURCHASE_STATUS } = require('@purchasing/constants');

class PurchaseService {
  async generatePurchaseNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `TRX-${dateStr}`;
    const count = await Purchase.countDocuments({
      purchase_number: new RegExp(`^${prefix}`)
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  }

  async createPurchase(data, user) {
    const {
      marketlist_id,
      supplier_id,
      invoice_ref,
      payment_method = 'cash',
      purchased_at = new Date(),
      receipt_attachment = '',
      notes = '',
      items = []
    } = data;

    if (!marketlist_id) {
      throw new Error('Marketlist ID wajib diisi.');
    }
    if (!supplier_id) {
      throw new Error('Supplier wajib dipilih.');
    }
    if (!items || items.length === 0) {
      throw new Error('Minimal harus ada 1 barang transaksi pembelian.');
    }

    const marketlist = await Marketlist.findById(marketlist_id);
    if (!marketlist) {
      throw new Error('Marketlist tidak ditemukan.');
    }

    const supplier = await Supplier.findById(supplier_id);
    if (!supplier) {
      throw new Error('Supplier tidak ditemukan.');
    }

    const purchaseNumber = await this.generatePurchaseNumber();

    // Calculate total actual
    let totalActual = 0;
    const itemsToInsert = [];

    for (const item of items) {
      const mlItem = await MarketlistItem.findById(item.marketlist_item_id).populate('product_id');
      const qty = Number(item.actual_qty) || 0;
      const unitPrice = Number(item.actual_unit_price) || 0;
      const subtotal = qty * unitPrice;
      totalActual += subtotal;

      const pName = mlItem?.product_id?.name || item.product_name || 'Item';
      const uName = mlItem?.product_id?.unit_id?.name || item.unit_name || 'Satuan';
      const prodId = mlItem?.product_id?._id || item.product_id;

      itemsToInsert.push({
        marketlist_item_id: item.marketlist_item_id,
        product_id: prodId,
        product_name: pName,
        unit_name: uName,
        actual_qty: qty,
        actual_unit_price: unitPrice,
        actual_subtotal: subtotal,
        notes: item.notes || ''
      });
    }

    const purchase = await Purchase.create({
      purchase_number: purchaseNumber,
      marketlist_id,
      supplier_id,
      invoice_ref,
      payment_method,
      purchased_by: user?._id,
      purchased_at: new Date(purchased_at),
      total_actual: totalActual,
      receipt_attachment,
      notes,
      status: PURCHASE_STATUS.VERIFIED
    });

    const createdItems = await PurchaseItem.insertMany(
      itemsToInsert.map((it) => ({
        ...it,
        purchase_id: purchase._id
      }))
    );

    // Update each product's last_purchase_price and last_supplier_id
    const ProductPrice = require('../prices/product-price.model');
    for (const item of itemsToInsert) {
      if (item.product_id && item.actual_unit_price > 0) {
        await Product.findByIdAndUpdate(item.product_id, {
          last_purchase_price: item.actual_unit_price,
          last_supplier_id: supplier_id
        }).catch(() => null);

        await ProductPrice.create({
          product_id: item.product_id,
          supplier_id,
          price: item.actual_unit_price,
          source: 'purchase',
          reference_id: purchase._id,
          recorded_at: new Date(purchased_at)
        }).catch(() => null);
      }
    }

    // Audit log
    await ActivityLog.create({
      user_id: user?._id,
      action: 'PURCHASE_CREATED',
      entity: 'Purchase',
      entity_id: purchase._id,
      meta_data: {
        purchase_number: purchase.purchase_number,
        marketlist_id,
        supplier_id,
        supplier_name: supplier.name,
        total_actual: totalActual,
        items_count: items.length
      }
    }).catch(() => null);

    return {
      ...purchase.toObject(),
      supplier,
      marketlist,
      items: createdItems
    };
  }

  async getPurchases(query = {}) {
    const {
      marketlist_id,
      supplier_id,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = query;

    const filter = {};
    if (marketlist_id) filter.marketlist_id = marketlist_id;
    if (supplier_id) filter.supplier_id = supplier_id;

    if (startDate || endDate) {
      filter.purchased_at = {};
      if (startDate) filter.purchased_at.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.purchased_at.$lte = eDate;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate('supplier_id', 'name code contact_person phone')
        .populate('marketlist_id', 'code date status required_date')
        .populate('purchased_by', 'name email role')
        .sort({ purchased_at: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Purchase.countDocuments(filter)
    ]);

    return {
      data: purchases,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };
  }

  async getPurchaseById(id) {
    const purchase = await Purchase.findById(id)
      .populate('supplier_id')
      .populate('marketlist_id')
      .populate('purchased_by', 'name email role');

    if (!purchase) {
      throw new Error('Transaksi pembelian tidak ditemukan.');
    }

    const items = await PurchaseItem.find({ purchase_id: id }).populate('product_id');

    return {
      ...purchase.toObject(),
      items
    };
  }
}

module.exports = new PurchaseService();

