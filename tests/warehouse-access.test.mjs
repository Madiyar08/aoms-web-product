import test from 'node:test';
import assert from 'node:assert/strict';
import { roleHasPermission } from '../lib/access-control-core.ts';

test('super admin and operations manager can write warehouse movements', () => {
  assert.equal(roleHasPermission('super_admin','warehouse:write'), true);
  assert.equal(roleHasPermission('operations_manager','warehouse:write'), true);
});
test('viewer can read warehouse but cannot mutate it; inspector has no warehouse access', () => {
  assert.equal(roleHasPermission('viewer','warehouse:read'), true);
  assert.equal(roleHasPermission('viewer','warehouse:write'), false);
  assert.equal(roleHasPermission('inspector','warehouse:read'), false);
  assert.equal(roleHasPermission('inspector','warehouse:write'), false);
});
