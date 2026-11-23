const crypto = require('crypto');
const mongoose = require('mongoose');
const CashTransaction = require('./cash-transaction.model');
const Overhead = require('../overheads/overhead.model');
const OverheadPayment = require('../overheads/overhead-payment.model');
const CashWithdrawalReconciliation = require('./cash-withdrawal-reconciliation.model');
const {
  isCreditDirection,
  isDebitDirection,
  parseAmount,
  parseStatementDate,
  normalizePhrase
} = require('./purchase-reconciliation.service');

const MAX_STATEMENT_ROWS = 2000;
const MAX_ALLOCATIONS = 100;
const MAX_EXPENSE_OPTIONS = 500;
const MATCH_WINDOW_DAYS = 90;
const ALLOCATION_WINDOW_DAYS = 30;

const makeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createFingerprint = (row) => {
  const date = parseStatementDate(row.date);
  const day = date ? date.toISOString().slice(0, 10) : '';
  const reference = normalizePhrase(row.reference);
  const identity = reference || `${normalizePhrase(row.description)}:${row.rowNumber}`;
  return crypto.createHash('sha256')
    .update(`${day}|${identity}|${parseAmount(row.amount)}`)
    .digest('hex');
};

const parseAllocationKey = (key) => {
  const match = String(key).match(/^(overhead|overhead-payment):([a-f\d]{24})$/i);
  if (!match || !mongoose.Types.ObjectId.isValid(match[2])) return null;
  return {
    sourceType: match[1] === 'overhead-payment' ? 'overhead_payment' : 'overhead',
    id: new mongoose.Types.ObjectId(match[2])
  };
};

const statementRows = (rows, debitMode) => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_STATEMENT_ROWS) {
    throw makeError(`Masukkan 1 sampai ${MAX_STATEMENT_ROWS} baris rekening koran.`);
  }
  if (!['positive', 'negative'].includes(debitMode)) {
    throw makeError('Mode nominal debit tidak valid.');
  }

  return rows.flatMap((source, index) => {
    const rawAmount = source?.amount;
    if (rawAmount === null || rawAmount === undefined || String(rawAmount).trim() === '') return [];
    const amount = parseAmount(rawAmount);
    const direction = String(source?.direction || '').trim();
    if (direction && isCreditDirection(direction)) return [];
    if (direction && !isDebitDirection(direction)) return [];
    if (!direction && amount !== null &&
      (debitMode === 'positive' ? amount <= 0 : amount >= 0)) return [];
    if (amount === null) return [];
    return [{
      rowNumber: Number.isInteger(Number(source?.rowNumber)) ? Number(source.rowNumber) : index + 2,
      date: source?.date instanceof Date ? source.date.toISOString() : String(source?.date || ''),
      description: String(source?.description || '').trim().slice(0, 500),
      reference: String(source?.reference || '').trim().slice(0, 200),
      amount: Math.abs(amount)
    }];
  });
};

const isWithinStatementWindow = (withdrawalDate, statementDate) => {
  if (!statementDate) return true;
  const date = parseStatementDate(withdrawalDate);
  if (!date) return false;
  return Math.abs(date.getTime() - statementDate.getTime()) <= MATCH_WINDOW_DAYS * 86400000;
};

