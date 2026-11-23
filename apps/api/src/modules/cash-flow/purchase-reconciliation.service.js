const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const DebtPayment = require('../purchases/debt-payment.model');

const MAX_STATEMENT_ROWS = 2000;
const MAX_MANUAL_CANDIDATES = 30;
const MANUAL_DATE_WINDOW_DAYS = 90;
const INITIAL_DOWN_PAYMENT_NOTE = 'Uang muka / DP saat transaksi';

const normalizePhrase = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const containsPhrase = (text, phrase) => {
  const normalizedPhrase = normalizePhrase(phrase);
  if (normalizedPhrase.length < 4) return false;
  return ` ${normalizePhrase(text)} `.includes(` ${normalizedPhrase} `);
};

const normalizeDirection = (value) => normalizePhrase(value).replace(/\s/g, '');

const isDebitDirection = (value) => ['d', 'db', 'dr', 'debit', 'debet', 'out', 'keluar']
  .includes(normalizeDirection(value));

const isCreditDirection = (value) => ['c', 'cr', 'credit', 'kredit', 'in', 'masuk']
  .includes(normalizeDirection(value));

const parseAmount = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.sign(value) * Math.round(Math.abs(value)) : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const raw = value.trim();
  const negative = /^\s*-/.test(raw) || /^\s*\(.*\)\s*$/.test(raw) || /-\s*$/.test(raw);
  const numeric = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(numeric)) return null;

  const lastSeparator = Math.max(numeric.lastIndexOf('.'), numeric.lastIndexOf(','));
  let normalized;
  if (lastSeparator < 0) {
    normalized = numeric;
  } else {
    const separators = (numeric.match(/[.,]/g) || []).length;
    const decimalLength = numeric.length - lastSeparator - 1;
    if (separators > 1 && decimalLength === 3) {
      normalized = numeric.replace(/[.,]/g, '');
    } else if (decimalLength > 0 && decimalLength <= 2) {
      normalized = `${numeric.slice(0, lastSeparator).replace(/[.,]/g, '')}.${numeric.slice(lastSeparator + 1)}`;
    } else {
      normalized = numeric.replace(/[.,]/g, '');
    }
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return (negative ? -1 : 1) * Math.round(amount);
};

const parseStatementDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;

  const raw = value.trim();
  const dayFirst = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dayFirst) {
    const date = new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
    if (
      date.getFullYear() === Number(dayFirst[3]) &&
      date.getMonth() === Number(dayFirst[2]) - 1 &&
      date.getDate() === Number(dayFirst[1])
    ) return date;
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const makeCandidate = ({
  key,
  kind,
  purchase,
  amount,
  date,
  reference,
  items = []
}) => ({
  key,
  kind,
  amount: Math.round(Number(amount) || 0),
  date,
  purchaseId: String(purchase._id),
  purchaseNumber: purchase.purchase_number || '',
  invoiceReference: purchase.invoice_ref || '',
  supplierName: purchase.supplier_id?.name || '',
  purchaseTotal: Math.round(Number(purchase.total_actual) || 0),
  items,
  reference: reference || '',
  purchaseDate: purchase.purchased_at || null
});

const scoreCandidate = (row, candidate) => {
  const narrative = `${row.description} ${row.reference}`;
  const supplierMatch = containsPhrase(narrative, candidate.supplierName);
  const invoiceReferenceMatch = containsPhrase(narrative, candidate.invoiceReference);
  const candidateReferences = [
    candidate.reference,
    candidate.purchaseNumber,
    candidate.invoiceReference
  ].filter(Boolean);
  const referenceMatch = candidateReferences.some((reference) => containsPhrase(narrative, reference));
  if (!supplierMatch && !referenceMatch) return null;

  let score = (referenceMatch ? 100 : 0) + (supplierMatch ? 50 : 0);
  const statementDate = parseStatementDate(row.date);
  const candidateDate = parseStatementDate(candidate.date);
  if (statementDate && candidateDate) {
    const daysApart = Math.abs(statementDate.getTime() - candidateDate.getTime()) / 86400000;
    if (daysApart <= 1) score += 20;
    else if (daysApart <= 7) score += 10;
  }

  return { score, supplierMatch, referenceMatch, invoiceReferenceMatch };
};

const indexCandidates = (candidates) => {
  const index = new Map();
  candidates.forEach((candidate) => {
    const identifiers = [
      candidate.supplierName,
      candidate.reference,
      candidate.purchaseNumber,
      candidate.invoiceReference
    ];
    const phrases = new Set(identifiers.map(normalizePhrase).filter((phrase) => phrase.length >= 4));
    phrases.forEach((phrase) => {
      const entries = index.get(phrase) || [];
      entries.push(candidate);
      index.set(phrase, entries);
    });
  });
  return index;
};

const getCandidatePool = (row, index) => {
  const words = normalizePhrase(`${row.description} ${row.reference}`).split(' ').filter(Boolean);
  const candidates = new Set();
  const maxPhraseWords = 24;
  for (let start = 0; start < words.length; start += 1) {
    const endLimit = Math.min(words.length, start + maxPhraseWords);
    for (let end = start + 1; end <= endLimit; end += 1) {
      (index.get(words.slice(start, end).join(' ')) || [])
        .forEach((candidate) => candidates.add(candidate));
    }
  }
  return [...candidates];
};

const createManualCandidateIndex = (candidates) => {
  const byAmount = new Map();
  const byDate = [];
  candidates.forEach((candidate) => {
    const amountCandidates = byAmount.get(candidate.amount) || [];
    amountCandidates.push(candidate);
    byAmount.set(candidate.amount, amountCandidates);
    const date = parseStatementDate(candidate.date);
    if (date) byDate.push({ candidate, timestamp: date.getTime() });
  });
  byDate.sort((first, second) => first.timestamp - second.timestamp);
  return { byAmount, byDate };
};

const candidateSummary = (candidate, signals, amountDifference = 0, includeItems = true) => ({
  key: candidate.key,
  type: candidate.kind,
  purchase_id: candidate.purchaseId,
  purchase_number: candidate.purchaseNumber,
  supplier_name: candidate.supplierName,
  reference: candidate.reference || candidate.invoiceReference,
  date: candidate.date,
  amount: candidate.amount,
  amount_difference: amountDifference,
  purchase_total: candidate.purchaseTotal,
  invoice_reference: candidate.invoiceReference,
  items: includeItems ? candidate.items : [],
  checks: {
    supplier_name: signals.supplierMatch,
    supplier_reference: signals.invoiceReferenceMatch,
    amount: amountDifference === 0
  },
  matched_by: [
    ...(signals.invoiceReferenceMatch ? ['no. nota supplier'] : []),
    ...(signals.referenceMatch && !signals.invoiceReferenceMatch ? ['referensi transaksi'] : []),
    ...(signals.supplierMatch ? ['nama supplier'] : [])
  ]
});

const getManualCandidateOptions = (row, candidateIndex, manualIndex) => {
  const date = parseStatementDate(row.date);
  const windowMs = MANUAL_DATE_WINDOW_DAYS * 86400000;
  const options = new Set([
    ...getCandidatePool(row, candidateIndex),
    ...(manualIndex.byAmount.get(row.amount) || [])
  ]);
  if (date) {
    let low = 0;
    let high = manualIndex.byDate.length;
    const minimum = date.getTime() - windowMs;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (manualIndex.byDate[middle].timestamp < minimum) low = middle + 1;
      else high = middle;
    }
    for (let index = low; index < manualIndex.byDate.length; index += 1) {
      const entry = manualIndex.byDate[index];
      if (entry.timestamp > date.getTime() + windowMs) break;
      options.add(entry.candidate);
    }
  }

  return [...options]
    .map((candidate) => {
      const signals = scoreCandidate(row, candidate);
      const candidateDate = parseStatementDate(candidate.date);
      const daysApart = date && candidateDate
        ? Math.abs(date.getTime() - candidateDate.getTime()) / 86400000
        : Number.POSITIVE_INFINITY;
      return { candidate, signals, daysApart };
    })
    .sort((first, second) => (
      Number(second.candidate.amount === row.amount) - Number(first.candidate.amount === row.amount) ||
      (second.signals?.score || 0) - (first.signals?.score || 0) ||
      first.daysApart - second.daysApart
    ))
    .slice(0, MAX_MANUAL_CANDIDATES)
    .map(({ candidate, signals }) => candidateSummary(
      candidate,
      signals || { supplierMatch: false, referenceMatch: false, invoiceReferenceMatch: false },
      row.amount - candidate.amount,
      false
    ));
};

