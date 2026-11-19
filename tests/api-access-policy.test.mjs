import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanAccessApi, requiredApiPermission } from '../lib/api-access-policy.ts';
import { roleHasPermission } from '../lib/access-control-core.ts';

test('inspector can read but cannot review inspector reports', () => {
  assert.equal(roleCanAccessApi('inspector', '/api/inspector-reports/abc', 'GET', roleHasPermission), true);
  assert.equal(roleCanAccessApi('inspector', '/api/inspector-reports/abc', 'PATCH', roleHasPermission), false);
});

test('operations manager can approve operational queue but cannot manage users', () => {
  assert.equal(roleCanAccessApi('operations_manager', '/api/change-queue/approve', 'POST', roleHasPermission), true);
  assert.equal(roleCanAccessApi('operations_manager', '/api/admin-users', 'GET', roleHasPermission), false);
});

test('viewer cannot export or mutate ATM data', () => {
  assert.equal(roleCanAccessApi('viewer', '/api/atms/export', 'GET', roleHasPermission), false);
  assert.equal(roleCanAccessApi('viewer', '/api/district-boundaries', 'POST', roleHasPermission), false);
});

test('unclassified administrative APIs are super-admin only by default', () => {
  assert.equal(requiredApiPermission('/api/admin/download-db', 'GET'), 'super_admin_only');
  assert.equal(roleCanAccessApi('operations_manager', '/api/admin/download-db', 'GET', roleHasPermission), false);
  assert.equal(roleCanAccessApi('super_admin', '/api/admin/download-db', 'GET', roleHasPermission), true);
});

test('photo-storage maintenance endpoints remain protected super-admin operations', () => {
  assert.equal(roleCanAccessApi('operations_manager', '/api/photos-storage/delete-old', 'POST', roleHasPermission), false);
  assert.equal(roleCanAccessApi('super_admin', '/api/photos-storage/delete-old', 'POST', roleHasPermission), true);
});

test("cleaning report decisions require review permission", () => {
  assert.equal(roleCanAccessApi("operations_manager", "/api/cleaning-reports/report-1", "PATCH", roleHasPermission), true);
  assert.equal(roleCanAccessApi("viewer", "/api/cleaning-reports/report-1", "PATCH", roleHasPermission), false);
});

test('cleaning report decisions require reviewer permission', () => {
  assert.equal(roleCanAccessApi('operations_manager', '/api/cleaning-reports/report-1', 'PATCH', roleHasPermission), true);
  assert.equal(roleCanAccessApi('viewer', '/api/cleaning-reports/report-1', 'PATCH', roleHasPermission), false);
});


test('full ATM registry exports are restricted to super-admin', () => {
  for (const path of ['/api/atms/export', '/api/atms/coverage-export']) {
    assert.equal(requiredApiPermission(path, 'GET'), 'super_admin_only');
    assert.equal(roleCanAccessApi('operations_manager', path, 'GET', roleHasPermission), false);
    assert.equal(roleCanAccessApi('viewer', path, 'GET', roleHasPermission), false);
    assert.equal(roleCanAccessApi('super_admin', path, 'GET', roleHasPermission), true);
  }
});
