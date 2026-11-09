const Purchase = require('./purchase.model');
const PurchaseItem = require('./purchase-item.model');
const DebtPayment = require('./debt-payment.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const Supplier = require('../suppliers/supplier.model');
const Product = require('../products/product.model');
const ActivityLog = require('../audit/activity-log.model');
const { PURCHASE_STATUS, PAYMENT_STATUS } = require('@purchasing/constants');

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
      payment_source,
      purchased_at = new Date(),
      receipt_attachment = '',
      notes = '',
      items = [],
      // Debt / tempo fields
      due_date = null,
      amount_paid: amountPaidInput
    } = data;

    if (!marketlist_id) throw new Error('Marketlist ID wajib diisi.');
    if (!supplier_id) throw new Error('Supplier wajib dipilih.');
    if (!items || items.length === 0) throw new Error('Minimal harus ada 1 barang transaksi pembelian.');

    const marketlist = await Marketlist.findById(marketlist_id);
    if (!marketlist) throw new Error('Marketlist tidak ditemukan.');

    const supplier = await Supplier.findById(supplier_id);
    if (!supplier) throw new Error('Supplier tidak ditemukan.');

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

    // Determine payment status
    let paymentStatus;
    let amountPaid = 0;

    if (payment_method === 'tempo') {
      // Hutang: bisa belum bayar sama sekali, atau bayar sebagian
      amountPaid = Number(amountPaidInput) || 0;
      if (amountPaid <= 0) {
        paymentStatus = PAYMENT_STATUS.UNPAID;
      } else if (amountPaid >= totalActual) {
        paymentStatus = PAYMENT_STATUS.PAID;
        amountPaid = totalActual;
      } else {
        paymentStatus = PAYMENT_STATUS.PARTIAL;
      }
    } else {
      // Cash / transfer: langsung lunas
      paymentStatus = PAYMENT_STATUS.PAID;
      amountPaid = totalActual;
    }

    const amountRemaining = totalActual - amountPaid;

    // Check if already overdue on creation
    if (
      due_date &&
      paymentStatus !== PAYMENT_STATUS.PAID &&
      new Date() > new Date(due_date)
    ) {
      paymentStatus = PAYMENT_STATUS.OVERDUE;
    }

    const resolvedPaymentSource = payment_source || (payment_method === 'transfer' ? 'bank' : 'cash');

    const purchase = await Purchase.create({
      purchase_number: purchaseNumber,
      marketlist_id,
      supplier_id,
      invoice_ref,
      payment_method,
      payment_source: resolvedPaymentSource,
      payment_status: paymentStatus,
      due_date: payment_method === 'tempo' && due_date ? new Date(due_date) : null,
      amount_paid: amountPaid,
      amount_remaining: amountRemaining,
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

    // If tempo & uang muka dibayar, record first debt payment
    if (payment_method === 'tempo' && amountPaid > 0 && amountPaid < totalActual) {
      await DebtPayment.create({
        purchase_id: purchase._id,
        amount: amountPaid,
        payment_method: resolvedPaymentSource === 'bank' ? 'transfer' : 'cash',
        paid_at: new Date(purchased_at),
        notes: 'Uang muka / DP saat transaksi',
        recorded_by: user?._id
      }).catch(() => null);
    }

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

    // Update marketlist status to in_progress if currently approved
    await Marketlist.findOneAndUpdate(
      { _id: marketlist_id, status: 'approved' },
      { $set: { status: 'in_progress' } }
    ).catch(() => null);

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
        payment_method,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        due_date,
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

  // Record a debt payment (bayar hutang / cicilan)
  async recordDebtPayment(purchaseId, paymentData, user) {
    const purchase = await Purchase.findById(purchaseId).populate('supplier_id');
    if (!purchase) throw new Error('Transaksi pembelian tidak ditemukan.');

    if (purchase.payment_status === PAYMENT_STATUS.PAID) {
      throw new Error('Transaksi ini sudah lunas.');
    }

    const { amount, payment_method = 'transfer', paid_at, reference_number, attachment, notes } = paymentData;
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) throw new Error('Jumlah pembayaran harus lebih dari 0.');
    if (payAmount > purchase.amount_remaining) {
      throw new Error(
        `Jumlah pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa hutang (Rp ${purchase.amount_remaining.toLocaleString('id-ID')}).`
      );
    }

    const debtPayment = await DebtPayment.create({
      purchase_id: purchaseId,
      amount: payAmount,
      payment_method,
      paid_at: paid_at ? new Date(paid_at) : new Date(),
      reference_number: reference_number || '',
      attachment: attachment || '',
      notes: notes || '',
      recorded_by: user?._id
    });

    const newAmountPaid = purchase.amount_paid + payAmount;
    const newAmountRemaining = purchase.total_actual - newAmountPaid;
    let newStatus;
    if (newAmountRemaining <= 0) {
      newStatus = PAYMENT_STATUS.PAID;
    } else {
      newStatus = PAYMENT_STATUS.PARTIAL;
    }

    await Purchase.findByIdAndUpdate(purchaseId, {
      amount_paid: newAmountPaid,
      amount_remaining: Math.max(0, newAmountRemaining),
      payment_status: newStatus
    });

    await ActivityLog.create({
      user_id: user?._id,
      action: 'DEBT_PAYMENT_RECORDED',
      entity: 'Purchase',
      entity_id: purchaseId,
      meta_data: {
        purchase_number: purchase.purchase_number,
        supplier_name: purchase.supplier_id?.name || '',
        amount_paid: payAmount,
        new_total_paid: newAmountPaid,
        new_remaining: Math.max(0, newAmountRemaining),
        payment_status: newStatus
      }
    }).catch(() => null);

    const updatedPurchase = await Purchase.findById(purchaseId)
      .populate('supplier_id', 'name code')
      .populate('purchased_by', 'name');

    return {
      debt_payment: debtPayment,
      purchase: updatedPurchase
    };
  }

  // Get debt payments for a purchase
  async getDebtPayments(purchaseId) {
    const payments = await DebtPayment.find({ purchase_id: purchaseId })
      .populate('recorded_by', 'name')
      .sort({ paid_at: 1 });
    return payments;
  }

  // Get list of outstanding debts (unpaid/partial/overdue)
  async getDebtList(query = {}) {
    const { supplier_id, status, page = 1, limit = 20 } = query;
    const filter = {
      payment_method: 'tempo',
      payment_status: { $ne: PAYMENT_STATUS.PAID }
    };
    if (supplier_id) filter.supplier_id = supplier_id;
    if (status) filter.payment_status = status;

    // Auto-update overdue status
    await Purchase.updateMany(
      {
        payment_method: 'tempo',
        payment_status: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIAL] },
        due_date: { $lt: new Date() }
      },
      { $set: { payment_status: PAYMENT_STATUS.OVERDUE } }
    );

    const skip = (Number(page) - 1) * Number(limit);
    const [debts, total] = await Promise.all([
      Purchase.find(filter)
        .populate('supplier_id', 'name code contact_person phone')
        .populate('marketlist_id', 'marketlist_number date required_date')
        .populate('purchased_by', 'name email')
        .sort({ due_date: 1, purchased_at: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Purchase.countDocuments(filter)
    ]);

    return { data: debts, total, page: Number(page), limit: Number(limit) };
  }

  async getPurchases(query = {}) {
    const {
      marketlist_id,
      supplier_id,
      startDate,
      endDate,
      payment_status,
      page = 1,
      limit = 20
    } = query;

    const filter = {};
    if (marketlist_id) filter.marketlist_id = marketlist_id;
    if (supplier_id) filter.supplier_id = supplier_id;
    if (payment_status) filter.payment_status = payment_status;

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
    const [rawPurchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate('supplier_id', 'name code contact_person phone')
        .populate('marketlist_id', 'marketlist_number date status required_date')
        .populate('purchased_by', 'name email role')
        .sort({ purchased_at: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Purchase.countDocuments(filter)
    ]);

    const purchases = await Promise.all(
      rawPurchases.map(async (p) => {
        const pItems = await PurchaseItem.find({ purchase_id: p._id }).lean();
        const obj = p.toObject ? p.toObject() : p;
        obj.items = pItems;
        return obj;
      })
    );

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

    if (!purchase) throw new Error('Transaksi pembelian tidak ditemukan.');

    const items = await PurchaseItem.find({ purchase_id: id }).populate('product_id');
    const debtPayments = await DebtPayment.find({ purchase_id: id })
      .populate('recorded_by', 'name')
      .sort({ paid_at: 1 });

    return {
      ...purchase.toObject(),
      items,
      debt_payments: debtPayments
    };
  }

  async updatePurchase(id, data, user) {
    const purchase = await Purchase.findById(id);
    if (!purchase) throw new Error('Transaksi pembelian tidak ditemukan.');

    const {
      supplier_id,
      invoice_ref,
      payment_method,
      payment_source,
      purchased_at,
      due_date,
      amount_paid: amountPaidInput,
      notes
    } = data;

    if (supplier_id) {
      const supplier = await Supplier.findById(supplier_id);
      if (!supplier) throw new Error('Supplier tidak ditemukan.');
      purchase.supplier_id = supplier_id;
    }

    if (invoice_ref !== undefined) purchase.invoice_ref = invoice_ref;
    if (purchased_at) purchase.purchased_at = new Date(purchased_at);
    if (notes !== undefined) purchase.notes = notes;

    if (payment_source) {
      purchase.payment_source = payment_source;
    } else if (payment_method) {
      purchase.payment_source = payment_method === 'transfer' ? 'bank' : 'cash';
    }

    // Handle payment method change
    const targetPaymentMethod = payment_method || purchase.payment_method;
    purchase.payment_method = targetPaymentMethod;

    if (targetPaymentMethod === 'tempo') {
      // Check existing debt payments if any
      const existingPayments = await DebtPayment.find({ purchase_id: id });
      const existingPaymentsTotal = existingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      let amountPaid = amountPaidInput !== undefined ? Number(amountPaidInput) : existingPaymentsTotal;
      if (isNaN(amountPaid) || amountPaid < 0) amountPaid = 0;

      let paymentStatus;
      if (amountPaid <= 0) {
        paymentStatus = PAYMENT_STATUS.UNPAID;
        amountPaid = 0;
      } else if (amountPaid >= purchase.total_actual) {
        paymentStatus = PAYMENT_STATUS.PAID;
        amountPaid = purchase.total_actual;
      } else {
        paymentStatus = PAYMENT_STATUS.PARTIAL;
      }

      // Check due date
      const targetDueDate = due_date ? new Date(due_date) : purchase.due_date;
      if (targetDueDate && paymentStatus !== PAYMENT_STATUS.PAID && new Date() > targetDueDate) {
        paymentStatus = PAYMENT_STATUS.OVERDUE;
      }

      purchase.payment_status = paymentStatus;
      purchase.due_date = targetDueDate || null;
      purchase.amount_paid = amountPaid;
      purchase.amount_remaining = Math.max(0, purchase.total_actual - amountPaid);
    } else {
      // Cash / Transfer: Lunas
      purchase.payment_status = PAYMENT_STATUS.PAID;
      purchase.due_date = null;
      purchase.amount_paid = purchase.total_actual;
      purchase.amount_remaining = 0;
    }

    await purchase.save();

    // Audit log
    await ActivityLog.create({
      user_id: user?._id,
      action: 'PURCHASE_UPDATED',
      entity: 'Purchase',
      entity_id: purchase._id,
      meta_data: {
        purchase_number: purchase.purchase_number,
        payment_method: purchase.payment_method,
        payment_status: purchase.payment_status,
        amount_paid: purchase.amount_paid,
        amount_remaining: purchase.amount_remaining,
        due_date: purchase.due_date
      }
    }).catch(() => null);

    return this.getPurchaseById(id);
  }

  async deletePurchase(id, user) {
    const purchase = await Purchase.findById(id);
    if (!purchase) throw new Error('Transaksi pembelian tidak ditemukan.');

    // Delete associated purchase items and debt payments
    await PurchaseItem.deleteMany({ purchase_id: id });
    await DebtPayment.deleteMany({ purchase_id: id });
    await Purchase.findByIdAndDelete(id);

    // Audit log
    await ActivityLog.create({
      user_id: user?._id,
      action: 'PURCHASE_DELETED',
      entity: 'Purchase',
      entity_id: id,
      meta_data: {
        purchase_number: purchase.purchase_number,
        marketlist_id: purchase.marketlist_id,
        supplier_id: purchase.supplier_id,
        total_actual: purchase.total_actual
      }
    }).catch(() => null);

    return { message: `Transaksi ${purchase.purchase_number} berhasil dihapus.` };
  }
}

module.exports = new PurchaseService();
