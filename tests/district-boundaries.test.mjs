import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInPolygon } from '../lib/geometry-polygon.ts';

const square = [
  { lat: 41, lon: 69 },
  { lat: 41, lon: 70 },
  { lat: 42, lon: 70 },
  { lat: 42, lon: 69 },
];

test('point in polygon accepts a point strictly inside', () => {
  assert.equal(pointInPolygon(41.5, 69.5, square), true);
});

test('point in polygon rejects a point outside', () => {
  assert.equal(pointInPolygon(42.5, 69.5, square), false);
});

test('point exactly on polygon edge is treated as inside', () => {
  assert.equal(pointInPolygon(41.5, 69, square), true);
});

test('point exactly on polygon vertex is treated as inside', () => {
  assert.equal(pointInPolygon(41, 69, square), true);
});

test('invalid coordinates and undersized polygons are rejected safely', () => {
  assert.equal(pointInPolygon(Number.NaN, 69.5, square), false);
  assert.equal(pointInPolygon(41.5, 69.5, square.slice(0, 2)), false);
});

import { validateBoundaryPoints } from '../lib/geometry-polygon.ts';

test('boundary accepts a single manually verified center', () => {
  assert.deepEqual(validateBoundaryPoints([{lat:41.3,lon:69.2}]), {ok:true});
});

test('boundary rejects exactly two points on the server-side contract', () => {
  assert.equal(validateBoundaryPoints([{lat:41,lon:69},{lat:42,lon:70}]).ok, false);
});

test('boundary rejects a self-intersecting polygon', () => {
  const bowtie = [
    {lat:0,lon:0},{lat:1,lon:1},{lat:0,lon:1},{lat:1,lon:0},
  ];
  assert.equal(validateBoundaryPoints(bowtie).ok, false);
});

test('boundary rejects duplicate and out-of-range points', () => {
  assert.equal(validateBoundaryPoints([{lat:0,lon:0},{lat:0,lon:1},{lat:1,lon:1},{lat:0,lon:0}]).ok, false);
  assert.equal(validateBoundaryPoints([{lat:91,lon:0}]).ok, false);
});
