import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReportQuality } from '../lib/report-quality.ts';

test('counts antifraud and GPS quality signals independently', () => {
  const summary = summarizeReportQuality([
    { antifraudResult: 'review', gpsQuality: 'low_accuracy' },
    { antifraudResult: 'clear', gpsQuality: 'good' },
    { antifraudResult: 'review', gpsQuality: 'unavailable' },
    { gpsQuality: 'unavailable' },
  ]);
  assert.deepEqual(summary, { reviewCount: 2, lowGpsCount: 1, gpsUnavailableCount: 2 });
});

test('does not infer approval from missing antifraud flags', () => {
  const summary = summarizeReportQuality([{},{ antifraudResult: 'clear' }]);
  assert.equal(summary.reviewCount, 0);
  assert.equal(summary.lowGpsCount, 0);
  assert.equal(summary.gpsUnavailableCount, 0);
});
