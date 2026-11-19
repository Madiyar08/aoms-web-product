import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWarehouseIssueAllowed, calculateWarehouseBalance, normalizeWarehouseUnit, validateWarehouseQuantity } from '../lib/warehouse-core.ts';

test('calculates stock from receipts and issues', () => {
  assert.equal(calculateWarehouseBalance([{type:'receipt',quantity:20},{type:'issue',quantity:7.5},{type:'receipt',quantity:2}]), 14.5);
});
test('rejects non-positive, non-finite and excessive quantities', () => {
  for (const value of [0,-1,NaN,Infinity,1000001,'abc']) assert.throws(() => validateWarehouseQuantity(value));
});
test('prevents issue greater than available balance', () => {
  assert.throws(() => assertWarehouseIssueAllowed(3,4), /Недостаточно/);
  assert.doesNotThrow(() => assertWarehouseIssueAllowed(3,3));
});
test('normalizes units and rejects blank values', () => {
  assert.equal(normalizeWarehouseUnit(' шт '), 'шт');
  assert.throws(() => normalizeWarehouseUnit(' '));
});
test('rounds quantity to three decimal places', () => {
  assert.equal(validateWarehouseQuantity(1.23456), 1.235);
});

import { assertWarehouseArchiveAllowed, summarizeWarehouseIssuesByCrew } from '../lib/warehouse-core.ts';

test('warehouse archive is allowed only when the balance is zero', () => {
  assert.doesNotThrow(() => assertWarehouseArchiveAllowed(0));
  for (const value of [1, -1, Infinity, NaN]) assert.throws(() => assertWarehouseArchiveAllowed(value), /ненулевым/);
});
test('crew issue totals are grouped by crew and item, ignoring receipts and unattributed issues', () => {
  const summary = summarizeWarehouseIssuesByCrew([
    {machineId:'m1',itemId:'soap',type:'issue',quantity:1.25},
    {machineId:'m1',itemId:'soap',type:'issue',quantity:0.75},
    {machineId:'m2',itemId:'soap',type:'issue',quantity:3},
    {machineId:'m1',itemId:'brush',type:'issue',quantity:2},
    {machineId:'m1',itemId:'soap',type:'receipt',quantity:100},
    {itemId:'soap',type:'issue',quantity:4},
  ]);
  assert.deepEqual(summary, [
    {machineId:'m1',itemId:'brush',quantity:2,operations:1},
    {machineId:'m1',itemId:'soap',quantity:2,operations:2},
    {machineId:'m2',itemId:'soap',quantity:3,operations:1},
  ]);
});
test('crew issue totals reject malformed movement quantities', () => {
  assert.throws(() => summarizeWarehouseIssuesByCrew([{machineId:'m1',itemId:'soap',type:'issue',quantity:-2}]), /Количество/);
});

import { validateWarehouseCrewAssignment } from '../lib/warehouse-core.ts';
test('validates crew attribution for issue only and rejects unknown crews', () => {
  assert.doesNotThrow(() => validateWarehouseCrewAssignment('issue', 'm1', true));
  assert.doesNotThrow(() => validateWarehouseCrewAssignment('receipt', '', false));
  assert.throws(() => validateWarehouseCrewAssignment('receipt', 'm1', true), /только для выдачи/);
  assert.throws(() => validateWarehouseCrewAssignment('issue', 'deleted', false), /не найден/);
});
test('warehouse quantity cannot round down to zero', () => {
  assert.throws(() => validateWarehouseQuantity(0.0001), /округления/);
  assert.equal(validateWarehouseQuantity(0.0005), 0.001);
});
