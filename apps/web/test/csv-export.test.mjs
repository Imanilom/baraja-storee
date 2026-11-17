import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsv } from '../src/lib/csv-export.mjs';

test('buildCsv quotes delimiters and quotes and protects spreadsheet formulas', () => {
  const csv = buildCsv([
    ['Tanggal', 'Keterangan', 'Nominal'],
    ['2026-11-17', 'Bayar; supplier "A"', 150000],
    ['2026-11-18', '=1+1', 0]
  ]);

  assert.equal(
    csv,
    '\uFEFFTanggal;Keterangan;Nominal\r\n2026-11-17;"Bayar; supplier ""A""";150000\r\n2026-11-18;\'=1+1;0'
  );
});

test('buildCsv rejects malformed row inputs', () => {
  assert.throws(() => buildCsv(null), TypeError);
  assert.throws(() => buildCsv([['header'], 'invalid']), TypeError);
});
