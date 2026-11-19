import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterNearbyPoints, flattenClusterMemberIndexes, haversineMeters } from '../lib/geo.ts';

const at = (eastMeters) => ({ lat: 41, lon: 69 + eastMeters / (111320 * Math.cos(41 * Math.PI / 180)) });

test('nearby ATM terminals form one stop and remain consecutive after route optimization', () => {
  const points = [at(0), at(300), at(8), at(15), at(600)];
  const clusters = clusterNearbyPoints(points, 30);
  assert.deepEqual(clusters.map((cluster) => cluster.memberIndexes), [[0, 2, 3], [1], [4]]);
  const routeIndexes = flattenClusterMemberIndexes(clusters, [1, 0, 2]);
  assert.deepEqual(routeIndexes, [1, 0, 2, 3, 4]);
  assert.deepEqual(routeIndexes.slice(1, 4), [0, 2, 3]);
});

test('complete-link clustering prevents chain-merging distant terminals', () => {
  const points = [at(0), at(25), at(50)];
  const clusters = clusterNearbyPoints(points, 30);
  assert.equal(haversineMeters(points[0], points[2]) > 30, true);
  assert.deepEqual(clusters.map((cluster) => cluster.memberIndexes), [[0, 1], [2]]);
});

test('cluster expansion ignores invalid indexes and duplicate members safely', () => {
  const clusters = [{ point: at(0), memberIndexes: [0, 1, 1] }];
  assert.deepEqual(flattenClusterMemberIndexes(clusters, [0, 9, 0]), [0, 1]);
});

test('invalid cluster threshold leaves each point as an independent stop', () => {
  const points = [at(0), at(1)];
  assert.deepEqual(clusterNearbyPoints(points, -1).map((cluster) => cluster.memberIndexes), [[0], [1]]);
});
