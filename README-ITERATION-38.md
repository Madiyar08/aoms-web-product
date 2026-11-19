# Iteration 38 — employee cleaning report history

## Changes
- Added `POST /api/miniapp/my-cleaning-reports` authenticated with Telegram WebApp `initData`.
- The endpoint resolves the Telegram user to an employee and returns only that employee's latest 100 cleaning reports.
- Employee-facing projection includes ATM code, submission date/time, approval status, reviewer timestamp/comment and a boolean review-needed indicator.
- Sensitive internal details (GPS coordinates, photo paths, raw antifraud flags, machine and employee identifiers) are not exposed by this endpoint.
- Added a Mini App entry point and report-history screen with pending/approved/rejected counters, refresh, reviewer feedback and antifraud review indicator.
- Legacy reports without an explicit approval status are displayed as pending.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`: 92 passed, 0 failed.
- ZIP integrity checked after packaging.
- TypeScript/Next.js production build not verified; dependencies are not installed in this working copy.
- No production database, Railway deployment, GitHub repository or live Telegram bot was accessed.