const buildCandidates = async () => {
  const [purchases, debtPayments] = await Promise.all([
    Purchase.find()
      .populate('supplier_id', 'name')
      .select('_id purchase_number invoice_ref payment_method payment_source amount_paid total_actual purchased_at supplier_id')
      .lean(),
    DebtPayment.find()
      .populate({
        path: 'purchase_id',
        populate: { path: 'supplier_id', select: 'name' }
      })
      .select('_id purchase_id amount paid_at reference_number payment_method notes')
      .lean()
  ]);

  const purchaseItems = await PurchaseItem.find({
    purchase_id: { $in: purchases.map((purchase) => purchase._id) }
  })
    .select('purchase_id product_name unit_name actual_qty actual_unit_price actual_subtotal')
    .lean();
  const itemsByPurchase = new Map();
  purchaseItems.forEach((item) => {
    const key = String(item.purchase_id);
    const items = itemsByPurchase.get(key) || [];
    items.push({
      name: item.product_name || '',
      unit: item.unit_name || '',
      quantity: Number(item.actual_qty) || 0,
      unit_price: Math.round(Number(item.actual_unit_price) || 0),
      subtotal: Math.round(Number(item.actual_subtotal) || 0)
    });
    itemsByPurchase.set(key, items);
  });

  const candidates = [];
  const manualCandidates = [];
  const paymentsByPurchase = new Map();
  debtPayments.forEach((payment) => {
    const purchaseId = payment.purchase_id?._id;
    if (!purchaseId) return;
    const key = String(purchaseId);
    const payments = paymentsByPurchase.get(key) || [];
    payments.push(payment);
    paymentsByPurchase.set(key, payments);
  });

  purchases.forEach((purchase) => {
    const paymentSource = purchase.payment_source ||
      (purchase.payment_method === 'transfer' ? 'bank' : 'cash');

    if (purchase.payment_method === 'tempo') {
      const downPayment = Number(purchase.amount_paid) || 0;
      const purchasePayments = paymentsByPurchase.get(String(purchase._id)) || [];
      if (downPayment > 0 && purchasePayments.length === 0) {
        const candidate = makeCandidate({
          key: `purchase-down-payment:${purchase._id}`,
          kind: 'Uang muka pembelian',
          purchase,
          amount: downPayment,
          date: purchase.purchased_at,
          reference: purchase.invoice_ref,
          items: itemsByPurchase.get(String(purchase._id)) || []
        });
        manualCandidates.push(candidate);
        if (paymentSource === 'bank') candidates.push(candidate);
      }
      return;
    }

    const candidate = makeCandidate({
      key: `purchase:${purchase._id}`,
      kind: 'Pembelian langsung',
      purchase,
      amount: purchase.total_actual,
      date: purchase.purchased_at,
      reference: purchase.invoice_ref,
      items: itemsByPurchase.get(String(purchase._id)) || []
    });
    manualCandidates.push(candidate);
    if (paymentSource === 'bank') candidates.push(candidate);
  });

  debtPayments.forEach((payment) => {
    const purchase = payment.purchase_id;
    if (!purchase) return;
    if (payment.payment_method !== 'transfer') return;
    if (payment.notes === INITIAL_DOWN_PAYMENT_NOTE) {
      const candidate = makeCandidate({
        key: `purchase-down-payment:${payment._id}`,
        kind: 'Uang muka pembelian',
        purchase,
        amount: payment.amount,
        date: payment.paid_at,
        reference: payment.reference_number || purchase.invoice_ref,
        items: itemsByPurchase.get(String(purchase._id)) || []
      });
      candidates.push(candidate);
      manualCandidates.push(candidate);
      return;
    }
    const candidate = makeCandidate({
      key: `debt-payment:${payment._id}`,
      kind: 'Pembayaran hutang',
      purchase,
      amount: payment.amount,
      date: payment.paid_at,
      reference: payment.reference_number || purchase.invoice_ref,
      items: itemsByPurchase.get(String(purchase._id)) || []
    });
    candidates.push(candidate);
    manualCandidates.push(candidate);
  });

  return { candidates, manualCandidates };
};

