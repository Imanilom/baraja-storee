import assert from 'node:assert/strict';
import test from 'node:test';
import { getDateRange } from '../src/lib/date-range.js';

test('weekly date range runs Saturday through Friday', () => {
  assert.deepEqual(getDateRange('2026-11-20', 'weekly'), {
    startDate: '2026-11-14',
    endDate: '2026-11-20'
  });
  assert.deepEqual(getDateRange('2026-11-21', 'weekly'), {
    startDate: '2026-11-21',
    endDate: '2026-11-27'
  });
});
