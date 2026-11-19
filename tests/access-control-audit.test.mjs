import test from "node:test";
import assert from "node:assert/strict";
import { roleHasPermission } from "../lib/access-control-core.ts";
import { AUDIT_ACTIONS } from "../lib/audit-log-catalog.ts";

test("super admin can review reports and read audit log", () => {
  assert.equal(roleHasPermission("super_admin", "inspector_reports:review"), true);
  assert.equal(roleHasPermission("super_admin", "cleaning_reports:review"), true);
  assert.equal(roleHasPermission("super_admin", "audit_log:read"), true);
});

test("inspector and viewer cannot review reports or manage users", () => {
  for (const role of ["inspector", "viewer"]) {
    assert.equal(roleHasPermission(role, "inspector_reports:review"), false);
    assert.equal(roleHasPermission(role, "users:manage"), false);
  }
});

test("operations manager can review but cannot manage roles or settings", () => {
  assert.equal(roleHasPermission("operations_manager", "inspector_reports:review"), true);
  assert.equal(roleHasPermission("operations_manager", "cleaning_reports:review"), true);
  assert.equal(roleHasPermission("operations_manager", "users:manage"), false);
  assert.equal(roleHasPermission("operations_manager", "settings:manage"), false);
});


test("audit catalogue covers core administrative mutations", () => {
  for (const action of [
    "atm.created", "atm.updated", "atm.deleted", "atm.bulk_updated", "atm.bulk_deleted",
    "schedule.created", "schedule.deleted", "employee.created", "employee.updated",
    "employee.deleted", "machine.created", "machine.updated", "machine.deleted",
    "recurring_schedule.created", "recurring_schedule.updated", "recurring_schedule.deleted",
  ]) assert.equal(AUDIT_ACTIONS.includes(action), true, `${action} must be catalogued`);
});

test("audit catalogue retains inspector report events", () => {
  assert.equal(AUDIT_ACTIONS.includes("cleaning_report.approved"), true);
  assert.equal(AUDIT_ACTIONS.includes("cleaning_report.rejected"), true);
  assert.equal(AUDIT_ACTIONS.includes("inspector_report.reviewed"), true);
  assert.equal(AUDIT_ACTIONS.includes("inspector_report.comment_updated"), true);
});
