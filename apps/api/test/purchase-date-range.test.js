const assert = require('node:assert/strict');
const test = require('node:test');
const { buildDateRangeFilter } = require('../src/utils/date-range');

test('date-only purchase filters use an exclusive UTC end boundary', () => {
  assert.deepEqual(buildDateRangeFilter('2026-11-14', '2026-11-20'), {
    $gte: new Date('2026-11-14T00:00:00.000Z'),
    $lt: new Date('2026-11-21T00:00:00.000Z')
  });
});

test('timestamp purchase filters preserve exact boundaries', () => {
  assert.deepEqual(buildDateRangeFilter(
    '2026-11-14T07:30:00.000Z',
    '2026-11-20T16:59:59.999Z'
  ), {
    $gte: new Date('2026-11-14T07:30:00.000Z'),
    $lte: new Date('2026-11-20T16:59:59.999Z')
  });
});

test('date-only purchase filters reject impossible calendar dates', () => {
  assert.throws(() => buildDateRangeFilter('2026-02-30', null), /Tanggal awal transaksi tidak valid/);
});
