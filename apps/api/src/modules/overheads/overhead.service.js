const Overhead = require('./overhead.model');
const OverheadPayment = require('./overhead-payment.model');
const { PAYMENT_STATUS, PAYMENT_METHOD } = require('@purchasing/constants');

class OverheadService {
  async createOverhead(data, user) {
    const amount = Number(data.amount) || 0;
    const paymentMethod = data.payment_method || PAYMENT_METHOD.CASH;
    const amountPaid = paymentMethod === PAYMENT_METHOD.TEMPO ? Number(data.amount_paid) || 0 : amount;
    const amountRemaining = Math.max(0, amount - amountPaid);

    let paymentStatus = PAYMENT_STATUS.PAID;
    if (paymentMethod === PAYMENT_METHOD.TEMPO) {
      if (amountRemaining === 0) {
        paymentStatus = PAYMENT_STATUS.PAID;
      } else if (data.due_date && new Date(data.due_date) < new Date()) {
        paymentStatus = PAYMENT_STATUS.OVERDUE;
      } else if (amountPaid > 0) {
        paymentStatus = PAYMENT_STATUS.PARTIAL;
      } else {
        paymentStatus = PAYMENT_STATUS.UNPAID;
      }
    }

    const overhead = new Overhead({
      title: data.title,
      category: data.category,
      amount,
      expense_date: data.expense_date ? new Date(data.expense_date) : new Date(),
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      due_date: data.due_date ? new Date(data.due_date) : null,
      amount_paid: amountPaid,
      amount_remaining: amountRemaining,
      vendor_recipient: data.vendor_recipient || '-',
      invoice_ref: data.invoice_ref || '',
      receipt_url: data.receipt_url || '',
      notes: data.notes || '',
      branch_name: data.branch_name || 'Baraja Coffee - Store Utama',
      recorded_by: user._id
    });

    await overhead.save();

    // If initial down payment (DP) was paid under tempo, record payment history
    if (paymentMethod === PAYMENT_METHOD.TEMPO && amountPaid > 0) {
      await OverheadPayment.create({
        overhead_id: overhead._id,
        amount: amountPaid,
        payment_method: data.dp_payment_method || 'transfer',
        paid_at: overhead.expense_date,
        reference_number: data.invoice_ref || 'DP Awal',
        notes: 'Uang Muka (DP) saat pencatatan biaya overhead',
        recorded_by: user._id
      });
    }

    return overhead.populate('recorded_by', 'name email role');
  }

