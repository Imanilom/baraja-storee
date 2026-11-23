const crypto = require('crypto');
const mongoose = require('mongoose');
const Purchase = require('../purchases/purchase.model');
const DebtPayment = require('../purchases/debt-payment.model');
const PurchaseReconciliation = require('./purchase-reconciliation.model');
const SupplierBankAlias = require('./supplier-bank-alias.model');
const {
  normalizePhrase,
  parseAmount,
  parseStatementDate
} = require('./purchase-reconciliation.service');

const MAX_SAVED_ROWS = 2000;
const MAX_SELECTED_TRANSACTIONS = 50;

const createStatementFingerprint = (row) => {
  const date = parseStatementDate(row.date);
  const day = date ? date.toISOString().slice(0, 10) : '';
  const reference = normalizePhrase(row.reference);
  const identity = reference || `${normalizePhrase(row.description)}:${row.rowNumber}`;
  return crypto.createHash('sha256')
    .update(`${day}|${identity}|${parseAmount(row.amount)}`)
    .digest('hex');
};

const parseCandidateKey = (key) => {
  const match = String(key).match(/^(purchase|purchase-dp-purchase|purchase-dp-payment|debt-payment):([a-f\d]{24})$/i);
  if (!match || !mongoose.Types.ObjectId.isValid(match[2])) return null;
  return { type: match[1], id: new mongoose.Types.ObjectId(match[2]) };
};

