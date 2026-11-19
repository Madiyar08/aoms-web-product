import test from 'node:test';
import assert from 'node:assert/strict';
import { districtBoundaryKey, resolveBoundaryRegionId } from '../lib/district-boundary-key.ts';

test('boundary identity includes region and normalized district name', () => {
  assert.notEqual(
    districtBoundaryKey('tashkent-city', 'Мирзо-Улугбекский'),
    districtBoundaryKey('tashkent-region', 'Мирзо-Улугбекский')
  );
  assert.equal(districtBoundaryKey('tashkent-city', '  МИРЗО-УЛУГБЕКСКИЙ '), districtBoundaryKey('tashkent-city', 'Мирзо-Улугбекский'));
});

test('legacy records remain explicitly unscoped instead of being assigned to a region', () => {
  assert.equal(districtBoundaryKey(undefined, 'Чиланзар'), 'legacy:чиланзар');
  assert.notEqual(districtBoundaryKey(undefined, 'Чиланзар'), districtBoundaryKey('tashkent-city', 'Чиланзар'));
});

test('region name resolves to stable region id', () => {
  assert.equal(resolveBoundaryRegionId(undefined, 'Ташкентская область'), 'tashkent-region');
  assert.equal(resolveBoundaryRegionId('tashkent-city', 'Ташкентская область'), 'tashkent-city');
});
