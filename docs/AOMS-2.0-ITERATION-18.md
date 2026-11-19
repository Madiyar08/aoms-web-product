# AOMS 2.0 — Iteration 18: fail-closed admin access

## Changes

- The web administration middleware now fails closed when `ADMIN_PASSWORD` is absent. Requests to protected pages redirect to `/login?error=notset` instead of rendering server-side admin pages publicly.
- Incorrect or missing session cookies are redirected to the login page.
- The login cookie uses the `Secure` attribute on HTTPS requests and remains usable on local HTTP development.
- Added pure auth-policy helpers and automated tests for missing configuration, invalid sessions, valid sessions, and cookie transport policy.

## Compatibility and operational notes

- The existing shared-password login remains in place. This iteration does not yet add named user accounts or migrate sessions to per-user identities.
- Telegram Mini App, Telegram webhook, login/logout, health, and existing photo endpoints remain excluded from this middleware matcher and retain their separate existing access paths.
- Before deploying, verify `ADMIN_PASSWORD` is set in the target environment. If it is absent, the admin web interface will now intentionally remain inaccessible and show the configuration warning rather than expose server-rendered operational data.
- No production database, Railway environment, GitHub repository, or live Telegram integration was accessed or modified.

## Verification

- `node --experimental-strip-types --test tests/*.test.mjs`: 37 passed, 0 failed.
- TypeScript check and Next.js production build were not run because dependencies are not installed in this working directory.
- Browser, Android, and iOS verification were not performed.