const savePurchaseReconciliations = async ({ rows, user } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_SAVED_ROWS) {
    const error = new Error(`Pilih 1 sampai ${MAX_SAVED_ROWS} hasil rekonsiliasi untuk disimpan.`);
    error.statusCode = 400;
    throw error;
  }

  const claimedCandidateKeys = new Set();
  const preparedRows = rows.map((row) => {
    if (!row || typeof row !== 'object') {
      const error = new Error('Data hasil rekonsiliasi tidak valid.');
      error.statusCode = 400;
      throw error;
    }
    const description = String(row.description || '').trim().slice(0, 500);
    const reference = String(row.reference || '').trim().slice(0, 200);
    const beneficiaryName = String(row.beneficiaryName || '').trim().slice(0, 100);
    const amount = parseAmount(row.amount);
    const candidateKeys = Array.isArray(row.candidateKeys)
      ? [...new Set(row.candidateKeys)]
      : [];
    if (!description || amount === null || amount <= 0 ||
      candidateKeys.length === 0 || candidateKeys.length > MAX_SELECTED_TRANSACTIONS) {
      const error = new Error('Setiap hasil tersimpan harus memiliki keterangan, nominal, dan transaksi terpilih yang valid.');
      error.statusCode = 400;
      throw error;
    }
    const parsedCandidateKeys = candidateKeys.map(parseCandidateKey);
    if (parsedCandidateKeys.some((candidate) => !candidate)) {
      const error = new Error('Pilihan transaksi berisi ID yang tidak valid.');
      error.statusCode = 400;
      throw error;
    }
    if (candidateKeys.some((key) => claimedCandidateKeys.has(key))) {
      const error = new Error('Transaksi yang sama tidak dapat disimpan pada lebih dari satu baris mutasi.');
      error.statusCode = 400;
      throw error;
    }
    candidateKeys.forEach((key) => claimedCandidateKeys.add(key));
    return {
      rowNumber: Number(row.rowNumber) || 0,
      date: parseStatementDate(row.date),
      description,
      reference,
      beneficiaryName,
      normalizedBeneficiary: normalizePhrase(beneficiaryName),
      amount,
      candidateKeys,
      parsedCandidateKeys,
      matchType: row.matchType === 'manual' ? 'manual' : 'automatic'
    };
  });

  const purchaseIds = new Map();
  const debtPaymentIds = new Map();
  preparedRows.forEach((row) => {
    row.parsedCandidateKeys.forEach(({ type, id }) => {
      if (type === 'purchase' || type === 'purchase-dp-purchase') {
        purchaseIds.set(String(id), id);
      } else {
        debtPaymentIds.set(String(id), id);
      }
    });
  });

  const debtPayments = await DebtPayment.find({ _id: { $in: [...debtPaymentIds.values()] } })
    .select('_id purchase_id payment_method')
    .lean();
  debtPayments.forEach((payment) => purchaseIds.set(String(payment.purchase_id), payment.purchase_id));
  const purchases = await Purchase.find({ _id: { $in: [...purchaseIds.values()] } })
    .select('_id supplier_id')
    .lean();
  const purchasesById = new Map(purchases.map((purchase) => [String(purchase._id), purchase]));
  const paymentsById = new Map(debtPayments.map((payment) => [String(payment._id), payment]));

  const savedRecords = [];
  const aliases = new Map();
  const conflictingAliases = new Set();
  let aliasSkippedCount = 0;
  for (const row of preparedRows) {
    const rowPurchaseIds = new Set();
    const rowPaymentIds = new Set();
    const rowSupplierIds = new Set();
    row.parsedCandidateKeys.forEach(({ type, id }) => {
      if (type === 'purchase' || type === 'purchase-dp-purchase') {
        const purchase = purchasesById.get(String(id));
        if (!purchase) {
          const error = new Error('Salah satu transaksi pembelian yang dipilih sudah tidak tersedia.');
          error.statusCode = 400;
          throw error;
        }
        rowPurchaseIds.add(String(purchase._id));
        if (purchase.supplier_id) rowSupplierIds.add(String(purchase.supplier_id));
      } else {
        const payment = paymentsById.get(String(id));
        if (!payment || payment.payment_method !== 'transfer') {
          const error = new Error('Salah satu pembayaran hutang yang dipilih tidak tersedia atau bukan transfer bank.');
          error.statusCode = 400;
          throw error;
        }
        const purchase = purchasesById.get(String(payment.purchase_id));
        if (!purchase) {
          const error = new Error('Pembelian untuk pembayaran yang dipilih sudah tidak tersedia.');
          error.statusCode = 400;
          throw error;
        }
        rowPaymentIds.add(String(payment._id));
        rowPurchaseIds.add(String(purchase._id));
        if (purchase.supplier_id) rowSupplierIds.add(String(purchase.supplier_id));
      }
    });

    const supplierIds = [...rowSupplierIds].map((id) => new mongoose.Types.ObjectId(id));
    const fingerprint = createStatementFingerprint(row);
    const saved = await PurchaseReconciliation.findOneAndUpdate(
      { fingerprint },
      {
        $set: {
          row_number: row.rowNumber,
          statement_date: row.date,
          statement_description: row.description,
          statement_reference: row.reference,
          statement_amount: row.amount,
          candidate_keys: row.candidateKeys,
          purchase_ids: [...rowPurchaseIds].map((id) => new mongoose.Types.ObjectId(id)),
          debt_payment_ids: [...rowPaymentIds].map((id) => new mongoose.Types.ObjectId(id)),
          supplier_ids: supplierIds,
          beneficiary_name: row.beneficiaryName,
          normalized_beneficiary: row.normalizedBeneficiary,
          match_type: row.matchType,
          matched_by: user?._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    savedRecords.push(saved);

    if (row.normalizedBeneficiary.length >= 4 && supplierIds.length === 1) {
      const existing = aliases.get(row.normalizedBeneficiary);
      if (existing && String(existing.supplierId) !== String(supplierIds[0])) {
        aliases.delete(row.normalizedBeneficiary);
        conflictingAliases.add(row.normalizedBeneficiary);
      } else if (!conflictingAliases.has(row.normalizedBeneficiary)) {
        aliases.set(row.normalizedBeneficiary, {
          alias: row.beneficiaryName,
          normalizedAlias: row.normalizedBeneficiary,
          supplierId: supplierIds[0],
          reconciliationId: saved._id
        });
      }
    } else {
      aliasSkippedCount += 1;
    }
  }

  const aliasResults = { saved: 0, conflicts: conflictingAliases.size, skipped: aliasSkippedCount };
  for (const alias of aliases.values()) {
    const existing = await SupplierBankAlias.findOne({ normalized_alias: alias.normalizedAlias });
    if (existing && String(existing.supplier_id) !== String(alias.supplierId)) {
      aliasResults.conflicts += 1;
      continue;
    }
    await SupplierBankAlias.updateOne(
      { normalized_alias: alias.normalizedAlias },
      {
        $setOnInsert: {
          alias: alias.alias,
          normalized_alias: alias.normalizedAlias,
          supplier_id: alias.supplierId,
          created_by: user?._id
        },
        $set: { last_used_at: new Date() },
        $inc: { usage_count: 1 }
      },
      { upsert: true }
    );
    aliasResults.saved += 1;
  }

  return {
    saved_count: savedRecords.length,
    alias_saved_count: aliasResults.saved,
    alias_conflict_count: aliasResults.conflicts,
    alias_skipped_count: Math.max(0, aliasResults.skipped)
  };
};

module.exports = { savePurchaseReconciliations };
