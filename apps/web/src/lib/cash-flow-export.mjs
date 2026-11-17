const accountLabels = {
  cash: 'Kas Tunai',
  bank: 'Rekening Bank',
  petty_cash: 'Kas Kecil'
};

const isAccount = (value) => Object.prototype.hasOwnProperty.call(accountLabels, value);

export function createCashFlowExportRows(mutations, openingBalances = {}, activeTab = 'all') {
  if (!Array.isArray(mutations)) {
    throw new TypeError('Cash-flow mutations must be an array.');
  }

  const balances = {
    cash: Number(openingBalances.cash) || 0,
    bank: Number(openingBalances.bank) || 0,
    petty_cash: Number(openingBalances.petty_cash) || 0
  };
  const entries = [];
  const addEntry = (mutation, account, debit, credit, title = mutation.title) => {
    balances[account] += credit - debit;
    entries.push({ mutation, account, debit, credit, balance: balances[account], title });
  };

  [...mutations]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((mutation) => {
      const amount = Number(mutation.amount) || 0;
      if (mutation.direction === 'transfer' && mutation.trx_type === 'withdrawal') {
        addEntry(mutation, 'bank', amount, 0, `${mutation.title} (Keluar dari bank)`);
        addEntry(mutation, 'cash', 0, amount, `${mutation.title} (Masuk ke kas)`);
        return;
      }
      if (mutation.direction === 'transfer' && mutation.trx_type === 'petty_transfer') {
        const isFunding = mutation.category === 'kas_kecil_fund';
        const source = isFunding ? 'cash' : 'petty_cash';
        const destination = isFunding ? 'petty_cash' : 'cash';
        addEntry(
          mutation,
          source,
          amount,
          0,
          `${mutation.title} (Keluar dari ${accountLabels[source]})`
        );
        addEntry(
          mutation,
          destination,
          0,
          amount,
          `${mutation.title} (Masuk ke ${accountLabels[destination]})`
        );
        return;
      }
      if (!isAccount(mutation.account)) return;
      addEntry(
        mutation,
        mutation.account,
        mutation.direction === 'out' ? amount : 0,
        mutation.direction === 'in' ? amount : 0
      );
    });

  const isAccountFilter = isAccount(activeTab);
  const matchesType = (mutation) => {
    if (['all', 'cash', 'bank', 'petty_cash'].includes(activeTab)) return true;
    if (activeTab === 'in') return mutation.trx_type === 'in';
    if (activeTab === 'withdrawal') return mutation.trx_type === 'withdrawal';
    if (activeTab === 'purchase') return mutation.source_type === 'purchase';
    if (activeTab === 'debt_payment') return mutation.source_type === 'debt_payment';
    if (activeTab === 'overhead') {
      return ['overhead', 'overhead_payment'].includes(mutation.source_type);
    }
    return false;
  };
  const selectedEntries = entries.filter(({ mutation, account }) =>
    (!isAccountFilter || account === activeTab) && matchesType(mutation)
  );
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('sv-SE');
  };

  return [
    [
      'Tanggal',
      'Jenis',
      'Akun',
      'Keterangan',
      'No. Referensi',
      'Debit (Rp)',
      'Kredit (Rp)',
      'Saldo Akun (Rp)',
      'Catatan',
      'Petugas'
    ],
    ...selectedEntries.map(({ mutation, account, debit, credit, balance, title }) => [
      formatDate(mutation.date),
      mutation.category_label || mutation.trx_type,
      accountLabels[account],
      title,
      mutation.reference_number || '',
      debit,
      credit,
      balance,
      mutation.notes || '',
      mutation.creator || 'Sistem'
    ])
  ];
}
