import assert from 'node:assert/strict';
import test from 'node:test';
import { createCashFlowExportRows } from '../src/lib/cash-flow-export.mjs';

test('cash-flow export sorts dates and balances income, withdrawals, and debt payments', () => {
  const rows = createCashFlowExportRows([
    {
      date: '2026-11-20T00:00:00.000Z',
      trx_type: 'debt_payment',
      source_type: 'debt_payment',
      direction: 'out',
      account: 'bank',
      amount: 100,
      title: 'Bayar hutang',
      category_label: 'Bayar Hutang',
      reference_number: 'PAY-1'
    },
    {
      date: '2026-11-18T00:00:00.000Z',
      trx_type: 'withdrawal',
      direction: 'transfer',
      amount: 300,
      title: 'Tarik tunai',
      category_label: 'Tarik Tunai'
    },
    {
      date: '2026-11-17T00:00:00.000Z',
      trx_type: 'in',
      direction: 'in',
      account: 'bank',
      amount: 1000,
      title: 'Setoran',
      category_label: 'Uang Masuk'
    }
  ], { cash: 100, bank: 500, petty_cash: 0 });

  assert.equal(rows.length, 5);
  assert.deepEqual(rows[1].slice(5, 8), [0, 1000, 1500]);
  assert.deepEqual(rows[2].slice(5, 8), [300, 0, 1200]);
  assert.deepEqual(rows[3].slice(5, 8), [0, 300, 400]);
  assert.deepEqual(rows[4].slice(5, 8), [100, 0, 1100]);
});

test('cash-flow export filters debt payments while preserving their account balance', () => {
  const rows = createCashFlowExportRows([
    {
      date: '2026-11-17T00:00:00.000Z',
      trx_type: 'in',
      direction: 'in',
      account: 'bank',
      amount: 500,
      title: 'Setoran'
    },
    {
      date: '2026-11-18T00:00:00.000Z',
      trx_type: 'debt_payment',
      source_type: 'debt_payment',
      direction: 'out',
      account: 'bank',
      amount: 100,
      title: 'Bayar hutang'
    }
  ], { bank: 200 }, 'debt_payment');

  assert.equal(rows.length, 2);
  assert.equal(rows[1][3], 'Bayar hutang');
  assert.deepEqual(rows[1].slice(5, 8), [100, 0, 600]);
});
