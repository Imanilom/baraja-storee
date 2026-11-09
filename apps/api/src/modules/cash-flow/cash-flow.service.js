const CashTransaction = require('./cash-transaction.model');
const Purchase = require('../purchases/purchase.model');
const DebtPayment = require('../purchases/debt-payment.model');
const Overhead = require('../overheads/overhead.model');
const OverheadPayment = require('../overheads/overhead-payment.model');
const ActivityLog = require('../audit/activity-log.model');

class CashFlowService {
  async generateTransactionNumber(prefix = 'KM') {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const fullPrefix = `${prefix}-${dateStr}`;
    const count = await CashTransaction.countDocuments({
      transaction_number: new RegExp(`^${fullPrefix}`)
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${fullPrefix}-${seq}`;
  }

  // 1. Catat Uang Masuk (Modal, Setoran POS, Transfer Masuk, dll.)
  async recordCashIn(data, user) {
    const {
      amount,
      to_account = 'cash', // 'cash' (Kas Tunai) | 'bank' (Rekening Bank)
      category = 'modal',
      description,
      reference_number = '',
      date = new Date(),
      attachment = '',
      notes = ''
    } = data;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Nominal uang masuk harus lebih dari 0.');
    }
    if (!description || !description.trim()) {
      throw new Error('Keterangan uang masuk wajib diisi.');
    }

    const transactionNumber = await this.generateTransactionNumber('KM');

    const trx = await CashTransaction.create({
      transaction_number: transactionNumber,
      type: 'in',
      source_account: 'bank', // dummy origin if external
      to_account,
      amount: numAmount,
      category,
      description: description.trim(),
      reference_number: reference_number.trim(),
      date: new Date(date),
      attachment,
      notes: notes.trim(),
      created_by: user?._id
    });

    await ActivityLog.create({
      user_id: user?._id,
      action: 'CASH_IN_RECORDED',
      entity: 'CashTransaction',
      entity_id: trx._id,
      meta_data: {
        transaction_number: trx.transaction_number,
        amount: numAmount,
        to_account,
        category,
        description: trx.description
      }
    }).catch(() => null);

    return trx;
  }

  // 2. Catat Tarik Tunai (Dari Rekening Bank ke Kas Tunai)
  async recordWithdrawal(data, user) {
    const {
      amount,
      description = 'Tarik Tunai dari Rekening Bank ke Kas Tunai',
      reference_number = '',
      date = new Date(),
      attachment = '',
      notes = ''
    } = data;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Nominal tarik tunai harus lebih dari 0.');
    }

    const transactionNumber = await this.generateTransactionNumber('TT');

    const trx = await CashTransaction.create({
      transaction_number: transactionNumber,
      type: 'withdrawal',
      source_account: 'bank', // Keluar dari Rekening Bank
      to_account: 'cash',      // Masuk ke Kas Tunai
      amount: numAmount,
      category: 'tarik_tunai',
      description: description.trim(),
      reference_number: reference_number.trim(),
      date: new Date(date),
      attachment,
      notes: notes.trim(),
      created_by: user?._id
    });

    await ActivityLog.create({
      user_id: user?._id,
      action: 'CASH_WITHDRAWAL_RECORDED',
      entity: 'CashTransaction',
      entity_id: trx._id,
      meta_data: {
        transaction_number: trx.transaction_number,
        amount: numAmount,
        description: trx.description
      }
    }).catch(() => null);

    return trx;
  }

  // 3. Catat Kas Keluar Manual / Pengeluaran Lainnya
  async recordCashOut(data, user) {
    const {
      amount,
      source_account = 'cash', // 'cash' | 'bank'
      category = 'operasional_manual',
      description,
      reference_number = '',
      date = new Date(),
      attachment = '',
      notes = ''
    } = data;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Nominal pengeluaran harus lebih dari 0.');
    }
    if (!description || !description.trim()) {
      throw new Error('Keterangan pengeluaran wajib diisi.');
    }

    const transactionNumber = await this.generateTransactionNumber('KK');

    const trx = await CashTransaction.create({
      transaction_number: transactionNumber,
      type: 'out',
      source_account,
      to_account: null,
      amount: numAmount,
      category,
      description: description.trim(),
      reference_number: reference_number.trim(),
      date: new Date(date),
      attachment,
      notes: notes.trim(),
      created_by: user?._id
    });

    await ActivityLog.create({
      user_id: user?._id,
      action: 'CASH_OUT_RECORDED',
      entity: 'CashTransaction',
      entity_id: trx._id,
      meta_data: {
        transaction_number: trx.transaction_number,
        amount: numAmount,
        source_account,
        category,
        description: trx.description
      }
    }).catch(() => null);

    return trx;
  }

  // Hapus transaksi manual jika salah input
  async deleteTransaction(id, user) {
    const trx = await CashTransaction.findById(id);
    if (!trx) throw new Error('Data transaksi arus kas tidak ditemukan.');

    await CashTransaction.findByIdAndDelete(id);

    await ActivityLog.create({
      user_id: user?._id,
      action: 'CASH_TRANSACTION_DELETED',
      entity: 'CashTransaction',
      entity_id: id,
      meta_data: {
        transaction_number: trx.transaction_number,
        amount: trx.amount,
        type: trx.type
      }
    }).catch(() => null);

    return { message: `Transaksi ${trx.transaction_number} berhasil dihapus.` };
  }

  // 4. Ringkasan Saldo & Arus Kas (Realtime Dashboard)
  async getSummary(query = {}) {
    const { startDate, endDate } = query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.$gte = startDate ? new Date(startDate) : new Date('2020-01-01');
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = eDate;
      }
    }

    // A. Manual Transactions
    const allCashTransactions = await CashTransaction.find().lean();

    let totalInCash = 0;
    let totalInBank = 0;
    let totalWithdrawal = 0;
    let totalOutCashManual = 0;
    let totalOutBankManual = 0;

    allCashTransactions.forEach((t) => {
      if (t.type === 'in') {
        if (t.to_account === 'cash') totalInCash += t.amount || 0;
        else if (t.to_account === 'bank') totalInBank += t.amount || 0;
      } else if (t.type === 'withdrawal') {
        totalWithdrawal += t.amount || 0;
      } else if (t.type === 'out') {
        if (t.source_account === 'cash') totalOutCashManual += t.amount || 0;
        else if (t.source_account === 'bank') totalOutBankManual += t.amount || 0;
      }
    });

    // B. Purchases
    const allPurchases = await Purchase.find().lean();
    let totalPurchaseCash = 0;
    let totalPurchaseBank = 0;

    allPurchases.forEach((p) => {
      const src = p.payment_source || (p.payment_method === 'transfer' ? 'bank' : 'cash');
      if (p.payment_method === 'tempo') {
        // Only count what was already paid (DP)
        const dp = Number(p.amount_paid) || 0;
        if (dp > 0) {
          if (src === 'bank') totalPurchaseBank += dp;
          else totalPurchaseCash += dp;
        }
      } else {
        // Cash or transfer paid full
        const tot = Number(p.total_actual) || 0;
        if (src === 'bank') totalPurchaseBank += tot;
        else totalPurchaseCash += tot;
      }
    });

    // C. Debt Payments (Bayar Hutang Supplier)
    const allDebtPayments = await DebtPayment.find().lean();
    let totalDebtPayCash = 0;
    let totalDebtPayBank = 0;

    allDebtPayments.forEach((dp) => {
      // Note: first DP in tempo creation might be logged as debt payment, avoid double counting
      const amt = Number(dp.amount) || 0;
      if (dp.notes === 'Uang muka / DP saat transaksi') return; // already counted in Purchase DP
      if (dp.payment_method === 'transfer') totalDebtPayBank += amt;
      else totalDebtPayCash += amt;
    });

    // D. Overheads
    let totalOverheadCash = 0;
    let totalOverheadBank = 0;
    try {
      const allOverheads = await Overhead.find().lean();
      allOverheads.forEach((ov) => {
        if (ov.payment_method === 'tempo') {
          const dp = Number(ov.amount_paid) || 0;
          if (dp > 0) totalOverheadCash += dp;
        } else {
          const tot = Number(ov.amount) || 0;
          if (ov.payment_method === 'transfer') totalOverheadBank += tot;
          else totalOverheadCash += tot;
        }
      });

      const allOverheadPayments = await OverheadPayment.find().lean();
      allOverheadPayments.forEach((op) => {
        const amt = Number(op.amount) || 0;
        if (op.payment_method === 'transfer') totalOverheadBank += amt;
        else totalOverheadCash += amt;
      });
    } catch (_) {}

    // Calculation:
    // Saldo Kas Tunai = (Uang Masuk ke Kas + Tarik Tunai ke Kas) - (Belanja Kas + Bayar Hutang Kas + Overhead Kas + Keluar Manual Kas)
    const currentCashBalance =
      (totalInCash + totalWithdrawal) -
      (totalPurchaseCash + totalDebtPayCash + totalOverheadCash + totalOutCashManual);

    // Saldo Rekening Bank = (Uang Masuk ke Bank) - (Tarik Tunai dari Bank + Belanja Bank + Bayar Hutang Bank + Overhead Bank + Keluar Manual Bank)
    const currentBankBalance =
      totalInBank -
      (totalWithdrawal + totalPurchaseBank + totalDebtPayBank + totalOverheadBank + totalOutBankManual);

    const totalLiquidity = currentCashBalance + currentBankBalance;
    const totalInflow = totalInCash + totalInBank;
    const totalOutflow =
      totalPurchaseCash + totalPurchaseBank +
      totalDebtPayCash + totalDebtPayBank +
      totalOverheadCash + totalOverheadBank +
      totalOutCashManual + totalOutBankManual;

    return {
      current_cash_balance: currentCashBalance,
      current_bank_balance: currentBankBalance,
      total_liquidity: totalLiquidity,
      total_inflow: totalInflow,
      total_in_cash: totalInCash,
      total_in_bank: totalInBank,
      total_withdrawal: totalWithdrawal,
      total_purchase_cash: totalPurchaseCash,
      total_purchase_bank: totalPurchaseBank,
      total_purchase: totalPurchaseCash + totalPurchaseBank,
      total_debt_payment_cash: totalDebtPayCash,
      total_debt_payment_bank: totalDebtPayBank,
      total_debt_payment: totalDebtPayCash + totalDebtPayBank,
      total_overhead_cash: totalOverheadCash,
      total_overhead_bank: totalOverheadBank,
      total_overhead: totalOverheadCash + totalOverheadBank,
      total_outflow: totalOutflow
    };
  }

  // 5. Riwayat Mutasi Arus Kas Terpadu (Unified Ledger)
  async getMutations(query = {}) {
    const {
      account, // 'all' | 'cash' | 'bank'
      type,    // 'all' | 'in' | 'withdrawal' | 'out' | 'purchase' | 'debt_payment' | 'overhead'
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = query;

    const list = [];

    // Filter date helper
    const isWithinDate = (d) => {
      if (!d) return true;
      const t = new Date(d).getTime();
      if (startDate && t < new Date(startDate).getTime()) return false;
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        if (t > e.getTime()) return false;
      }
      return true;
    };

    // 1. Manual Cash Transactions
    const cashTrxList = await CashTransaction.find()
      .populate('created_by', 'name email')
      .sort({ date: -1 })
      .lean();

    cashTrxList.forEach((ct) => {
      if (!isWithinDate(ct.date)) return;

      if (ct.type === 'in') {
        if (type && type !== 'all' && type !== 'in') return;
        if (account && account !== 'all' && ct.to_account !== account) return;

        list.push({
          _id: ct._id,
          source_type: 'cash_transaction',
          trx_type: 'in',
          direction: 'in', // Uang Masuk (+)
          account: ct.to_account, // 'cash' atau 'bank'
          account_label: ct.to_account === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
          category: ct.category,
          category_label: 'Uang Masuk',
          title: ct.description,
          reference_number: ct.reference_number || ct.transaction_number,
          amount: ct.amount,
          date: ct.date,
          notes: ct.notes,
          creator: ct.created_by?.name || 'Sistem'
        });
      } else if (ct.type === 'withdrawal') {
        if (type && type !== 'all' && type !== 'withdrawal') return;
        // Withdrawal affects both bank (-out) and cash (+in)
        if (account === 'bank') {
          list.push({
            _id: ct._id,
            source_type: 'cash_transaction',
            trx_type: 'withdrawal',
            direction: 'out',
            account: 'bank',
            account_label: 'Rekening Bank',
            category: 'tarik_tunai',
            category_label: 'Tarik Tunai (Keluar)',
            title: `Tarik Tunai ke Kas: ${ct.description}`,
            reference_number: ct.reference_number || ct.transaction_number,
            amount: ct.amount,
            date: ct.date,
            notes: ct.notes,
            creator: ct.created_by?.name || 'Sistem'
          });
        } else if (account === 'cash') {
          list.push({
            _id: ct._id,
            source_type: 'cash_transaction',
            trx_type: 'withdrawal',
            direction: 'in',
            account: 'cash',
            account_label: 'Kas Tunai',
            category: 'tarik_tunai',
            category_label: 'Tarik Tunai (Masuk Kas)',
            title: `Penerimaan Tarik Tunai dari Rekening: ${ct.description}`,
            reference_number: ct.reference_number || ct.transaction_number,
            amount: ct.amount,
            date: ct.date,
            notes: ct.notes,
            creator: ct.created_by?.name || 'Sistem'
          });
        } else {
          // 'all' accounts: represent as a transfer
          list.push({
            _id: ct._id,
            source_type: 'cash_transaction',
            trx_type: 'withdrawal',
            direction: 'transfer',
            account: 'transfer',
            account_label: 'Rekening Bank ➔ Kas Tunai',
            category: 'tarik_tunai',
            category_label: 'Tarik Tunai 🏧',
            title: ct.description,
            reference_number: ct.reference_number || ct.transaction_number,
            amount: ct.amount,
            date: ct.date,
            notes: ct.notes,
            creator: ct.created_by?.name || 'Sistem'
          });
        }
      } else if (ct.type === 'out') {
        if (type && type !== 'all' && type !== 'out') return;
        if (account && account !== 'all' && ct.source_account !== account) return;

        list.push({
          _id: ct._id,
          source_type: 'cash_transaction',
          trx_type: 'out',
          direction: 'out',
          account: ct.source_account,
          account_label: ct.source_account === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
          category: ct.category,
          category_label: 'Kas Keluar Manual',
          title: ct.description,
          reference_number: ct.reference_number || ct.transaction_number,
          amount: ct.amount,
          date: ct.date,
          notes: ct.notes,
          creator: ct.created_by?.name || 'Sistem'
        });
      }
    });

    // 2. Purchases (Belanja Supplier)
    if (!type || type === 'all' || type === 'purchase') {
      const purchases = await Purchase.find()
        .populate('supplier_id', 'name')
        .populate('purchased_by', 'name')
        .sort({ purchased_at: -1 })
        .lean();

      purchases.forEach((p) => {
        if (!isWithinDate(p.purchased_at)) return;
        const src = p.payment_source || (p.payment_method === 'transfer' ? 'bank' : 'cash');
        if (account && account !== 'all' && src !== account) return;

        if (p.payment_method === 'tempo') {
          const dp = Number(p.amount_paid) || 0;
          if (dp > 0) {
            list.push({
              _id: p._id,
              source_type: 'purchase',
              trx_type: 'purchase_dp',
              direction: 'out',
              account: src,
              account_label: src === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
              category: 'belanja',
              category_label: 'DP Belanja Tempo 🛒',
              title: `Uang Muka Belanja ${p.supplier_id?.name || 'Supplier'} (${p.purchase_number})`,
              reference_number: p.invoice_ref || p.purchase_number,
              amount: dp,
              date: p.purchased_at,
              notes: p.notes,
              creator: p.purchased_by?.name || 'Staff'
            });
          }
        } else {
          list.push({
            _id: p._id,
            source_type: 'purchase',
            trx_type: 'purchase',
            direction: 'out',
            account: src,
            account_label: src === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
            category: 'belanja',
            category_label: `Belanja ${src === 'bank' ? 'Transfer 🏦' : 'Tunai 💵'}`,
            title: `Belanja ${p.supplier_id?.name || 'Supplier'} (${p.purchase_number})`,
            reference_number: p.invoice_ref || p.purchase_number,
            amount: p.total_actual,
            date: p.purchased_at,
            notes: p.notes,
            creator: p.purchased_by?.name || 'Staff'
          });
        }
      });
    }

    // 3. Debt Payments (Bayar Hutang Supplier)
    if (!type || type === 'all' || type === 'debt_payment') {
      const debtPayments = await DebtPayment.find()
        .populate({
          path: 'purchase_id',
          populate: { path: 'supplier_id', select: 'name' }
        })
        .populate('recorded_by', 'name')
        .sort({ paid_at: -1 })
        .lean();

      debtPayments.forEach((dp) => {
        if (!isWithinDate(dp.paid_at)) return;
        if (dp.notes === 'Uang muka / DP saat transaksi') return; // handled in purchase DP

        const src = dp.payment_method === 'transfer' ? 'bank' : 'cash';
        if (account && account !== 'all' && src !== account) return;

        const supName = dp.purchase_id?.supplier_id?.name || 'Supplier';
        const pNum = dp.purchase_id?.purchase_number || '';

        list.push({
          _id: dp._id,
          source_type: 'debt_payment',
          trx_type: 'debt_payment',
          direction: 'out',
          account: src,
          account_label: src === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
          category: 'bayar_hutang',
          category_label: `Bayar Hutang ${src === 'bank' ? 'Transfer 🏦' : 'Tunai 💵'}`,
          title: `Bayar Hutang ${supName} (${pNum})`,
          reference_number: dp.reference_number || '',
          amount: dp.amount,
          date: dp.paid_at,
          notes: dp.notes,
          creator: dp.recorded_by?.name || 'Staff'
        });
      });
    }

    // 4. Overheads
    if (!type || type === 'all' || type === 'overhead') {
      try {
        const overheads = await Overhead.find()
          .populate('created_by', 'name')
          .sort({ expense_date: -1 })
          .lean();

        overheads.forEach((ov) => {
          if (!isWithinDate(ov.expense_date)) return;
          const src = ov.payment_method === 'transfer' ? 'bank' : 'cash';
          if (account && account !== 'all' && src !== account) return;

          const amt = ov.payment_method === 'tempo' ? (Number(ov.amount_paid) || 0) : Number(ov.amount || 0);
          if (amt <= 0) return;

          list.push({
            _id: ov._id,
            source_type: 'overhead',
            trx_type: 'overhead',
            direction: 'out',
            account: src,
            account_label: src === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
            category: 'overhead',
            category_label: 'Biaya Overhead ⚡',
            title: `${ov.title} (${ov.category})`,
            reference_number: ov.receipt_number || '',
            amount: amt,
            date: ov.expense_date,
            notes: ov.notes,
            creator: ov.created_by?.name || 'Staff'
          });
        });

        const ovPayments = await OverheadPayment.find()
          .populate('overhead_id', 'title category')
          .populate('recorded_by', 'name')
          .sort({ paid_at: -1 })
          .lean();

        ovPayments.forEach((op) => {
          if (!isWithinDate(op.paid_at)) return;
          const src = op.payment_method === 'transfer' ? 'bank' : 'cash';
          if (account && account !== 'all' && src !== account) return;

          list.push({
            _id: op._id,
            source_type: 'overhead_payment',
            trx_type: 'overhead_payment',
            direction: 'out',
            account: src,
            account_label: src === 'bank' ? 'Rekening Bank' : 'Kas Tunai',
            category: 'overhead',
            category_label: 'Bayar Hutang Overhead ⚡',
            title: `Bayar ${op.overhead_id?.title || 'Overhead'}`,
            reference_number: op.reference_number || '',
            amount: op.amount,
            date: op.paid_at,
            notes: op.notes,
            creator: op.recorded_by?.name || 'Staff'
          });
        });
      } catch (_) {}
    }

    // Sort chronologically (terbaru di atas)
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const numPage = Number(page);
    const numLimit = Number(limit);
    const total = list.length;
    const startIndex = (numPage - 1) * numLimit;
    const paginated = list.slice(startIndex, startIndex + numLimit);

    return {
      data: paginated,
      total,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(total / numLimit)
    };
  }
}

module.exports = new CashFlowService();

