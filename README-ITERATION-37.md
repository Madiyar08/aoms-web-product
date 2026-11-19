# Iteration 37 — Cleaning report approval workflow

## Implemented
- New cleaning reports default to `pending`; legacy reports without an approval field are treated as pending.
- Added `/cleaning-review` queue with report details, photo links, GPS/route/antifraud context, reviewer comment, approve and reject actions.
- Added `PATCH /api/cleaning-reports/[id]`, protected by `cleaning_reports:review`; terminal decisions cannot be overwritten.
- Report decision and append-only audit event are written atomically in SQLite.
- KPI calculations include only explicitly approved reports. Pending and rejected counts are separate.
- Daily Excel export includes approval status, reviewer, review time and comment.
- Navigation includes the review queue. Viewer/inspector roles do not receive access; super admin and operations manager have review permission.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`: 89 passed, 0 failed.
- ZIP integrity checked after packaging.
- TypeScript and Next.js production build not run because dependencies are not installed in this working copy.
- No production DB, Railway, GitHub or live Telegram endpoints were accessed.

## Operational note
Existing reports without an approval status are intentionally treated as pending and must be reviewed before contributing to KPI. This is the conservative migration behavior; no existing SQLite records are modified by this source change.