const getAllocationWindow = (withdrawalDate) => {
  const start = new Date(withdrawalDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + ALLOCATION_WINDOW_DAYS);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const formatCashWithdrawal = (withdrawal, saved) => ({
  id: String(withdrawal._id),
  transaction_number: withdrawal.transaction_number,
  description: withdrawal.description,
  reference: withdrawal.reference_number || '',
  date: withdrawal.date,
  amount: Number(withdrawal.amount),
  saved: Boolean(saved)
});

const reconcileCashWithdrawals = async ({ rows, debitMode = 'positive' } = {}) => {
  const parsedRows = statementRows(rows, debitMode);
  const [withdrawals, savedRecords] = await Promise.all([
    CashTransaction.find({
      type: 'withdrawal',
      source_account: 'bank',
      to_account: 'cash',
      amount: { $in: [...new Set(parsedRows.map((row) => row.amount))] }
    })
      .select('_id transaction_number description reference_number date amount')
      .lean(),
    CashWithdrawalReconciliation.find()
      .select('fingerprint cash_transaction_id')
      .lean()
  ]);
  const savedByWithdrawal = new Map(
    savedRecords.map((record) => [String(record.cash_transaction_id), record])
  );
  const rowsWithCandidates = parsedRows.map((row) => {
    const fingerprint = createFingerprint(row);
    const statementTimestamp = parseStatementDate(row.date)?.getTime();
    const matchingWithdrawals = withdrawals
      .filter((withdrawal) => (
        Number(withdrawal.amount) === row.amount &&
        isWithinStatementWindow(withdrawal.date, parseStatementDate(row.date))
      ))
      .filter((withdrawal) => {
        const saved = savedByWithdrawal.get(String(withdrawal._id));
        return !saved || saved.fingerprint === fingerprint;
      })
      .sort((first, second) => {
        if (statementTimestamp === undefined) return new Date(second.date) - new Date(first.date);
        return Math.abs(new Date(first.date).getTime() - statementTimestamp) -
          Math.abs(new Date(second.date).getTime() - statementTimestamp);
      });
    const candidates = matchingWithdrawals.slice(0, 30)
      .map((withdrawal) => formatCashWithdrawal(
        withdrawal,
        savedByWithdrawal.get(String(withdrawal._id))
      ));
    return {
      rowNumber: row.rowNumber,
      date: row.date,
      description: row.description,
      reference: row.reference,
      amount: row.amount,
      candidates,
      has_more_candidates: matchingWithdrawals.length > candidates.length
    };
  });

  return {
    summary: {
      debit_rows: parsedRows.length,
      rows_with_withdrawal_candidates: rowsWithCandidates.filter((row) => row.candidates.length > 0).length
    },
    rows: rowsWithCandidates
  };
};

const getCashOverheadOptions = async (withdrawalId) => {
  if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
    throw makeError('ID transaksi tarik tunai tidak valid.');
  }
  const withdrawal = await CashTransaction.findOne({
    _id: withdrawalId,
    type: 'withdrawal',
    source_account: 'bank',
    to_account: 'cash'
  })
    .select('_id transaction_number description date amount')
    .lean();
  if (!withdrawal) throw makeError('Transaksi tarik tunai tidak ditemukan.');

  const { start, end } = getAllocationWindow(withdrawal.date);
  const existing = await CashWithdrawalReconciliation.findOne({
    cash_transaction_id: withdrawal._id
  }).lean();
  const [overheads, overheadPayments] = await Promise.all([
    Overhead.find({
      payment_method: 'cash',
      expense_date: { $gte: start, $lte: end }
    })
      .select('_id title category amount expense_date')
      .sort({ expense_date: 1, _id: 1 })
      .limit(MAX_EXPENSE_OPTIONS + 1)
      .lean(),
    OverheadPayment.find({
      payment_method: 'cash',
      paid_at: { $gte: start, $lte: end }
    })
      .populate('overhead_id', 'title category')
      .select('_id overhead_id amount paid_at reference_number')
      .sort({ paid_at: 1, _id: 1 })
      .limit(MAX_EXPENSE_OPTIONS + 1)
      .lean()
  ]);

  const options = [
    ...overheads.map((overhead) => ({
      key: `overhead:${overhead._id}`,
      source_type: 'overhead',
      title: overhead.title,
      category: overhead.category,
      date: overhead.expense_date,
      amount: Number(overhead.amount) || 0
    })),
    ...overheadPayments.filter((payment) => payment.overhead_id).map((payment) => ({
      key: `overhead-payment:${payment._id}`,
      source_type: 'overhead_payment',
      title: `Pembayaran ${payment.overhead_id.title}`,
      category: payment.overhead_id.category,
      reference: payment.reference_number || '',
      date: payment.paid_at,
      amount: Number(payment.amount) || 0
    }))
  ].sort((first, second) => (
    new Date(first.date).getTime() - new Date(second.date).getTime()
  ));
  const candidateIds = options.map((option) => (
    new mongoose.Types.ObjectId(option.key.split(':')[1])
  ));
  const otherAllocations = candidateIds.length
    ? await CashWithdrawalReconciliation.find({
      cash_transaction_id: { $ne: withdrawal._id },
      allocations: { $elemMatch: { source_id: { $in: candidateIds } } }
    })
      .select('allocations')
      .lean()
    : [];
  const assignedElsewhere = new Set(
    otherAllocations.flatMap((record) => record.allocations.map((allocation) => (
      `${allocation.source_type}:${allocation.source_id}`
    )))
  );
  const previouslySelected = new Set((existing?.allocations || []).map((allocation) => (
    `${allocation.source_type === 'overhead_payment' ? 'overhead-payment' : 'overhead'}:${allocation.source_id}`
  )));
  const matchingOptions = options
    .filter((option) => !assignedElsewhere.has(option.key) || previouslySelected.has(option.key));
  const availableOptions = matchingOptions.slice(0, MAX_EXPENSE_OPTIONS);
  const selectedKeys = [...previouslySelected].filter((key) => (
    availableOptions.some((option) => option.key === key)
  ));
  const allocatedAmount = selectedKeys.reduce((sum, key) => {
    const option = availableOptions.find((item) => item.key === key);
    return sum + (option?.amount || 0);
  }, 0);

  return {
    withdrawal: formatCashWithdrawal(withdrawal, existing),
    allocation_window_days: ALLOCATION_WINDOW_DAYS,
    options: availableOptions,
    selected_keys: selectedKeys,
    allocated_amount: allocatedAmount,
    remaining_amount: Number(withdrawal.amount) - allocatedAmount,
    has_more: overheads.length > MAX_EXPENSE_OPTIONS ||
      overheadPayments.length > MAX_EXPENSE_OPTIONS ||
      matchingOptions.length > MAX_EXPENSE_OPTIONS
  };
};

