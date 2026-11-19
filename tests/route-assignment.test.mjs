import test from 'node:test';
import assert from 'node:assert/strict';
import { findAlreadyAssignedAtmIds } from '../lib/route-assignment.ts';

test('detects ATM assigned to another crew on the same date', () => {
  const assigned = findAlreadyAssignedAtmIds(
    ['a', 'b', 'c'],
    [{ scheduleId: 's1', date: '2026-11-19', atmIds: ['b', 'x'] }],
    '2026-11-19',
    's2'
  );
  assert.deepEqual([...assigned], ['b']);
});

test('does not treat same schedule, another date, or unrelated ATM as conflicts', () => {
  const assigned = findAlreadyAssignedAtmIds(
    ['a', 'b'],
    [
      { scheduleId: 's2', date: '2026-11-19', atmIds: ['a'] },
      { scheduleId: 's1', date: '2026-11-18', atmIds: ['b'] },
      { scheduleId: 's3', date: '2026-11-19', atmIds: ['x'] },
    ],
    '2026-11-19',
    's2'
  );
  assert.deepEqual([...assigned], []);
});

test('deduplicates overlapping assignment conflicts', () => {
  const assigned = findAlreadyAssignedAtmIds(
    ['a', 'a', 'b'],
    [
      { scheduleId: 's1', date: '2026-11-19', atmIds: ['a'] },
      { scheduleId: 's3', date: '2026-11-19', atmIds: ['a', 'b'] },
    ],
    '2026-11-19',
    's2'
  );
  assert.deepEqual([...assigned].sort(), ['a', 'b']);
});
