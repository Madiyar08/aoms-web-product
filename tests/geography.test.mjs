import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UZBEKISTAN_REGIONS,
  resolveRegionName,
  regionIdForName,
  districtScopedKey,
  resolveRegionWithFallback,
} from '../lib/geography.ts';

test('defines exactly the 14 administrative units in the specification', () => {
  assert.equal(UZBEKISTAN_REGIONS.length, 14);
  assert.equal(new Set(UZBEKISTAN_REGIONS.map((r) => r.id)).size, 14);
});

test('normalizes Russian and Uzbek aliases to stable region identifiers', () => {
  assert.equal(regionIdForName('Ташкентская область'), 'tashkent-region');
  assert.equal(regionIdForName('Toshkent shahri'), 'tashkent-city');
  assert.equal(resolveRegionName("Qoraqalpog'iston Respublikasi"), 'Республика Каракалпакстан');
});

test('keeps identically named districts scoped to their region', () => {
  const cityDistrict = districtScopedKey('Город Ташкент', 'Мирзо-Улугбекский');
  const regionDistrict = districtScopedKey('Ташкентская область', 'Мирзо-Улугбекский');
  assert.notEqual(cityDistrict, regionDistrict);
});

test('preserves unknown region labels for admin review rather than silently discarding them', () => {
  assert.equal(resolveRegionName('Новая область'), 'Новая область');
  assert.match(regionIdForName('Новая область'), /^custom:/);
});

test('inherits the last section region when an Excel region cell is blank', () => {
  assert.equal(resolveRegionWithFallback('', 'Ташкентская область'), 'Ташкентская область');
  assert.equal(resolveRegionWithFallback('Город Ташкент', 'Ташкентская область'), 'Город Ташкент');
});
