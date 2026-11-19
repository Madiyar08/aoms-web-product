import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRouteExcludedAtms } from '../lib/route-exclusion-details.ts';

test('legacy route snapshots without exclusion details normalize to an empty list', () => {
  assert.deepEqual(normalizeRouteExcludedAtms(undefined), []);
  assert.deepEqual(normalizeRouteExcludedAtms(null), []);
  assert.deepEqual(normalizeRouteExcludedAtms({}), []);
});

test('normalizes valid ATM exclusion details and fills optional display fields', () => {
  assert.deepEqual(normalizeRouteExcludedAtms([
    { atmId: 'atm-1', reason: 'На ремонте' },
    { atmId: 'atm-2', code: '002', name: 'ATM 2', district: 'Мирабад', reason: 'Нет координат' },
  ]), [
    { atmId: 'atm-1', code: '', name: '', district: '', reason: 'На ремонте' },
    { atmId: 'atm-2', code: '002', name: 'ATM 2', district: 'Мирабад', reason: 'Нет координат' },
  ]);
});

test('drops malformed records and deduplicates identical ATM/reason pairs', () => {
  const result = normalizeRouteExcludedAtms([
    null,
    { atmId: '', reason: 'blank id' },
    { atmId: 'atm-1', reason: '' },
    { atmId: 'atm-1', reason: 'No coordinates' },
    { atmId: 'atm-1', reason: 'No coordinates', code: '123' },
    { atmId: 7, reason: 'invalid id' },
  ]);
  assert.deepEqual(result, [
    { atmId: 'atm-1', code: '', name: '', district: '', reason: 'No coordinates' },
  ]);
});
