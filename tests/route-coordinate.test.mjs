import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidRouteCoordinate } from '../lib/route-coordinate.ts';

test('accepts valid Uzbekistan coordinates as numbers and strings', () => {
  assert.equal(isValidRouteCoordinate(41.311081, 69.240562), true);
  assert.equal(isValidRouteCoordinate('41.311081', '69.240562'), true);
  assert.equal(isValidRouteCoordinate(37, 55.9), true);
  assert.equal(isValidRouteCoordinate(45.6, 73.2), true);
});

test('rejects missing, malformed, non-finite and out-of-country coordinates', () => {
  for (const [lat, lon] of [
    ['', '69.2'], ['41.3oops', '69.2'], ['Infinity', '69.2'], [NaN, 69.2],
    [0, 0], [41.3, 0], [91, 69.2], [41.3, 181], [null, 69.2], [41.3, undefined],
  ]) assert.equal(isValidRouteCoordinate(lat, lon), false, `${String(lat)}, ${String(lon)}`);
});
