const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const DebtPayment = require('../purchases/debt-payment.model');
const Overhead = require('../overheads/overhead.model');
const OverheadPayment = require('../overheads/overhead-payment.model');
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
    const [purchases, receipts, wasteRecords, overheads] = await Promise.all([
      Purchase.find({
        purchased_at: { $gte: start, $lte: end },
        status: 'verified'
      }).select('_id purchase_number purchased_at total_actual amount_paid payment_method payment_status updatedAt supplier_id'),
      GoodsReceipt.find({
        received_at: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' }
      }).select('_id receipt_number received_at'),
      Waste.find({ wasted_at: { $gte: start, $lte: end } }).lean(),
      Overhead.find({ expense_date: { $gte: start, $lte: end } })
        .select('_id title category amount expense_date payment_method payment_status amount_paid amount_remaining updated_at')
        .lean()
    ]);

    const [purchaseItems, receiptItems, debtPayments, overheadPayments] = await Promise.all([
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
        .lean(),
      DebtPayment.find({
        purchase_id: { $in: purchases.map(({ _id }) => _id) },
        paid_at: { $lte: end }
      }).select('purchase_id amount paid_at'),
      OverheadPayment.find({
        overhead_id: { $in: overheads.map(({ _id }) => _id) },
        paid_at: { $lte: end }
      }).select('overhead_id amount paid_at')
    ]);

    const purchaseById = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase])
    );
    const paymentsByPurchase = new Map();
    debtPayments.forEach((payment) => {
      const purchaseId = payment.purchase_id.toString();
      paymentsByPurchase.set(
        purchaseId,
        (paymentsByPurchase.get(purchaseId) || 0) + (Number(payment.amount) || 0)
      );
    });
    const purchaseAmounts = new Map();
    const purchaseItemsByPurchase = new Map();
    purchaseItems.forEach((item) => {
      const id = item.purchase_id.toString();
      const items = purchaseItemsByPurchase.get(id) || [];
      items.push(item);
      purchaseItemsByPurchase.set(id, items);
    });
    const paymentsByPurchaseRecords = new Map();
    debtPayments.forEach((payment) => {
      const id = payment.purchase_id.toString();
      const records = paymentsByPurchaseRecords.get(id) || [];
      records.push(payment);
      paymentsByPurchaseRecords.set(id, records);
    });
    purchases.forEach((purchase) => {
      const id = purchase._id.toString();
      const total = Number(purchase.total_actual) || 0;
      const recordedPayments = paymentsByPurchase.get(id);
      let paid;
      if (purchase.payment_method !== 'tempo') {
        paid = total;
      } else if (recordedPayments !== undefined) {
        paid = recordedPayments;
      } else if (purchase.payment_status === 'paid' && purchase.updatedAt <= end) {
        paid = total;
      } else if (purchase.updatedAt <= end) {
        paid = Number(purchase.amount_paid) || 0;
      } else {
        paid = 0;
      }
      paid = Math.min(total, Math.max(0, paid));
      purchaseAmounts.set(id, {
        total,
        paid,
        debt: Math.max(0, total - paid)
      });
    });
    const overheadPaymentsById = new Map();
    overheadPayments.forEach((payment) => {
      const id = payment.overhead_id.toString();
      const records = overheadPaymentsById.get(id) || [];
      records.push(payment);
      overheadPaymentsById.set(id, records);
    });
    const overheadDetails = overheads.map((overhead) => {
      const payments = overheadPaymentsById.get(overhead._id.toString()) || [];
      const total = Number(overhead.amount) || 0;
      let paid;
      if (overhead.payment_method !== 'tempo') {
        paid = total;
      } else if (payments.length > 0) {
        paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      } else if (overhead.updated_at <= end) {
        paid = Number(overhead.amount_paid) || 0;
      } else {
        paid = 0;
      }
      paid = Math.min(total, Math.max(0, paid));
      return {
        _id: overhead._id,
        title: overhead.title,
        category: overhead.category,
        expense_date: overhead.expense_date,
        amount: total,
        paid_amount: paid,
        debt_amount: Math.max(0, total - paid),
        payment_status: overhead.payment_status,
        payments: payments
          .filter((payment) => payment.paid_at >= start)
          .map((payment) => ({
            _id: payment._id,
            amount: payment.amount,
            paid_at: payment.paid_at
          }))
      };
    });

    const purchaseItemIds = purchaseItems.map((item) => item._id);
    const marketlistItemIds = purchaseItems
      .map((item) => item.marketlist_item_id)
      .filter(Boolean);
    const invoices = purchaseItemIds.length || marketlistItemIds.length
      ? await Invoice.find({
          status: { $ne: 'cancelled' },
          $or: [
            ...(purchaseItemIds.length ? [{ 'items.purchase_item_id': { $in: purchaseItemIds } }] : []),
            ...(marketlistItemIds.length ? [{ 'items.marketlist_item_id': { $in: marketlistItemIds } }] : [])
          ]
        }).select('invoice_number invoice_date items')
      : [];

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
          paid_amount: 0,
          debt_amount: 0,
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
      const purchaseId = item.purchase_id.toString();
      const purchase = purchaseById.get(purchaseId);
      const amounts = purchaseAmounts.get(purchaseId) || { total: 0, paid: 0, debt: 0 };
      const purchaseItemsForPurchase = purchaseItemsByPurchase.get(purchaseId) || [];
      const itemSubtotalTotal = purchaseItemsForPurchase.reduce(
        (sum, candidate) => sum + (Number(candidate.actual_subtotal) || 0),
        0
      );
      const allocation = itemSubtotalTotal > 0
        ? (Number(item.actual_subtotal) || 0) / itemSubtotalTotal
        : 0;
      const allocatedPurchaseAmount = amounts.total * allocation;
      product.po_quantity += Number(item.actual_qty) || 0;
      product.po_amount += allocatedPurchaseAmount;
      product.paid_amount += amounts.paid * allocation;
      product.debt_amount += amounts.debt * allocation;
      product.event_history.push({
        type: 'po',
        happened_at: purchase?.purchased_at,
        quantity: Number(item.actual_qty) || 0,
        amount: allocatedPurchaseAmount,
        description: `PO ${purchase?.purchase_number || ''}`.trim()
      });
      (paymentsByPurchaseRecords.get(purchaseId) || []).forEach((payment) => {
        product.event_history.push({
          type: 'debt_payment',
          happened_at: payment.paid_at,
          quantity: 0,
          amount: (Number(payment.amount) || 0) * allocation,
          description: `Pembayaran hutang ${purchase?.purchase_number || ''}`.trim()
        });
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

    const purchaseSupplierById = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase.supplier_id?.toString()])
    );
    invoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        if (item.purchased === false || Number(item.quantity) <= 0) return;
        const sourceItems = item.purchase_item_id
          ? purchaseItems.filter(
              (purchaseItem) => purchaseItem._id.toString() === item.purchase_item_id.toString()
            )
          : item.marketlist_item_id
            ? purchaseItems.filter((purchaseItem) =>
                purchaseItem.marketlist_item_id?.toString() === item.marketlist_item_id.toString() &&
                (!item.supplier_id ||
                  purchaseSupplierById.get(purchaseItem.purchase_id.toString()) === item.supplier_id.toString())
              )
            : [];
        sourceItems.forEach((sourceItem) => {
          const product = getProduct(sourceItem.product_id, sourceItem.product_name, sourceItem.unit_name);
          const sourceQuantity = Number(sourceItem.actual_qty) || 0;
          const billedUnitPrice = Number(item.subtotal) / Number(item.quantity);
          const billedAmount = sourceQuantity * billedUnitPrice;
          product.billed_quantity += sourceQuantity;
          product.billed_amount += billedAmount;
          product.event_history.push({
            type: 'invoice',
            happened_at: invoice.invoice_date,
            quantity: sourceQuantity,
            amount: billedAmount,
            description: `Tagihan ${invoice.invoice_number}`
          });
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
    const poAmount = [...purchaseAmounts.values()].reduce(
      (total, amounts) => total + amounts.total,
      0
    );
    const billedAmount = sum('billed_amount');
    const sumOverhead = (field) =>
      overheadDetails.reduce((total, overhead) => total + overhead[field], 0);
    return {
      date: query?.date || start.toISOString().slice(0, 10),
      totals: {
        po_quantity: sum('po_quantity'),
        po_amount: poAmount,
        paid_amount: [...purchaseAmounts.values()].reduce((total, amounts) => total + amounts.paid, 0),
        debt_amount: [...purchaseAmounts.values()].reduce((total, amounts) => total + amounts.debt, 0),
        received_quantity: sum('received_quantity'),
        billed_quantity: sum('billed_quantity'),
        billed_amount: billedAmount,
        difference_amount: Math.round((poAmount - billedAmount) * 100) / 100,
        waste_quantity: sum('waste_quantity'),
        waste_cost: sum('waste_cost'),
        overhead_amount: sumOverhead('amount'),
        overhead_paid_amount: sumOverhead('paid_amount'),
        overhead_debt_amount: sumOverhead('debt_amount')
      },
      overheads: overheadDetails,
      items
    };
  }
}

module.exports = new InventoryService();
