const assert = require('node:assert/strict');
const CashTransaction = require('../src/modules/cash-flow/cash-transaction.model');
const Purchase = require('../src/modules/purchases/purchase.model');
const cashFlowService = require('../src/modules/cash-flow/cash-flow.service');

const originalCashFind = CashTransaction.find;
const originalPurchaseFind = Purchase.find;
const originalDownPayments = cashFlowService.getPurchaseInitialDownPayments;
const stringAmountTransactions = [
  { type: 'petty_transfer', to_account: 'petty_cash', amount: '1500000' },
  { type: 'petty_transfer', to_account: 'petty_cash', amount: '1000000' }
];

const queryResult = (rows) => ({
  select() {
    return this;
  },
  lean: async () => rows
});

async function run() {
  CashTransaction.find = () => queryResult(stringAmountTransactions);
  Purchase.find = () => queryResult([]);
  cashFlowService.getPurchaseInitialDownPayments = async () => new Map();

  try {
    assert.equal(await cashFlowService.getPettyCashBalance(new Date()), 2500000);
    assert.equal(await cashFlowService.getPettyCashDayBalance(new Date()), 2500000);
    console.log('Cash-flow amount normalization checks passed.');
  } finally {
    CashTransaction.find = originalCashFind;
    Purchase.find = originalPurchaseFind;
    cashFlowService.getPurchaseInitialDownPayments = originalDownPayments;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
