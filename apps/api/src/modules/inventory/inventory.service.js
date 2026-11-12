const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const Invoice = require('../invoices/invoice.model');
const Waste = require('../waste/waste.model');

const getDayRange = ({ date: dateValue, startDate, endDate } = {}) => {
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new Error('Rentang tanggal inventori tidak valid.');
    }
    return { start, end };
  }
  const day = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(day.getTime())) throw new Error('Tanggal inventori tidak valid.');
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

class InventoryService {
  async getDailyReconciliation(query) {
    const { start, end } = getDayRange(query);
    const [purchases, receipts, invoices, wasteRecords] = await Promise.all([
      Purchase.find({ purchased_at: { $gte: start, $lte: end } }).select('_id purchase_number purchased_at'),
      GoodsReceipt.find({
        received_at: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' }
      }).select('_id receipt_number received_at'),
      Invoice.find({
        invoice_date: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' }
      }).select('invoice_number invoice_date items'),
      Waste.find({ wasted_at: { $gte: start, $lte: end } }).lean()
    ]);

    const [purchaseItems, receiptItems] = await Promise.all([
      PurchaseItem.find({ purchase_id: { $in: purchases.map(({ _id }) => _id) } }).lean(),
      GoodsReceiptItem.find({ receipt_id: { $in: receipts.map(({ _id }) => _id) } })
        .populate({
          path: 'marketlist_item_id',
          select: 'product_id product_snapshot',
          populate: {
            path: 'product_id',
            select: 'name sku unit_id',
            populate: { path: 'unit_id', select: 'name abbreviation' }
          }
        })
        .lean()
    ]);

    const products = new Map();
    const getProduct = (id, name, unit) => {
      const key = id?.toString() || `name:${name || 'unknown'}`;
      if (!products.has(key)) {
        products.set(key, {
          product_id: id || null,
          product_name: name || 'Produk tidak diketahui',
          unit_name: unit || '',
          po_quantity: 0,
          po_amount: 0,
          received_quantity: 0,
          billed_quantity: 0,
          billed_amount: 0,
          waste_quantity: 0,
          waste_cost: 0,
          waste_records: [],
          event_history: []
        });
      }
      const entry = products.get(key);
      if (!entry.unit_name && unit) entry.unit_name = unit;
      return entry;
    };

    purchaseItems.forEach((item) => {
      const product = getProduct(item.product_id, item.product_name, item.unit_name);
      product.po_quantity += Number(item.actual_qty) || 0;
      product.po_amount += Number(item.actual_subtotal) || 0;
      const purchase = purchases.find(({ _id }) => _id.toString() === item.purchase_id.toString());
      product.event_history.push({
        type: 'po',
        happened_at: purchase?.purchased_at,
        quantity: Number(item.actual_qty) || 0,
        amount: Number(item.actual_subtotal) || 0,
        description: `PO ${purchase?.purchase_number || ''}`.trim()
      });
    });

    receiptItems.forEach((item) => {
      const marketlistItem = item.marketlist_item_id;
      const productInfo = marketlistItem?.product_id;
      const product = getProduct(
        productInfo?._id || marketlistItem?.product_id,
        productInfo?.name || marketlistItem?.product_snapshot?.name,
        productInfo?.unit_id?.abbreviation || productInfo?.unit_id?.name || ''
      );
      product.received_quantity += Number(item.accepted_qty) || 0;
      const receipt = receipts.find(({ _id }) => _id.toString() === item.receipt_id.toString());
      product.event_history.push({
        type: 'received',
        happened_at: receipt?.received_at,
        quantity: Number(item.accepted_qty) || 0,
        amount: 0,
        description: `Penerimaan ${receipt?.receipt_number || ''}`.trim()
      });
    });

    invoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        if (item.purchased === false) return;
        const product = getProduct(item.product_id, item.product_name, item.unit);
        product.billed_quantity += Number(item.quantity) || 0;
        product.billed_amount += Number(item.subtotal) || 0;
        product.event_history.push({
          type: 'invoice',
          happened_at: invoice.invoice_date,
          quantity: Number(item.quantity) || 0,
          amount: Number(item.subtotal) || 0,
          description: `Tagihan ${invoice.invoice_number}`
        });
      });
    });

    wasteRecords.forEach((record) => {
      const product = getProduct(record.product_id, record.product_name, record.unit_name);
      product.waste_quantity += Number(record.quantity) || 0;
      product.waste_cost += Number(record.total_cost) || 0;
      product.waste_records.push({
        _id: record._id,
        quantity: record.quantity,
        unit_purchase_price: record.unit_purchase_price,
        total_cost: record.total_cost,
        reason: record.reason,
        wasted_at: record.wasted_at
      });
      product.event_history.push({
        type: 'waste',
        happened_at: record.wasted_at,
        quantity: Number(record.quantity) || 0,
        amount: Number(record.total_cost) || 0,
        description: record.reason
      });
    });

    products.forEach((product) => {
      product.event_history.sort((a, b) => new Date(a.happened_at || 0) - new Date(b.happened_at || 0));
    });
    const items = [...products.values()].sort((a, b) => a.product_name.localeCompare(b.product_name));
    const sum = (field) => items.reduce((total, item) => total + item[field], 0);
    return {
      date: query?.date || start.toISOString().slice(0, 10),
      totals: {
        po_quantity: sum('po_quantity'),
        po_amount: sum('po_amount'),
        received_quantity: sum('received_quantity'),
        billed_quantity: sum('billed_quantity'),
        billed_amount: sum('billed_amount'),
        waste_quantity: sum('waste_quantity'),
        waste_cost: sum('waste_cost')
      },
      items
    };
  }
}

module.exports = new InventoryService();
