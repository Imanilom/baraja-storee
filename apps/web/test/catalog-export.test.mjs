import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLatestPricesExportRows,
  createProductsExportRows
} from '../src/lib/catalog-export.mjs';

test('latest price export includes price, supplier, source, and product identifiers', () => {
  const rows = createLatestPricesExportRows([{
    product: { name: 'Kopi', sku: 'KOP-01' },
    latest_price: 25000,
    product_unit: { abbreviation: 'kg' },
    supplier: { name: 'Supplier A' },
    recorded_at: '2026-11-20T08:00:00.000Z',
    source: 'purchase'
  }]);

  assert.deepEqual(rows[1].slice(0, 5), ['Kopi', 'KOP-01', 25000, 'kg', 'Supplier A']);
  assert.equal(rows[1][6], 'Pembelian');
});

test('product export includes catalog attributes and active status', () => {
  const rows = createProductsExportRows([{
    name: 'Susu',
    sku: 'SUS-01',
    item_type: 'perishable',
    category_id: { name: 'Dairy' },
    unit_id: { name: 'Liter' },
    last_purchase_price: 18000,
    last_supplier_id: { name: 'Supplier B' },
    is_active: false
  }]);

  assert.deepEqual(rows[1], [
    'Susu', 'SUS-01', 'Perishable', 'Dairy', 'Liter', 18000, 'Supplier B', 'Nonaktif'
  ]);
});
