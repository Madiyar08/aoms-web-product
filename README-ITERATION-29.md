# AOMS 2.0 — Iteration 29: ATM change timeline

## Delivered
- Added an entity-scoped audit-log reader for ATM records. It returns newest-first immutable audit events with a bounded result limit.
- Added a change-history section to the ATM detail page.
- The timeline combines administrative audit events (create/update/delete/bulk changes where recorded) with employee-submitted ATM change signals (location, district, new ATM, ID change).
- Each employee signal shows its review state, date, employee, proposed change summary and comment when present.
- Added safe labels and summaries for known and future change types; absent values are displayed as unknown rather than fabricated.

## Validation
- `node --experimental-strip-types --test tests/*.test.mjs`: 63 passed, 0 failed.
- ZIP integrity checked with `unzip -t`.
- TypeScript / Next.js production build not verified: dependencies are not installed in this workspace.

## Safety
- No production database, Railway environment, GitHub repository, environment variables or live Telegram channels were accessed or changed.
- No database migration was required.