const saveCashWithdrawalReconciliations = async ({ rows, user } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_STATEMENT_ROWS) {
    throw makeError(`Pilih 1 sampai ${MAX_STATEMENT_ROWS} hasil tarik tunai untuk disimpan.`);
  }

  const seenWithdrawals = new Set();
  const seenAllocations = new Set();
  const preparedRows = rows.map((row) => {
    const description = String(row?.description || '').trim().slice(0, 500);
    const amount = parseAmount(row?.amount);
    const cashTransactionId = String(row?.cashTransactionId || '');
    const allocationKeys = Array.isArray(row?.allocationKeys)
      ? [...new Set(row.allocationKeys)]
      : [];
    if (!description || amount === null || amount <= 0 ||
      !mongoose.Types.ObjectId.isValid(cashTransactionId) ||
      allocationKeys.length > MAX_ALLOCATIONS) {
      throw makeError('Data rekonsiliasi tarik tunai tidak valid.');
    }
    const allocations = allocationKeys.map(parseAllocationKey);
    if (allocations.some((allocation) => !allocation)) {
      throw makeError('Pilihan overhead berisi ID yang tidak valid.');
    }
    if (seenWithdrawals.has(cashTransactionId)) {
      throw makeError('Transaksi tarik tunai yang sama dipilih lebih dari satu kali.');
    }
    allocationKeys.forEach((key) => {
      if (seenAllocations.has(key)) {
        throw makeError('Overhead yang sama tidak dapat dialokasikan ke beberapa transaksi tarik tunai.');
      }
      seenAllocations.add(key);
    });
    seenWithdrawals.add(cashTransactionId);
    return {
      rowNumber: Number(row.rowNumber) || 0,
      date: parseStatementDate(row.date),
      description,
      reference: String(row.reference || '').trim().slice(0, 200),
      amount,
      cashTransactionId: new mongoose.Types.ObjectId(cashTransactionId),
      allocationKeys,
      allocations,
      fingerprint: createFingerprint(row)
    };
  });

  const withdrawals = await CashTransaction.find({
    _id: { $in: preparedRows.map((row) => row.cashTransactionId) },
    type: 'withdrawal',
    source_account: 'bank',
    to_account: 'cash'
  }).select('_id date amount').lean();
  const withdrawalsById = new Map(withdrawals.map((withdrawal) => [
    String(withdrawal._id),
    withdrawal
  ]));
  const overheadIds = new Set();
  const paymentIds = new Set();
  preparedRows.forEach((row) => {
    row.allocations.forEach((allocation) => {
      if (allocation.sourceType === 'overhead') overheadIds.add(String(allocation.id));
      else paymentIds.add(String(allocation.id));
    });
  });
  const [overheads, payments] = await Promise.all([
    Overhead.find({ _id: { $in: [...overheadIds] }, payment_method: 'cash' })
      .select('_id amount expense_date')
      .lean(),
    OverheadPayment.find({ _id: { $in: [...paymentIds] }, payment_method: 'cash' })
      .select('_id amount paid_at')
      .lean()
  ]);
  const sources = new Map([
    ...overheads.map((overhead) => [`overhead:${overhead._id}`, {
      amount: Number(overhead.amount) || 0,
      date: overhead.expense_date
    }]),
    ...payments.map((payment) => [`overhead-payment:${payment._id}`, {
      amount: Number(payment.amount) || 0,
      date: payment.paid_at
    }])
  ]);
  const foundSourceKeys = new Set([
    ...overheads.map((overhead) => `overhead:${overhead._id}`),
    ...payments.map((payment) => `overhead-payment:${payment._id}`)
  ]);
  if (preparedRows.some((row) => row.allocationKeys.some((key) => !foundSourceKeys.has(key)))) {
    throw makeError('Salah satu overhead yang dipilih tidak tersedia atau bukan pembayaran tunai.');
  }

  const conflictingWithdrawals = await CashWithdrawalReconciliation.find({
    cash_transaction_id: { $in: preparedRows.map((row) => row.cashTransactionId) }
  })
    .select('fingerprint cash_transaction_id')
    .lean();
  const incomingFingerprintsByWithdrawal = new Map(preparedRows.map((row) => [
    String(row.cashTransactionId),
    row.fingerprint
  ]));
  const conflictingWithdrawal = conflictingWithdrawals.find((record) => (
    incomingFingerprintsByWithdrawal.get(String(record.cash_transaction_id)) !== record.fingerprint
  ));
  if (conflictingWithdrawal) {
    throw makeError('Transaksi tarik tunai ini sudah direkonsiliasi ke baris rekening koran lain.', 409);
  }

  const referencedIds = preparedRows.flatMap((row) => row.allocations.map((allocation) => allocation.id));
  const otherRecords = referencedIds.length
    ? await CashWithdrawalReconciliation.find({
      'allocations.source_id': { $in: referencedIds }
    })
      .select('fingerprint cash_transaction_id allocations')
      .lean()
    : [];
  const allocationOwner = new Map();
  preparedRows.forEach((row) => row.allocations.forEach((allocation) => {
    allocationOwner.set(
      `${allocation.sourceType === 'overhead_payment' ? 'overhead-payment' : 'overhead'}:${allocation.id}`,
      String(row.cashTransactionId)
    );
  }));
  const allocatedElsewhere = new Set();
  otherRecords.forEach((record) => {
    record.allocations.forEach((allocation) => {
      const key = `${allocation.source_type === 'overhead_payment' ? 'overhead-payment' : 'overhead'}:${allocation.source_id}`;
      const owner = allocationOwner.get(key);
      if (owner && owner !== String(record.cash_transaction_id)) allocatedElsewhere.add(key);
    });
  });

  const recordsToSave = [];
  for (const row of preparedRows) {
    const withdrawal = withdrawalsById.get(String(row.cashTransactionId));
    if (!withdrawal) throw makeError('Transaksi tarik tunai tidak ditemukan.');
    if (Number(withdrawal.amount) !== row.amount) {
      throw makeError('Nominal mutasi harus sama dengan nominal transaksi tarik tunai.');
    }
    if (!isWithinStatementWindow(withdrawal.date, row.date)) {
      throw makeError('Tanggal transaksi tarik tunai terlalu jauh dari tanggal mutasi.');
    }
    const { start, end } = getAllocationWindow(withdrawal.date);
    let allocatedAmount = 0;
    const allocations = row.allocations.map((allocation) => {
      const key = `${allocation.sourceType === 'overhead_payment' ? 'overhead-payment' : 'overhead'}:${allocation.id}`;
      if (allocatedElsewhere.has(key)) {
        throw makeError('Salah satu overhead sudah dialokasikan ke transaksi tarik tunai lain.', 409);
      }
      const source = sources.get(key);
      if (!source || new Date(source.date) < start || new Date(source.date) > end) {
        throw makeError(`Overhead hanya dapat dipilih dalam ${ALLOCATION_WINDOW_DAYS} hari sejak tanggal tarik tunai.`);
      }
      allocatedAmount += source.amount;
      return {
        source_type: allocation.sourceType,
        source_id: allocation.id,
        amount: source.amount
      };
    });
    if (allocatedAmount > Number(withdrawal.amount)) {
      throw makeError('Total overhead yang dipilih melebihi dana tarik tunai.');
    }

    recordsToSave.push({
      fingerprint: row.fingerprint,
      row_number: row.rowNumber,
      statement_date: row.date,
      statement_description: row.description,
      statement_reference: row.reference,
      statement_amount: row.amount,
      cash_transaction_id: withdrawal._id,
      allocations,
      allocated_amount: allocatedAmount,
      matched_by: user?._id
    });
  }

  const savedRecords = [];
  for (const record of recordsToSave) {
    const saved = await CashWithdrawalReconciliation.findOneAndUpdate(
      { fingerprint: record.fingerprint },
      { $set: record },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    savedRecords.push(saved);
  }

  return {
    saved_count: savedRecords.length,
    allocation_count: savedRecords.reduce((sum, record) => sum + record.allocations.length, 0),
    allocated_amount: savedRecords.reduce((sum, record) => sum + record.allocated_amount, 0),
    remaining_amount: savedRecords.reduce(
      (sum, record) => sum + record.statement_amount - record.allocated_amount,
      0
    )
  };
};

module.exports = {
  reconcileCashWithdrawals,
  getCashOverheadOptions,
  saveCashWithdrawalReconciliations
};
