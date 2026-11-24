const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
require('../src/database/registerModels');
const ActivityLog = require('../src/modules/audit/activity-log.model');
const Supplier = require('../src/modules/suppliers/supplier.model');
const Purchase = require('../src/modules/purchases/purchase.model');
const DebtPayment = require('../src/modules/purchases/debt-payment.model');
const CashTransaction = require('../src/modules/cash-flow/cash-transaction.model');
const cashFlowService = require('../src/modules/cash-flow/cash-flow.service');

const INITIAL_DOWN_PAYMENT_NOTE = 'Uang muka / DP saat transaksi';
const purchaseDate = new Date('2026-04-01T04:00:00.000Z');
const installmentDate = new Date('2026-04-02T04:00:00.000Z');

const createTempoPurchase = (supplierId, purchaseNumber, paymentSource, amountPaid, total) => (
  Purchase.create({
    purchase_number: purchaseNumber,
    supplier_id: supplierId,
    payment_method: 'tempo',
    payment_source: paymentSource,
    payment_status: 'partial',
    amount_paid: amountPaid,
    amount_remaining: total - amountPaid,
    total_actual: total,
    purchased_at: purchaseDate
  })
);

const run = async () => {
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.11' }
  });

  try {
    await mongoose.connect(mongod.getUri());
    const supplier = await Supplier.create({ name: 'PT Biji Kopi', code: 'SUP-CASHFLOW' });

    const purchaseWithRecordedDownPayment = await createTempoPurchase(
      supplier._id,
      'TRX-CF-0001',
      'bank',
      500,
      1000
    );
    await DebtPayment.create({
      purchase_id: purchaseWithRecordedDownPayment._id,
      amount: 300,
      payment_method: 'transfer',
      paid_at: purchaseDate,
      notes: INITIAL_DOWN_PAYMENT_NOTE
    });
    await DebtPayment.create({
      purchase_id: purchaseWithRecordedDownPayment._id,
      amount: 200,
      payment_method: 'transfer',
      paid_at: installmentDate
    });

    const legacyPurchase = await createTempoPurchase(
      supplier._id,
      'TRX-CF-0002',
      'bank',
      500,
      1000
    );
    await DebtPayment.create({
      purchase_id: legacyPurchase._id,
      amount: 200,
      payment_method: 'transfer',
      paid_at: installmentDate
    });

    const pettyCashPurchase = await createTempoPurchase(
      supplier._id,
      'TRX-CF-0003',
      'petty_cash',
      300,
      900
    );
    await DebtPayment.create({
      purchase_id: pettyCashPurchase._id,
      amount: 100,
      payment_method: 'cash',
      paid_at: purchaseDate,
      notes: INITIAL_DOWN_PAYMENT_NOTE
    });
    await DebtPayment.create({
      purchase_id: pettyCashPurchase._id,
      amount: 200,
      payment_method: 'cash',
      paid_at: installmentDate
    });

    const dateRange = {
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-30T23:59:59.999Z'
    };
    const summary = await cashFlowService.getSummary(dateRange);
    assert.strictEqual(summary.total_purchase_bank, 600);
    assert.strictEqual(summary.total_purchase_petty_cash, 100);
    assert.strictEqual(summary.total_debt_payment_bank, 400);
    assert.strictEqual(summary.total_debt_payment_cash, 200);
    assert.strictEqual(summary.current_bank_balance, -1000);
    assert.strictEqual(summary.current_cash_balance, -200);
    assert.strictEqual(summary.current_petty_cash_balance, -100);
    assert.strictEqual(await cashFlowService.getPettyCashDayBalance(purchaseDate), -100);

    await assert.rejects(
      cashFlowService.recordCashIn({
        amount: 200000,
        to_account: 'bank',
        description: 'Tarik tunai ATM untuk kas',
        date: purchaseDate
      }),
      /Gunakan menu Tarik Tunai/
    );

    const incorrectIncome = await CashTransaction.create({
      transaction_number: 'KM-TEST-DELETE-001',
      type: 'in',
      source_account: 'bank',
      to_account: 'bank',
      amount: 200000,
      category: 'lainnya',
      description: 'Penerimaan dana yang salah input',
      date: purchaseDate
    });
    const summaryWithIncorrectIncome = await cashFlowService.getSummary(dateRange);
    assert.strictEqual(summaryWithIncorrectIncome.current_bank_balance, summary.current_bank_balance + 200000);
    assert.strictEqual(summaryWithIncorrectIncome.total_inflow, 200000);

    await cashFlowService.deleteTransaction(incorrectIncome._id);
    const deletionLog = await ActivityLog.findOne({
      entity_type: 'cash_transaction',
      entity_id: incorrectIncome._id
    }).lean();
    assert.strictEqual(deletionLog.old_value.type, 'in');
    assert.strictEqual(deletionLog.old_value.amount, 200000);
    const summaryAfterDelete = await cashFlowService.getSummary(dateRange);
    assert.strictEqual(summaryAfterDelete.current_bank_balance, summary.current_bank_balance);
    assert.strictEqual(summaryAfterDelete.total_inflow, summary.total_inflow);
    await assert.rejects(
      cashFlowService.deleteTransaction(incorrectIncome._id),
      (error) => error.statusCode === 404
    );

    const correctedWithdrawal = await CashTransaction.create({
      transaction_number: 'TT-TEST-DELETE-001',
      type: 'withdrawal',
      source_account: 'bank',
      to_account: 'cash',
      amount: 200000,
      category: 'tarik_tunai',
      description: 'Tarik tunai untuk kas operasional',
      date: purchaseDate
    });
    const summaryWithWithdrawal = await cashFlowService.getSummary(dateRange);
    assert.strictEqual(summaryWithWithdrawal.current_bank_balance, summary.current_bank_balance - 200000);
    assert.strictEqual(summaryWithWithdrawal.current_cash_balance, summary.current_cash_balance + 200000);
    await cashFlowService.deleteTransaction(correctedWithdrawal._id);
    const summaryAfterWithdrawalDelete = await cashFlowService.getSummary(dateRange);
    assert.strictEqual(summaryAfterWithdrawalDelete.current_bank_balance, summary.current_bank_balance);
    assert.strictEqual(summaryAfterWithdrawalDelete.current_cash_balance, summary.current_cash_balance);

    const mutations = await cashFlowService.getMutations({
      ...dateRange,
      account: 'all',
      limit: 50
    });
    const downPayments = mutations.data.filter((row) => row.trx_type === 'purchase_dp');
    const debtPayments = mutations.data.filter((row) => row.trx_type === 'debt_payment');
    assert.deepStrictEqual(
      downPayments.map((row) => row.amount).sort((a, b) => a - b),
      [100, 300, 300]
    );
    assert.deepStrictEqual(
      debtPayments.map((row) => row.amount).sort((a, b) => a - b),
      [200, 200, 200]
    );
    assert.strictEqual(mutations.total, 6);

    console.log('Cash-flow debt payment tests passed.');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