  async listOverheads(query = {}) {
    const {
      category,
      payment_status,
      payment_method,
      startDate,
      endDate,
      q,
      page = 1,
      limit = 50
    } = query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (payment_status) {
      filter.payment_status = payment_status;
    }

    if (payment_method) {
      filter.payment_method = payment_method;
    }

    if (startDate || endDate) {
      filter.expense_date = {};
      if (startDate) filter.expense_date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.expense_date.$lte = end;
      }
    }

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { vendor_recipient: { $regex: q, $options: 'i' } },
        { invoice_ref: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [overheads, total] = await Promise.all([
      Overhead.find(filter)
        .populate('recorded_by', 'name email role')
        .sort({ expense_date: -1, created_at: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Overhead.countDocuments(filter)
    ]);

    return {
      data: overheads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    };
  }

  async getOverheadById(id) {
    const overhead = await Overhead.findById(id).populate('recorded_by', 'name email role');
    if (!overhead) {
      const err = new Error('Data biaya overhead tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    const payments = await OverheadPayment.find({ overhead_id: id })
      .populate('recorded_by', 'name email')
      .sort({ paid_at: -1 });

    const obj = overhead.toObject();
    obj.payments = payments;
    return obj;
  }

  async updateOverhead(id, data, user) {
    const overhead = await Overhead.findById(id);
    if (!overhead) {
      const err = new Error('Data biaya overhead tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (data.title !== undefined) overhead.title = data.title;
    if (data.category !== undefined) overhead.category = data.category;
    if (data.vendor_recipient !== undefined) overhead.vendor_recipient = data.vendor_recipient;
    if (data.invoice_ref !== undefined) overhead.invoice_ref = data.invoice_ref;
    if (data.receipt_url !== undefined) overhead.receipt_url = data.receipt_url;
    if (data.notes !== undefined) overhead.notes = data.notes;
    if (data.branch_name !== undefined) overhead.branch_name = data.branch_name;
    if (data.due_date !== undefined) overhead.due_date = data.due_date ? new Date(data.due_date) : null;

    await overhead.save();
    return overhead.populate('recorded_by', 'name email role');
  }

  async deleteOverhead(id, user) {
    const overhead = await Overhead.findById(id);
    if (!overhead) {
      const err = new Error('Data biaya overhead tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    await Promise.all([
      Overhead.findByIdAndDelete(id),
      OverheadPayment.deleteMany({ overhead_id: id })
    ]);

    return { success: true, message: 'Data overhead berhasil dihapus' };
  }

  async getOverheadSummary(query = {}) {
    const { startDate, endDate, category } = query;
    const filter = {};

    if (category) filter.category = category;

    if (startDate || endDate) {
      filter.expense_date = {};
      if (startDate) filter.expense_date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.expense_date.$lte = end;
      }
    }

    const allOverheads = await Overhead.find(filter);

    let totalExpense = 0;
    let totalPaid = 0;
    let totalDebt = 0;
    let overdueCount = 0;
    const categoryTotals = {};

    const now = new Date();

    allOverheads.forEach((item) => {
      totalExpense += item.amount || 0;
      totalPaid += item.amount_paid || 0;
      totalDebt += item.amount_remaining || 0;

      const cat = item.category || 'lain_lain';
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { category: cat, total: 0, count: 0 };
      }
      categoryTotals[cat].total += item.amount || 0;
      categoryTotals[cat].count += 1;

      if (
        item.payment_status !== PAYMENT_STATUS.PAID &&
        item.due_date &&
        new Date(item.due_date) < now
      ) {
        overdueCount += 1;
      }
    });

    const categoryBreakdown = Object.values(categoryTotals).sort((a, b) => b.total - a.total);

    return {
      total_expense: totalExpense,
      total_paid: totalPaid,
      total_debt: totalDebt,
      overdue_count: overdueCount,
      total_records: allOverheads.length,
      category_breakdown: categoryBreakdown
    };
  }

  async getOverheadDebts(query = {}) {
    const filter = {
      payment_status: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIAL, PAYMENT_STATUS.OVERDUE] }
    };

    if (query.category) {
      filter.category = query.category;
    }

    const now = new Date();
    // Update any records that have passed due_date to 'overdue'
    await Overhead.updateMany(
      {
        payment_status: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIAL] },
        due_date: { $ne: null, $lt: now },
        amount_remaining: { $gt: 0 }
      },
      {
        $set: { payment_status: PAYMENT_STATUS.OVERDUE }
      }
    );

    const debts = await Overhead.find(filter)
      .populate('recorded_by', 'name email role')
      .sort({ due_date: 1, created_at: -1 });

    const totalDebtAmount = debts.reduce((sum, item) => sum + (item.amount_remaining || 0), 0);
    const overdueDebts = debts.filter((d) => d.payment_status === PAYMENT_STATUS.OVERDUE);

    return {
      debts,
      summary: {
        total_outstanding_debt: totalDebtAmount,
        total_debt_records: debts.length,
        overdue_records_count: overdueDebts.length,
        overdue_total_amount: overdueDebts.reduce((sum, item) => sum + (item.amount_remaining || 0), 0)
      }
    };
  }

  async recordPayment(id, paymentData, user) {
    const overhead = await Overhead.findById(id);
    if (!overhead) {
      const err = new Error('Data biaya overhead tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    if (overhead.payment_status === PAYMENT_STATUS.PAID || overhead.amount_remaining <= 0) {
      const err = new Error('Tagihan overhead ini sudah lunas');
      err.statusCode = 400;
      throw err;
    }

    const payAmount = Number(paymentData.amount);
    if (!payAmount || payAmount <= 0) {
      const err = new Error('Nominal pembayaran harus lebih besar dari 0');
      err.statusCode = 400;
      throw err;
    }

    if (payAmount > overhead.amount_remaining) {
      const err = new Error(
        `Pembayaran melebihi sisa hutang (Maksimal Rp ${overhead.amount_remaining.toLocaleString('id-ID')})`
      );
      err.statusCode = 400;
      throw err;
    }

    const payment = await OverheadPayment.create({
      overhead_id: overhead._id,
      amount: payAmount,
      payment_method: paymentData.payment_method || 'transfer',
      paid_at: paymentData.paid_at ? new Date(paymentData.paid_at) : new Date(),
      reference_number: paymentData.reference_number || '',
      attachment: paymentData.attachment || '',
      notes: paymentData.notes || '',
      recorded_by: user._id
    });

    overhead.amount_paid = (overhead.amount_paid || 0) + payAmount;
    overhead.amount_remaining = Math.max(0, overhead.amount - overhead.amount_paid);

    if (overhead.amount_remaining === 0) {
      overhead.payment_status = PAYMENT_STATUS.PAID;
    } else {
      overhead.payment_status =
        overhead.due_date && new Date(overhead.due_date) < new Date()
          ? PAYMENT_STATUS.OVERDUE
          : PAYMENT_STATUS.PARTIAL;
    }

    await overhead.save();

    return {
      overhead,
      payment
    };
  }

  async getPayments(id) {
    const payments = await OverheadPayment.find({ overhead_id: id })
      .populate('recorded_by', 'name email role')
      .sort({ paid_at: -1 });

    return payments;
  }
}

module.exports = new OverheadService();

