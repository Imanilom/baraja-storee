const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Supplier = require('../src/modules/suppliers/supplier.model');
const Purchase = require('../src/modules/purchases/purchase.model');
const PurchaseItem = require('../src/modules/purchases/purchase-item.model');
const DebtPayment = require('../src/modules/purchases/debt-payment.model');
const {
  reconcilePurchaseMutations,
  parseAmount
} = require('../src/modules/cash-flow/purchase-reconciliation.service');

const run = async () => {
  assert.strictEqual(parseAmount('Rp 1.234.567'), 1234567);
  assert.strictEqual(parseAmount('-1,234.50'), -1235);
  assert.strictEqual(parseAmount('nominal tidak valid'), null);

  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.11' }
  });

  try {
    await mongoose.connect(mongod.getUri());
    const supplier = await Supplier.create({ name: 'PT Biji Kopi', code: 'SUP-01' });
    const purchaseDate = new Date('2026-04-01T04:00:00.000Z');
    const directPurchase = await Purchase.create({
      purchase_number: 'TRX-20260401-0001',
      supplier_id: supplier._id,
      invoice_ref: 'INV-778',
      payment_method: 'transfer',
      payment_source: 'bank',
      total_actual: 125000,
      purchased_at: purchaseDate
    });
    await PurchaseItem.create({
      purchase_id: directPurchase._id,
      product_name: 'Biji Kopi Arabika',
      unit_name: 'kg',
      actual_qty: 5,
      actual_unit_price: 25000,
      actual_subtotal: 125000
    });
    await Purchase.create({
      purchase_number: 'TRX-20260401-0002',
      supplier_id: supplier._id,
      invoice_ref: 'INV-780',
      payment_method: 'transfer',
      payment_source: 'bank',
      total_actual: 125000,
      purchased_at: purchaseDate
    });
    const tempoPurchase = await Purchase.create({
      purchase_number: 'TRX-20260401-0003',
      supplier_id: supplier._id,
      invoice_ref: 'INV-779',
      payment_method: 'tempo',
      payment_source: 'bank',
      amount_paid: 50000,
      total_actual: 150000,
      purchased_at: purchaseDate
    });
    await DebtPayment.create({
      purchase_id: tempoPurchase._id,
      amount: 50000,
      payment_method: 'transfer',
      paid_at: purchaseDate,
      notes: 'Uang muka / DP saat transaksi'
    });
    await DebtPayment.create({
      purchase_id: tempoPurchase._id,
      amount: 100000,
      payment_method: 'transfer',
      paid_at: new Date('2026-04-02T04:00:00.000Z'),
      reference_number: 'PAY-202'
    });

    const result = await reconcilePurchaseMutations({
      debitMode: 'positive',
      rows: [
        { rowNumber: 2, date: '2026-04-01', description: 'TRANSFER PT BIJI KOPI INV-778', amount: 'Rp 125.000' },
        { rowNumber: 3, date: '2026-04-01', description: 'PT BIJI KOPI', amount: 50000 },
        { rowNumber: 4, date: '2026-04-02', description: 'PT BIJI KOPI BAYAR INV-779', reference: 'PAY-202', amount: 100000 },
        { rowNumber: 5, date: '2026-04-01', description: 'PT BIJI KOPI INV-778', amount: 130000 },
        { rowNumber: 6, date: '2026-04-01', description: 'PT BIJI KOPI', amount: 125000 },
        { rowNumber: 7, date: '2026-04-01', description: 'PT BIJI KOPI', amount: 'tidak-valid' },
        { rowNumber: 8, date: '2026-04-01', description: 'SETORAN', amount: -20000 },
        { rowNumber: 9, date: '2026-04-01', description: 'SETORAN', amount: 20000, direction: 'CR' },
        { rowNumber: 10, date: '2026-04-01', description: 'PT BIJI KOPI', amount: 1000, direction: 'X' }
      ]
    });

    assert.strictEqual(result.summary.debit_rows, 7);
    assert.strictEqual(result.summary.excluded_rows, 2);
    assert.strictEqual(result.summary.matched_rows, 3);
    assert.strictEqual(result.summary.unmatched_rows, 4);
    assert.strictEqual(result.summary.mismatch_percentage, 57.14);
    assert.strictEqual(result.rows[0].status, 'matched');
    assert.strictEqual(result.rows[0].purchase.purchase_id, String(directPurchase._id));
    assert.strictEqual(result.rows[0].purchase.invoice_reference, 'INV-778');
    assert.deepStrictEqual(result.rows[0].purchase.checks, {
      supplier_name: true,
      supplier_reference: true,
      amount: true
    });
    assert.deepStrictEqual(result.rows[0].purchase.items, [{
      name: 'Biji Kopi Arabika',
      unit: 'kg',
      quantity: 5,
      unit_price: 25000,
      subtotal: 125000
    }]);
    assert.strictEqual(result.rows[2].status, 'matched');
    assert.strictEqual(result.rows[3].status, 'amount_mismatch');
    assert.strictEqual(result.rows[3].candidates[0].checks.supplier_reference, true);
    assert.strictEqual(result.rows[3].candidates[0].checks.amount, false);
    assert.strictEqual(result.rows[4].status, 'ambiguous');
    assert.strictEqual(result.rows[4].candidates[0].checks.supplier_reference, false);
    assert.strictEqual(result.rows[5].status, 'invalid_amount');
    assert.strictEqual(result.rows[6].status, 'invalid_direction');

    const davinciSupplier = await Supplier.create({ name: 'DAVINCI', code: 'SUP-DAVINCI' });
    const toffinSupplier = await Supplier.create({ name: 'TOFFIN', code: 'SUP-TOFFIN' });
    const davinciPurchase = await Purchase.create({
      purchase_number: 'TRX-20260412-0018',
      supplier_id: davinciSupplier._id,
      payment_method: 'transfer',
      payment_source: 'bank',
      total_actual: 372000,
      purchased_at: new Date('2026-04-12T04:00:00.000Z')
    });
    const toffinPurchase = await Purchase.create({
      purchase_number: 'TRX-20260401-0004',
      supplier_id: toffinSupplier._id,
      payment_method: 'transfer',
      payment_source: 'bank',
      total_actual: 1170000,
      purchased_at: new Date('2026-04-01T04:00:00.000Z')
    });
    const statementRow = {
      rowNumber: 511,
      date: '2026-04-12',
      description: 'TR TO REMITT OCTOmobile TO ADRIAN CENAIDJA syrup davinci',
      amount: 'Rp 1.170.000'
    };
    const initialResult = await reconcilePurchaseMutations({
      debitMode: 'positive',
      rows: [statementRow]
    });
    assert.strictEqual(initialResult.rows[0].status, 'amount_mismatch');
    assert.strictEqual(initialResult.rows[0].candidates[0].amount, 372000);
    assert.ok(initialResult.rows[0].manual_candidates.some(
      (candidate) => candidate.key === `purchase:${toffinPurchase._id}`
    ));

    const manuallyMatched = await reconcilePurchaseMutations({
      debitMode: 'positive',
      rows: [statementRow],
      manualSelections: { 511: `purchase:${toffinPurchase._id}` }
    });
    assert.strictEqual(manuallyMatched.rows[0].status, 'manual_matched');
    assert.strictEqual(manuallyMatched.rows[0].purchase.purchase_id, String(toffinPurchase._id));
    assert.strictEqual(manuallyMatched.rows[0].purchase.amount_difference, 0);
    assert.strictEqual(manuallyMatched.summary.manual_matched_rows, 1);
    assert.strictEqual(manuallyMatched.summary.unmatched_rows, 0);
    assert.strictEqual(manuallyMatched.summary.mismatch_percentage, 0);

    const manuallySelectedWithDifferentAmount = await reconcilePurchaseMutations({
      debitMode: 'positive',
      rows: [statementRow],
      manualSelections: { 511: `purchase:${davinciPurchase._id}` }
    });
    assert.strictEqual(manuallySelectedWithDifferentAmount.rows[0].status, 'manual_matched');
    assert.strictEqual(manuallySelectedWithDifferentAmount.rows[0].purchase.amount_difference, 798000);
    assert.strictEqual(manuallySelectedWithDifferentAmount.summary.mismatch_percentage, 100);

    const duplicateRows = await reconcilePurchaseMutations({
      debitMode: 'positive',
      rows: [
        { rowNumber: 2, date: '2026-04-01', description: 'PT BIJI KOPI INV-778', amount: 125000 },
        { rowNumber: 3, date: '2026-04-01', description: 'PT BIJI KOPI INV-778', amount: 125000 }
      ]
    });
    assert.strictEqual(duplicateRows.summary.matched_rows, 0);
    assert.strictEqual(duplicateRows.summary.mismatch_percentage, 100);
    assert.deepStrictEqual(duplicateRows.rows.map((row) => row.status), ['ambiguous', 'ambiguous']);

    console.log('Purchase mutation reconciliation tests passed.');
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
