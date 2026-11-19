# Iteration 20 — API RBAC enforcement

## Changes

- Added a centralized API access policy for named administrator sessions.
- Middleware now applies role/permission checks to administrative `/api/*` routes after validating the signed named session.
- Inspector and viewer roles can read inspector reports but cannot review them.
- Operations managers can use operational change-queue actions but cannot manage administrator accounts.
- ATM exports and district-boundary changes require the corresponding ATM permission.
- Administrative API routes not explicitly classified are super-admin-only by default. This is intentionally fail-closed.
- Added unit tests for role boundaries and the default-deny behavior.

## Compatibility and boundaries

- Legacy shared `ADMIN_PASSWORD` sessions continue through the existing legacy path and are treated as super-admin for compatibility.
- Mini App, Telegram webhook, login/logout, health and photo endpoints remain outside this middleware branch and must continue to enforce their own authentication/validation.
- This iteration does not claim a complete security audit of every business rule or object-level access check.

## Verification

Run:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

Result in this workspace: 44 tests passed, 0 failed.

TypeScript and Next.js production build were not run because project dependencies are not installed in this workspace. Do not deploy solely on the basis of unit tests; verify with a staging copy first.
