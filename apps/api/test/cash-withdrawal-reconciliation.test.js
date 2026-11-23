const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { OVERHEAD_CATEGORIES, PAYMENT_METHOD } = require('@purchasing/constants');
const CashTransaction = require('../src/modules/cash-flow/cash-transaction.model');
const CashWithdrawalReconciliation = require('../src/modules/cash-flow/cash-withdrawal-reconciliation.model');
const Overhead = require('../src/modules/overheads/overhead.model');
const OverheadPayment = require('../src/modules/overheads/overhead-payment.model');
const {
  reconcileCashWithdrawals,
  getCashOverheadOptions,
  saveCashWithdrawalReconciliations
} = require('../src/modules/cash-flow/cash-withdrawal-reconciliation.service');

const run = async () => {
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.11' }
  });

  try {
    await mongoose.connect(mongod.getUri());
    const userId = new mongoose.Types.ObjectId();
    const withdrawal = await CashTransaction.create({
      transaction_number: 'TT-20261110-0001',
      type: 'withdrawal',
      source_account: 'bank',
      to_account: 'cash',
      amount: 200000,
      category: 'tarik_tunai',
      description: 'Tarik tunai untuk operasional',
      date: new Date('2026-11-10T03:00:00.000Z')
    });
    const firstExpense = await Overhead.create({
      title: 'Parkir operasional',
      category: OVERHEAD_CATEGORIES.LOGISTIK_TRANSPORT,
      amount: 40000,
      payment_method: PAYMENT_METHOD.CASH,
      expense_date: new Date('2026-11-11T03:00:00.000Z'),
      recorded_by: userId
    });
    const secondExpense = await Overhead.create({
      title: 'Air galon',
      category: OVERHEAD_CATEGORIES.LAIN_LAIN,
      amount: 60000,
      payment_method: PAYMENT_METHOD.CASH,
      expense_date: new Date('2026-11-13T03:00:00.000Z'),
      recorded_by: userId
    });
    const tooLargeExpense = await Overhead.create({
      title: 'Servis alat',
      category: OVERHEAD_CATEGORIES.PEMELIHARAAN_ASET,
      amount: 150000,
      payment_method: PAYMENT_METHOD.CASH,
      expense_date: new Date('2026-11-14T03:00:00.000Z'),
      recorded_by: userId
    });
    const lateExpense = await Overhead.create({
      title: 'Biaya di luar periode',
      category: OVERHEAD_CATEGORIES.LAIN_LAIN,
      amount: 10000,
      payment_method: PAYMENT_METHOD.CASH,
      expense_date: new Date('2026-12-12T03:00:00.000Z'),
      recorded_by: userId
    });
    const tempoExpense = await Overhead.create({
      title: 'Perbaikan kecil',
      category: OVERHEAD_CATEGORIES.PEMELIHARAAN_ASET,
      amount: 50000,
      payment_method: PAYMENT_METHOD.TEMPO,
      due_date: new Date('2026-12-01T00:00:00.000Z'),
      recorded_by: userId
    });
    const cashTempoPayment = await OverheadPayment.create({
      overhead_id: tempoExpense._id,
      amount: 30000,
      payment_method: PAYMENT_METHOD.CASH,
      paid_at: new Date('2026-11-12T03:00:00.000Z'),
      recorded_by: userId
    });

    const statementRow = {
      rowNumber: 8,
      date: '2026-11-10',
      description: 'ATM TARIK TUNAI',
      reference: 'ATM-778',
      amount: 'Rp 200.000'
    };
    const preview = await reconcileCashWithdrawals({
      rows: [statementRow],
      debitMode: 'positive'
    });
    assert.strictEqual(preview.summary.rows_with_withdrawal_candidates, 1);
    assert.strictEqual(preview.rows[0].candidates[0].id, String(withdrawal._id));

    const overheadOptions = await getCashOverheadOptions(withdrawal._id);
    assert.deepStrictEqual(overheadOptions.options.map((option) => option.key).sort(), [
      `overhead:${firstExpense._id}`,
      `overhead:${secondExpense._id}`,
      `overhead:${tooLargeExpense._id}`,
      `overhead-payment:${cashTempoPayment._id}`
    ].sort());
    assert.ok(!overheadOptions.options.some((option) => option.key === `overhead:${lateExpense._id}`));

    const savePayload = {
      rows: [{
        ...statementRow,
        cashTransactionId: String(withdrawal._id),
        allocationKeys: [
          `overhead:${firstExpense._id}`,
          `overhead:${secondExpense._id}`,
          `overhead-payment:${cashTempoPayment._id}`
        ]
      }]
    };
    const saved = await saveCashWithdrawalReconciliations(savePayload);
    assert.deepStrictEqual(saved, {
      saved_count: 1,
      allocation_count: 3,
      allocated_amount: 130000,
      remaining_amount: 70000
    });
    const savedOptions = await getCashOverheadOptions(withdrawal._id);
    assert.strictEqual(savedOptions.selected_keys.length, 3);
    assert.strictEqual(savedOptions.allocated_amount, 130000);
    assert.strictEqual(await CashWithdrawalReconciliation.countDocuments(), 1);

    await assert.rejects(
      saveCashWithdrawalReconciliations({
        rows: [{
          ...statementRow,
          cashTransactionId: String(withdrawal._id),
          allocationKeys: [
            `overhead:${firstExpense._id}`,
            `overhead:${secondExpense._id}`,
            `overhead:${tooLargeExpense._id}`
          ]
        }]
      }),
      /melebihi dana tarik tunai/
    );

    const otherWithdrawal = await CashTransaction.create({
      transaction_number: 'TT-20261115-0001',
      type: 'withdrawal',
      source_account: 'bank',
      to_account: 'cash',
      amount: 200000,
      category: 'tarik_tunai',
      description: 'Tarik tunai kedua',
      date: new Date('2026-11-15T03:00:00.000Z')
    });
    await assert.rejects(
      saveCashWithdrawalReconciliations({
        rows: [{
          rowNumber: 9,
          date: '2026-11-15',
          description: 'ATM TARIK TUNAI KEDUA',
          amount: 200000,
          cashTransactionId: String(otherWithdrawal._id),
          allocationKeys: [`overhead:${firstExpense._id}`]
        }]
      }),
      /sudah dialokasikan/
    );

    await assert.rejects(
      saveCashWithdrawalReconciliations({
        rows: [{
          rowNumber: 10,
          rowNumber: 8,
          date: '2026-11-10',
          description: 'ATM TARIK TUNAI',
          reference: 'ATM-778',
          amount: 200000,
          cashTransactionId: String(withdrawal._id),
          allocationKeys: [`overhead:${lateExpense._id}`]
        }]
      }),
      /hanya dapat dipilih dalam 30 hari/
    );

    const emptyAllocationWithdrawal = await CashTransaction.create({
      transaction_number: 'TT-20261116-0001',
      type: 'withdrawal',
      source_account: 'bank',
      to_account: 'cash',
      amount: 200000,
      category: 'tarik_tunai',
      description: 'Tarik tunai belum dialokasikan',
      date: new Date('2026-11-16T03:00:00.000Z')
    });
    const savedWithoutAllocations = await saveCashWithdrawalReconciliations({
      rows: [{
        rowNumber: 11,
        date: '2026-11-16',
        description: 'ATM TARIK TUNAI BELUM DIPAKAI',
        amount: 200000,
        cashTransactionId: String(emptyAllocationWithdrawal._id),
        allocationKeys: []
      }]
    });
    assert.strictEqual(savedWithoutAllocations.remaining_amount, 200000);

    console.log('Cash withdrawal reconciliation tests passed.');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
