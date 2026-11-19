import test from 'node:test';
import assert from 'node:assert/strict';
import { getAtmDataQuality, hasValidCoordinates, normalizeAtmIdentifier } from '../lib/atm-quality.ts';

const atm = (overrides = {}) => ({
  id: 'a1', createdAt: '', updatedAt: '', code: '00123', name: 'ATM', address: 'Street', district: 'District', region: 'Region',
  latitude: '41.3', longitude: '69.2', categoryId: 'cat', workStatusId: 'active', addressVerified: true, coordsVerified: true,
  comments: '', source: 'test', ...overrides,
});

test('normalizes numeric ATM IDs consistently with leading zero handling', () => {
  assert.equal(normalizeAtmIdentifier(' 00123 '), '123');
  assert.equal(normalizeAtmIdentifier('Ab-01'), 'ab-01');
  assert.equal(normalizeAtmIdentifier('  '), '');
});

test('validates coordinate pairs and rejects partial/out-of-range values', () => {
  assert.equal(hasValidCoordinates('41.3', '69.2'), true);
  assert.equal(hasValidCoordinates('91', '69.2'), false);
  assert.equal(hasValidCoordinates('41.3', ''), false);
  assert.equal(hasValidCoordinates('NaN', '69.2'), false);
});

test('counts duplicate IDs and data-quality gaps without treating blank IDs as duplicates', () => {
  const result = getAtmDataQuality([
    atm(), atm({ id: 'a2', code: '123' }),
    atm({ id: 'a3', code: '', region: '', district: '', address: '', latitude: '', longitude: '', categoryId: '', addressVerified: false, coordsVerified: false }),
    atm({ id: 'a4', code: 'x4', latitude: '95', longitude: '69.2' }),
  ]);
  assert.equal(result.total, 4);
  assert.equal(result.duplicateCodeGroups, 1);
  assert.equal(result.duplicateCodeRecords, 2);
  assert.equal(result.missingCode, 1);
  assert.equal(result.missingRegion, 1);
  assert.equal(result.missingDistrict, 1);
  assert.equal(result.missingAddress, 1);
  assert.equal(result.missingCoordinates, 1);
  assert.equal(result.invalidCoordinates, 1);
  assert.equal(result.missingCategory, 1);
  assert.equal(result.unverifiedAddress, 1);
  assert.equal(result.unverifiedCoordinates, 1);
});
