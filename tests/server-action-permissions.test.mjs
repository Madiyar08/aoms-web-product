import test from 'node:test';
import assert from 'node:assert/strict';
import { roleHasPermission } from '../lib/access-control-core.ts';

test('ATM mutations are restricted to roles with atms:write', () => {
  assert.equal(roleHasPermission('super_admin', 'atms:write'), true);
  assert.equal(roleHasPermission('operations_manager', 'atms:write'), true);
  assert.equal(roleHasPermission('viewer', 'atms:write'), false);
  assert.equal(roleHasPermission('inspector', 'atms:write'), false);
});

test('schedule and route mutations require schedule:write', () => {
  assert.equal(roleHasPermission('operations_manager', 'schedule:write'), true);
  assert.equal(roleHasPermission('viewer', 'schedule:write'), false);
  assert.equal(roleHasPermission('inspector', 'schedule:write'), false);
});

test('employee and role administration requires users:manage', () => {
  assert.equal(roleHasPermission('super_admin', 'users:manage'), true);
  assert.equal(roleHasPermission('operations_manager', 'users:manage'), false);
  assert.equal(roleHasPermission('viewer', 'users:manage'), false);
});

test('settings mutation requires settings:manage', () => {
  assert.equal(roleHasPermission('super_admin', 'settings:manage'), true);
  assert.equal(roleHasPermission('operations_manager', 'settings:manage'), false);
});
