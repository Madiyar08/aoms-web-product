import test from "node:test";
import assert from "node:assert/strict";
import { hashAdminPassword, verifyAdminPassword, normalizeUsername } from "../lib/admin-auth-core.ts";
import { isAomsRole } from "../lib/access-control-core.ts";
import { createAdminSessionToken, verifyAdminSessionToken } from "../lib/session-token.ts";

test("normalizes usernames and validates role catalogue", () => {
  assert.equal(normalizeUsername("  Admin.User  "), "admin.user");
  assert.equal(isAomsRole("super_admin"), true);
  assert.equal(isAomsRole("root"), false);
});
test("password hashes use salted scrypt and verify without storing plaintext", async () => {
  const encoded = await hashAdminPassword("Correct-Horse-123");
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyAdminPassword("Correct-Horse-123", encoded), true);
  assert.equal(await verifyAdminPassword("wrong-password", encoded), false);
  await assert.rejects(() => hashAdminPassword("short"));
});
test("named admin session is signed, role-bound and expires", async () => {
  const now = 1_800_000_000_000;
  const token = await createAdminSessionToken({ sub: "user-1", username: "admin", name: "Admin", role: "super_admin" }, "test-secret", now);
  const valid = await verifyAdminSessionToken(token, "test-secret", now + 1000);
  assert.equal(valid?.sub, "user-1");
  assert.equal(valid?.role, "super_admin");
  assert.equal(await verifyAdminSessionToken(token, "wrong-secret", now + 1000), null);
  assert.equal(await verifyAdminSessionToken(token, "test-secret", now + 13 * 60 * 60 * 1000), null);
});
