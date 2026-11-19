import test from "node:test";
import assert from "node:assert/strict";
import { decideAdminPageAccess, shouldUseSecureCookie } from "../lib/auth-policy.ts";

test("admin pages fail closed when ADMIN_PASSWORD is missing", () => {
  assert.equal(decideAdminPageAccess(undefined, undefined, undefined), "redirect_not_configured");
  assert.equal(decideAdminPageAccess("", "anything", "anything"), "redirect_not_configured");
});

test("admin pages reject missing and incorrect session tokens", () => {
  assert.equal(decideAdminPageAccess("configured", undefined, "expected"), "redirect_unauthorized");
  assert.equal(decideAdminPageAccess("configured", "wrong", "expected"), "redirect_unauthorized");
});

test("admin pages allow only matching session token when password is configured", () => {
  assert.equal(decideAdminPageAccess("configured", "expected", "expected"), "allow");
});

test("secure cookies follow request protocol for HTTPS and localhost HTTP", () => {
  assert.equal(shouldUseSecureCookie("https:"), true);
  assert.equal(shouldUseSecureCookie("http:"), false);
  assert.equal(shouldUseSecureCookie("HTTPS:"), true);
});
