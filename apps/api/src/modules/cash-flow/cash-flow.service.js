const CashTransaction = require('./cash-transaction.model');
const Purchase = require('../purchases/purchase.model');
const DebtPayment = require('../purchases/debt-payment.model');
const Overhead = require('../overheads/overhead.model');
const OverheadPayment = require('../overheads/overhead-payment.model');
const ActivityLog = require('../audit/activity-log.model');

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Tanggal arus kas tidak valid.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
  }
  return date;
};

const isWithinPeriod = (value, startDate, endDate) => {
  const timestamp = new Date(value).getTime();
  return (!startDate || timestamp >= startDate.getTime()) &&
    (!endDate || timestamp <= endDate.getTime());
};

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
    if (source_account === 'petty_cash') {
      await this.ensurePettyCashAvailable(numAmount, date);
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

  async recordPettyCashTransfer(data, user, action) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Nominal pemindahan kas kecil harus lebih dari 0.');
    }
    const date = data.date || new Date();
    if (action === 'return') {
      await this.ensurePettyCashAvailable(amount, date);
      const dailyBalance = await this.getPettyCashDayBalance(date);
      if (amount > dailyBalance + 1e-9) {
        throw new Error('Pengembalian harus berasal dari dana kas kecil yang diterima pada tanggal yang sama.');
      }
    } else {
      const { current_cash_balance: cashBalance } = await this.getSummary({
        endDate: new Date(date).toISOString()
      });
      if (amount > cashBalance + 1e-9) {
        throw new Error(`Saldo kas besar tidak cukup untuk pendanaan kas kecil. Saldo tersedia ${Math.max(0, cashBalance)}.`);
      }
    }

    const isFunding = action === 'fund';
    const transactionNumber = await this.generateTransactionNumber(isFunding ? 'KCK' : 'KKB');
    const trx = await CashTransaction.create({
      transaction_number: transactionNumber,
      type: 'petty_transfer',
      source_account: isFunding ? 'cash' : 'petty_cash',
      to_account: isFunding ? 'petty_cash' : 'cash',
      amount,
      category: isFunding ? 'kas_kecil_fund' : 'kas_kecil_return',
      description: (data.description || (isFunding
        ? 'Dana kas besar ke kas kecil'
        : 'Sisa kas kecil dikembalikan ke kas besar')).trim(),
      reference_number: (data.reference_number || '').trim(),
      date: new Date(date),
      notes: (data.notes || '').trim(),
      created_by: user?._id
    });

    await ActivityLog.create({
      user_id: user?._id,
      action: isFunding ? 'PETTY_CASH_FUNDED' : 'PETTY_CASH_RETURNED',
      entity: 'CashTransaction',
      entity_id: trx._id,
      meta_data: {
        transaction_number: trx.transaction_number,
        amount,
        date: trx.date,
        direction: isFunding ? 'cash_to_petty_cash' : 'petty_cash_to_cash'
      }
    }).catch(() => null);

    return trx;
  }

  async getPettyCashBalance(asOf = new Date()) {
    const cutoff = new Date(asOf);
    const [transactions, purchases] = await Promise.all([
      CashTransaction.find({
        type: { $in: ['petty_transfer', 'out'] },
        date: { $lte: cutoff }
      }).lean(),
      Purchase.find({
        payment_source: 'petty_cash',
        purchased_at: { $lte: cutoff }
      }).select('total_actual amount_paid payment_method purchased_at').lean()
    ]);

    let balance = 0;
    transactions.forEach((transaction) => {
      if (transaction.type === 'petty_transfer') {
        balance += transaction.to_account === 'petty_cash'
          ? transaction.amount
          : -transaction.amount;
      } else if (transaction.source_account === 'petty_cash') {
        balance -= transaction.amount;
      }
    });
    purchases.forEach((purchase) => {
      balance -= purchase.payment_method === 'tempo'
        ? Number(purchase.amount_paid) || 0
        : Number(purchase.total_actual) || 0;
    });
    return balance;
  }

  async getPettyCashDayBalance(day) {
    const startDate = parseDateBoundary(day);
    const endDate = parseDateBoundary(day, true);
    const [transactions, purchases] = await Promise.all([
      CashTransaction.find({
        date: { $gte: startDate, $lte: endDate },
        $or: [
          { type: 'petty_transfer' },
          { type: 'out', source_account: 'petty_cash' }
        ]
      }).lean(),
      Purchase.find({
        payment_source: 'petty_cash',
        purchased_at: { $gte: startDate, $lte: endDate }
      }).select('total_actual amount_paid payment_method').lean()
    ]);
    let balance = 0;
    transactions.forEach((transaction) => {
      if (transaction.type === 'petty_transfer') {
        balance += transaction.to_account === 'petty_cash'
          ? transaction.amount
          : -transaction.amount;
      } else {
        balance -= transaction.amount;
      }
    });
    purchases.forEach((purchase) => {
      balance -= purchase.payment_method === 'tempo'
        ? Number(purchase.amount_paid) || 0
        : Number(purchase.total_actual) || 0;
    });
    return balance;
  }

  async ensurePettyCashAvailable(amount, date = new Date()) {
    const balance = await this.getPettyCashBalance(date);
    if (amount > balance + 1e-9) {
      throw new Error(`Saldo kas kecil tidak cukup. Saldo tersedia ${Math.max(0, balance)}.`);
    }
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
    const startDate = parseDateBoundary(query.startDate);
    const endDate = parseDateBoundary(query.endDate, true);
    const cutoff = endDate || new Date();
    const period = {
      total_in_cash: 0,
      total_in_bank: 0,
      total_withdrawal: 0,
      total_petty_cash_funded: 0,
      total_petty_cash_returned: 0,
      total_purchase_cash: 0,
      total_purchase_bank: 0,
      total_purchase_petty_cash: 0,
      total_debt_payment_cash: 0,
      total_debt_payment_bank: 0,
      total_overhead_cash: 0,
      total_overhead_bank: 0,
      total_out_cash_manual: 0,
      total_out_bank_manual: 0,
      total_out_petty_cash_manual: 0
    };
    const balances = { cash: 0, bank: 0, petty_cash: 0 };
    const inPeriod = (date) => isWithinPeriod(date, startDate, endDate);
    const isBeforeCutoff = (date) => new Date(date).getTime() <= cutoff.getTime();
    const addIncome = (account, amount, date) => {
      const value = Number(amount) || 0;
      if (inPeriod(date) && account === 'cash') period.total_in_cash += value;
      if (inPeriod(date) && account === 'bank') period.total_in_bank += value;
      if (isBeforeCutoff(date) && balances[account] !== undefined) balances[account] += value;
    };
    const addExpense = (account, amount, date, category) => {
      const value = Number(amount) || 0;
      if (inPeriod(date)) {
        if (category === 'purchase') {
          period[`total_purchase_${account}`] += value;
        } else if (category === 'debt') {
          period[`total_debt_payment_${account}`] += value;
        } else if (category === 'overhead') {
          period[`total_overhead_${account}`] += value;
        } else {
          period[`total_out_${account}_manual`] += value;
        }
      }
      if (isBeforeCutoff(date) && balances[account] !== undefined) balances[account] -= value;
    };

    const [transactions, purchases, debtPayments, overheads, overheadPayments] = await Promise.all([
      CashTransaction.find().lean(),
      Purchase.find().lean(),
      DebtPayment.find({ notes: { $ne: 'Uang muka / DP saat transaksi' } }).lean(),
      Overhead.find().lean(),
      OverheadPayment.find().lean()
    ]);

    transactions.forEach((transaction) => {
      if (transaction.type === 'in') {
        addIncome(transaction.to_account, transaction.amount, transaction.date);
      } else if (transaction.type === 'withdrawal') {
        const amount = Number(transaction.amount) || 0;
        if (inPeriod(transaction.date)) period.total_withdrawal += amount;
        if (isBeforeCutoff(transaction.date)) {
          balances.bank -= amount;
          balances.cash += amount;
        }
      } else if (transaction.type === 'out') {
        addExpense(transaction.source_account, transaction.amount, transaction.date, 'manual');
      } else if (transaction.type === 'petty_transfer') {
        const amount = Number(transaction.amount) || 0;
        const isFunding = transaction.to_account === 'petty_cash';
        if (inPeriod(transaction.date)) {
          if (isFunding) period.total_petty_cash_funded += amount;
          else period.total_petty_cash_returned += amount;
        }
        if (isBeforeCutoff(transaction.date)) {
          balances[transaction.source_account] -= amount;
          balances[transaction.to_account] += amount;
        }
      }
    });

    purchases.forEach((purchase) => {
      const account = purchase.payment_source ||
        (purchase.payment_method === 'transfer' ? 'bank' : 'cash');
      const amount = purchase.payment_method === 'tempo'
        ? Number(purchase.amount_paid) || 0
        : Number(purchase.total_actual) || 0;
      addExpense(account, amount, purchase.purchased_at, 'purchase');
    });

    debtPayments.forEach((payment) => {
      const account = payment.payment_method === 'transfer' ? 'bank' : 'cash';
      addExpense(account, payment.amount, payment.paid_at, 'debt');
    });

    overheads.forEach((overhead) => {
      const account = overhead.payment_method === 'transfer' ? 'bank' : 'cash';
      const amount = overhead.payment_method === 'tempo'
        ? Number(overhead.amount_paid) || 0
        : Number(overhead.amount) || 0;
      addExpense(account, amount, overhead.expense_date, 'overhead');
    });

    overheadPayments.forEach((payment) => {
      const account = payment.payment_method === 'transfer' ? 'bank' : 'cash';
      addExpense(account, payment.amount, payment.paid_at, 'overhead');
    });

    const totalPurchase = period.total_purchase_cash +
      period.total_purchase_bank +
      period.total_purchase_petty_cash;
    const totalDebtPayment = period.total_debt_payment_cash + period.total_debt_payment_bank;
    const totalOverhead = period.total_overhead_cash + period.total_overhead_bank;
    const totalOutflow = totalPurchase + totalDebtPayment + totalOverhead +
      period.total_out_cash_manual + period.total_out_bank_manual +
      period.total_out_petty_cash_manual;
    const totalInflow = period.total_in_cash + period.total_in_bank;
    const pettyCashBalance = await this.getPettyCashBalance(cutoff);
    const currentCashBalance = balances.cash;
    const currentBankBalance = balances.bank;

    return {
      current_cash_balance: currentCashBalance,
      current_petty_cash_balance: pettyCashBalance,
      current_bank_balance: currentBankBalance,
      total_liquidity: currentCashBalance + pettyCashBalance + currentBankBalance,
      total_inflow: totalInflow,
      total_in_cash: period.total_in_cash,
      total_in_bank: period.total_in_bank,
      total_withdrawal: period.total_withdrawal,
      total_petty_cash_funded: period.total_petty_cash_funded,
      total_petty_cash_returned: period.total_petty_cash_returned,
      total_purchase_cash: period.total_purchase_cash,
      total_purchase_bank: period.total_purchase_bank,
      total_purchase_petty_cash: period.total_purchase_petty_cash,
      total_purchase: totalPurchase,
      total_debt_payment_cash: period.total_debt_payment_cash,
      total_debt_payment_bank: period.total_debt_payment_bank,
      total_debt_payment: totalDebtPayment,
      total_overhead_cash: period.total_overhead_cash,
      total_overhead_bank: period.total_overhead_bank,
      total_overhead: totalOverhead,
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
    const parsedStartDate = parseDateBoundary(startDate);
    const parsedEndDate = parseDateBoundary(endDate, true);
    const isWithinDate = (date) => !date || isWithinPeriod(date, parsedStartDate, parsedEndDate);

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
          account_label: ct.source_account === 'bank'
            ? 'Rekening Bank'
            : ct.source_account === 'petty_cash' ? 'Kas Kecil' : 'Kas Besar / Tunai',
          category: ct.category,
          category_label: 'Kas Keluar Manual',
          title: ct.description,
          reference_number: ct.reference_number || ct.transaction_number,
          amount: ct.amount,
          date: ct.date,
          notes: ct.notes,
          creator: ct.created_by?.name || 'Sistem'
        });
      } else if (ct.type === 'petty_transfer') {
        if (type && type !== 'all' && type !== 'petty_cash') return;
        if (
          account &&
          account !== 'all' &&
          ct.source_account !== account &&
          ct.to_account !== account
        ) return;
        const isFunding = ct.to_account === 'petty_cash';
        const accountNames = {
          cash: 'Kas Besar',
          petty_cash: 'Kas Kecil'
        };
        list.push({
          _id: ct._id,
          source_type: 'cash_transaction',
          trx_type: 'petty_transfer',
          direction: 'transfer',
          account: 'petty_cash',
          account_label: `${accountNames[ct.source_account]} → ${accountNames[ct.to_account]}`,
          category: ct.category,
          category_label: isFunding
            ? 'Dana Kas Kecil'
            : 'Pengembalian Sisa Kas Kecil',
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
              account_label: src === 'bank'
                ? 'Rekening Bank'
                : src === 'petty_cash' ? 'Kas Kecil' : 'Kas Besar / Tunai',
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
            account_label: src === 'bank'
              ? 'Rekening Bank'
              : src === 'petty_cash' ? 'Kas Kecil' : 'Kas Besar / Tunai',
            category: 'belanja',
            category_label: `Belanja ${src === 'bank' ? 'Transfer 🏦' : src === 'petty_cash' ? 'Kas Kecil 🪙' : 'Tunai 💵'}`,
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
