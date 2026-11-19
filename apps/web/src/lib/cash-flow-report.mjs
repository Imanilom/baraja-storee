export const cashFlowReportCategories = [
  { id: 'all', label: 'Semua kategori' },
  { id: 'capital', label: 'Modal (Baraja / invoice)' },
  { id: 'income', label: 'Penerimaan lainnya' },
  { id: 'purchase_direct', label: 'Belanja langsung' },
  { id: 'purchase_tempo', label: 'Belanja terhutang' },
  { id: 'debt_payment', label: 'Pembayaran hutang' },
  { id: 'overhead', label: 'Biaya overhead' },
  { id: 'manual', label: 'Pengeluaran manual' },
  { id: 'transfer', label: 'Transfer antar kas' }
];

export function getCashFlowReportCategory(mutation) {
  if (mutation.source_type === 'debt_payment') return 'debt_payment';
  if (mutation.source_type === 'purchase') {
    return ['purchase_dp', 'purchase_tempo'].includes(mutation.trx_type) ||
      mutation.payment_method === 'tempo'
      ? 'purchase_tempo'
      : 'purchase_direct';
  }
  if (['overhead', 'overhead_payment'].includes(mutation.source_type)) return 'overhead';
  if (mutation.trx_type === 'in') {
    return ['modal', 'penjualan_pos'].includes(mutation.category) ? 'capital' : 'income';
  }
  if (['withdrawal', 'petty_transfer'].includes(mutation.trx_type)) return 'transfer';
  if (mutation.source_type === 'cash_transaction' && mutation.trx_type === 'out') return 'manual';
  return 'other';
}

export function filterCashFlowReportMutations(mutations, category = 'all') {
  if (!Array.isArray(mutations)) {
    throw new TypeError('Cash-flow report mutations must be an array.');
  }
  return category === 'all'
    ? mutations
    : mutations.filter((mutation) => getCashFlowReportCategory(mutation) === category);
}

export function getCashFlowReportMetrics(summary = {}, purchases = [], mutations = []) {
  const numeric = (value) => Number(value) || 0;
  const directPurchases = purchases.filter((purchase) => purchase.payment_method !== 'tempo');
  const weeklyCreditPurchases = purchases.filter((purchase) => purchase.payment_method === 'tempo');

  return {
    cashBalance: numeric(summary.current_cash_balance),
    bankBalance: numeric(summary.current_bank_balance),
    pettyCashBalance: numeric(summary.current_petty_cash_balance),
    totalFunds: numeric(summary.total_liquidity),
    totalPurchases: numeric(summary.total_purchase),
    totalOutflow: numeric(summary.total_outflow),
    totalInflow: numeric(summary.total_inflow),
    directPurchases: directPurchases.reduce(
      (total, purchase) => total + numeric(purchase.total_actual),
      0
    ),
    debtCreated: weeklyCreditPurchases.reduce(
      (total, purchase) => total + numeric(purchase.total_actual),
      0
    ),
    debtPaid: mutations.reduce((total, mutation) => (
      mutation.trx_type === 'debt_payment' ||
      (mutation.source_type === 'purchase' && mutation.trx_type === 'purchase_dp')
        ? total + numeric(mutation.amount)
        : total
    ), 0),
    debtRemaining: weeklyCreditPurchases.reduce(
      (total, purchase) => total + numeric(purchase.amount_remaining),
      0
    )
  };
}

export function createCashFlowReportExportRows(metrics, categoryTotals, mutations) {
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('sv-SE');
  };

  return [
    ['LAPORAN ARUS KAS'],
    ['Saldo kas tunai (Rp)', metrics.cashBalance],
    ['Saldo rekening bank (Rp)', metrics.bankBalance],
    ['Total dana (Rp)', metrics.totalFunds],
    ['Total uang masuk periode ini (Rp)', metrics.totalInflow],
    ['Belanja langsung periode ini (Rp)', metrics.directPurchases],
    ['Belanja terhutang periode ini (Rp)', metrics.debtCreated],
    ['Total pengeluaran periode (Rp)', metrics.totalOutflow],
    ['Pembayaran hutang periode (Rp)', metrics.debtPaid],
    ['Sisa hutang dari pembelian periode ini (Rp)', metrics.debtRemaining],
    [],
    ['RINGKASAN KATEGORI'],
    ['Kategori', 'Jumlah transaksi', 'Total nominal (Rp)'],
    ...categoryTotals.map(({ label, count, amount }) => [label, count, amount]),
    [],
    ['RINCIAN MUTASI'],
    ['Tanggal', 'Kategori', 'Jenis', 'Akun', 'Keterangan', 'Referensi', 'Nominal (Rp)', 'Catatan'],
    ...mutations.map((mutation) => [
      formatDate(mutation.date),
      cashFlowReportCategories.find(
        (category) => category.id === getCashFlowReportCategory(mutation)
      )?.label || mutation.category_label || 'Lainnya',
      mutation.direction === 'in'
        ? 'Masuk'
        : mutation.direction === 'transfer'
          ? 'Transfer'
          : mutation.direction === 'commitment' ? 'Hutang' : 'Keluar',
      mutation.account_label || mutation.account || '',
      mutation.title || '',
      mutation.reference_number || '',
      Number(mutation.amount) || 0,
      mutation.notes || ''
    ])
  ];
}
