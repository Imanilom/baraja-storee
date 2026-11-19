import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCashFlowReportExportRows,
  filterCashFlowReportMutations,
  getCashFlowReportCategory,
  getCashFlowReportMetrics
} from '../src/lib/cash-flow-report.mjs';

test('cash-flow report separates weekly credit purchases, payments, and current remaining balance', () => {
  const metrics = getCashFlowReportMetrics({
    current_cash_balance: 400,
    current_bank_balance: 600,
    current_petty_cash_balance: 50,
    total_liquidity: 1050,
    total_purchase: 300,
    total_outflow: 500,
    total_inflow: 200
  }, [
    { payment_method: 'tempo', total_actual: 900, amount_remaining: 500 },
    { payment_method: 'cash', total_actual: 300, amount_remaining: 0 }
  ], [
    { source_type: 'purchase', trx_type: 'purchase_dp', amount: 100 },
    { source_type: 'debt_payment', trx_type: 'debt_payment', amount: 200 },
    { source_type: 'overhead_payment', trx_type: 'overhead_payment', amount: 40 }
  ]);

  assert.deepEqual(metrics, {
    cashBalance: 400,
    bankBalance: 600,
    pettyCashBalance: 50,
    totalFunds: 1050,
    totalPurchases: 300,
    totalOutflow: 500,
    totalInflow: 200,
    directPurchases: 300,
    debtCreated: 900,
    debtPaid: 300,
    debtRemaining: 500
  });
});

test('cash-flow report groups Baraja/POS receipts as modal and separates direct from credit purchases', () => {
  assert.equal(getCashFlowReportCategory({
    source_type: 'cash_transaction',
    trx_type: 'in',
    category: 'penjualan_pos'
  }), 'capital');
  assert.equal(getCashFlowReportCategory({
    source_type: 'purchase',
    trx_type: 'purchase'
  }), 'purchase_direct');
  assert.equal(getCashFlowReportCategory({
    source_type: 'purchase',
    trx_type: 'purchase_dp'
  }), 'purchase_tempo');
});

test('cash-flow report category filter and Excel-compatible export include selected details', () => {
  const mutations = [
    { source_type: 'purchase', trx_type: 'purchase', amount: 500, date: '2026-11-18', title: 'Belanja bahan' },
    { source_type: 'debt_payment', trx_type: 'debt_payment', amount: 100, date: '2026-11-19', title: 'Bayar hutang' }
  ];

  assert.deepEqual(filterCashFlowReportMutations(mutations, 'debt_payment'), [mutations[1]]);
  const rows = createCashFlowReportExportRows(
    { cashBalance: 0, bankBalance: 0, totalFunds: 0, totalPurchases: 500, debtCreated: 0, debtPaid: 100, debtRemaining: 0 },
    [{ label: 'Belanja supplier', count: 1, amount: 500 }],
    [mutations[1]]
  );
  assert.ok(rows.some((row) => row[4] === 'Bayar hutang'));
});