const reconcilePurchaseMutations = async ({
  rows,
  debitMode = 'positive',
  manualSelections = {}
} = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    const error = new Error('Data baris rekening koran wajib diisi.');
    error.statusCode = 400;
    throw error;
  }
  if (rows.length > MAX_STATEMENT_ROWS) {
    const error = new Error(`Maksimal ${MAX_STATEMENT_ROWS} baris rekening koran per rekonsiliasi.`);
    error.statusCode = 413;
    throw error;
  }
  if (!['positive', 'negative'].includes(debitMode)) {
    const error = new Error('Mode nominal debit tidak valid.');
    error.statusCode = 400;
    throw error;
  }
  if (!manualSelections || typeof manualSelections !== 'object' || Array.isArray(manualSelections)) {
    const error = new Error('Pilihan transaksi manual tidak valid.');
    error.statusCode = 400;
    throw error;
  }

  const statementRows = [];
  let excludedRows = 0;
  rows.forEach((input, index) => {
    const source = input && typeof input === 'object' ? input : {};
    const amountValue = source.amount;
    if (amountValue === null || amountValue === undefined || String(amountValue).trim() === '') {
      excludedRows++;
      return;
    }

    const amount = parseAmount(amountValue);
    const direction = String(source.direction || '').trim();
    if (direction && isCreditDirection(direction)) {
      excludedRows++;
      return;
    }
    const invalidDirection = Boolean(direction) && !isDebitDirection(direction);
    if (!direction && amount !== null && (debitMode === 'positive' ? amount <= 0 : amount >= 0)) {
      excludedRows++;
      return;
    }
    statementRows.push({
      rowNumber: Number.isInteger(Number(source.rowNumber)) ? Number(source.rowNumber) : index + 2,
      date: source.date instanceof Date ? source.date.toISOString() : String(source.date || ''),
      description: String(source.description || '').slice(0, 500),
      reference: String(source.reference || '').slice(0, 200),
      status: invalidDirection ? 'invalid_direction' : amount === null ? 'invalid_amount' : 'unmatched',
      amount: amount === null ? null : Math.abs(amount),
      reason: invalidDirection
        ? 'Penanda debit/kredit tidak dikenali.'
        : amount === null
          ? 'Nominal debit tidak dapat dibaca.'
          : 'Tidak ditemukan transaksi pembelian yang cocok.'
    });
  });

  if (statementRows.length === 0) {
    const error = new Error('Tidak ada baris debit yang dapat direkonsiliasi. Periksa pemetaan kolom dan mode nominal.');
    error.statusCode = 400;
    throw error;
  }

  const { candidates, manualCandidates } = await buildCandidates();
  const candidateIndex = indexCandidates(candidates);
  const manualCandidateTextIndex = indexCandidates(manualCandidates);
  const manualCandidateIndex = createManualCandidateIndex(manualCandidates);
  const candidatesByKey = new Map(manualCandidates.map((candidate) => [candidate.key, candidate]));
  const rowsByNumber = new Map(statementRows.map((row) => [String(row.rowNumber), row]));
  const selectionKeysByRow = new Map();
  Object.entries(manualSelections).forEach(([rowNumber, selectedKeys]) => {
    const row = rowsByNumber.get(rowNumber);
    if (!row || row.status !== 'unmatched' || row.amount === null) {
      const error = new Error('Pilihan manual merujuk ke baris rekening koran yang tidak tersedia.');
      error.statusCode = 400;
      throw error;
    }
    const candidateKeys = Array.isArray(selectedKeys) ? [...new Set(selectedKeys)] : [selectedKeys];
    if (candidateKeys.length === 0 || candidateKeys.some((key) =>
      typeof key !== 'string' || !candidatesByKey.has(key)
    )) {
      const error = new Error('Transaksi yang dipilih tidak tersedia untuk rekonsiliasi.');
      error.statusCode = 400;
      throw error;
    }
    selectionKeysByRow.set(rowNumber, candidateKeys);
  });
  statementRows.forEach((row) => {
    if (row.status !== 'unmatched' || row.amount === null) return;
    const selectedCandidateKeys = selectionKeysByRow.get(String(row.rowNumber));
    if (selectedCandidateKeys) {
      row.matchCandidates = selectedCandidateKeys.map((key) => candidatesByKey.get(key));
      row.matchSignals = row.matchCandidates.map((candidate) => scoreCandidate(row, candidate) || {
        supplierMatch: false,
        referenceMatch: false,
        invoiceReferenceMatch: false
      });
      row.manualPurchaseTotal = row.matchCandidates.reduce(
        (total, candidate) => total + candidate.amount,
        0
      );
      row.manualAmountDifference = row.amount - row.manualPurchaseTotal;
      row.status = 'manual_matched';
      row.reason = row.manualAmountDifference === 0
        ? 'Transaksi dipilih manual; total pilihan sama dengan nominal mutasi.'
        : 'Transaksi dipilih manual; periksa kembali selisih nominal.';
      return;
    }
    const identified = getCandidatePool(row, candidateIndex)
      .map((candidate) => {
        const signals = scoreCandidate(row, candidate);
        return signals ? { candidate, signals } : null;
      })
      .filter(Boolean);
    if (identified.length === 0) return;

    const referenceMatches = identified.filter(({ signals }) => signals.referenceMatch);
    const identityMatches = referenceMatches.length > 0 ? referenceMatches : identified;
    const exactAmount = identityMatches.filter(({ candidate }) => candidate.amount === row.amount);
    const matches = exactAmount.length > 0 ? exactAmount : identityMatches;
    const highestScore = Math.max(...matches.map(({ signals }) => signals.score));
    const topMatches = matches.filter(({ signals }) => signals.score === highestScore);

    if (exactAmount.length > 0 && topMatches.length === 1) {
      row.matchCandidate = topMatches[0].candidate;
      row.matchSignals = topMatches[0].signals;
      row.status = 'matched';
      row.reason = 'Nominal sama persis dan identitas transaksi cocok.';
    } else if (exactAmount.length > 0) {
      row.status = 'ambiguous';
      row.reason = 'Lebih dari satu transaksi memiliki nominal dan identitas yang cocok.';
      row.candidates = topMatches.slice(0, 3).map(({ candidate, signals }) => candidateSummary(candidate, signals));
    } else if (topMatches.length === 1) {
      const { candidate, signals } = topMatches[0];
      row.status = 'amount_mismatch';
      row.reason = 'Nama atau referensi cocok, tetapi nominal berbeda.';
      row.candidates = [candidateSummary(candidate, signals, row.amount - candidate.amount)];
    } else {
      row.status = 'ambiguous';
      row.reason = 'Identitas transaksi cocok dengan beberapa kandidat, tetapi nominal tidak sama.';
      row.candidates = topMatches.slice(0, 3).map(({ candidate, signals }) => (
        candidateSummary(candidate, signals, row.amount - candidate.amount)
      ));
    }
  });

  const claimed = new Map();
  statementRows.forEach((row) => {
    if (row.status === 'matched') {
      const matches = claimed.get(row.matchCandidate.key) || [];
      matches.push({ row, candidate: row.matchCandidate, signals: row.matchSignals });
      claimed.set(row.matchCandidate.key, matches);
    } else if (row.status === 'manual_matched') {
      row.matchCandidates.forEach((candidate, index) => {
        const matches = claimed.get(candidate.key) || [];
        matches.push({ row, candidate, signals: row.matchSignals[index] });
        claimed.set(candidate.key, matches);
      });
    }
  });
  claimed.forEach((matchingEntries) => {
    const matchingRows = [...new Set(matchingEntries.map((entry) => entry.row))];
    if (matchingRows.length < 2) return;
    matchingEntries.forEach(({ row, candidate, signals }) => {
      row.status = 'ambiguous';
      row.reason = 'Beberapa baris mutasi mengarah ke transaksi pembelian yang sama.';
      row.candidates = [candidateSummary(candidate, signals)];
      delete row.matchCandidate;
      delete row.matchSignals;
      delete row.matchCandidates;
      delete row.manualPurchaseTotal;
      delete row.manualAmountDifference;
    });
  });

  const matchedCount = statementRows.filter((row) => row.status === 'matched').length;
  const manualMatchedCount = statementRows.filter((row) => row.status === 'manual_matched').length;
  const unmatchedCount = statementRows.length - matchedCount - manualMatchedCount;
  const manualAmountMismatchCount = statementRows.filter((row) =>
    row.status === 'manual_matched' && row.manualAmountDifference !== 0
  ).length;
  const counts = statementRows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  const mismatchPercentage = statementRows.length
    ? Number((((unmatchedCount + manualAmountMismatchCount) / statementRows.length) * 100).toFixed(2))
    : 0;

  return {
    summary: {
      statement_rows: rows.length,
      debit_rows: statementRows.length,
      excluded_rows: excludedRows,
      matched_rows: matchedCount,
      manual_matched_rows: manualMatchedCount,
      unmatched_rows: unmatchedCount,
      mismatch_percentage: mismatchPercentage,
      mismatch_denominator: 'baris debit rekening koran',
      counts
    },
    rows: statementRows.map((row) => {
      const result = { ...row };
      if (row.status === 'matched') {
        result.purchase = candidateSummary(row.matchCandidate, row.matchSignals);
        delete result.matchCandidate;
        delete result.matchSignals;
      }
      if (row.status === 'manual_matched') {
        result.purchases = row.matchCandidates.map((candidate, index) => candidateSummary(
          candidate,
          row.matchSignals[index]
        ));
        result.manual_purchase_total = row.manualPurchaseTotal;
        result.manual_amount_difference = row.manualAmountDifference;
        delete result.matchCandidates;
        delete result.matchSignals;
        delete result.manualPurchaseTotal;
        delete result.manualAmountDifference;
        delete result.matchCandidate;
        delete result.matchSignals;
      }
      if (row.amount !== null && !['invalid_amount', 'invalid_direction'].includes(row.status)) {
        result.manual_candidates = getManualCandidateOptions(
          row,
          manualCandidateTextIndex,
          manualCandidateIndex
        );
      }
      return result;
    })
  };
};

module.exports = {
  reconcilePurchaseMutations,
  parseAmount,
  scoreCandidate,
  isDebitDirection,
  isCreditDirection,
  MAX_STATEMENT_ROWS
};
