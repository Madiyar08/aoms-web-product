# Iteration 35 — route exclusion diagnostics

## Changes

- Route snapshots now persist an `excludedAtms` diagnostic list with ATM ID, terminal code, name, district and the reason it was excluded.
- Reasons are recorded for excluded categories, excluded statuses, invalid/missing coordinates, and ATMs already assigned to another crew on the same date.
- The Routes page exposes the excluded ATM list in a collapsible panel (up to 200 visible entries per route) so operations staff can identify exactly which records need correction or review.
- Legacy route snapshots without this field remain compatible. Persisted diagnostic values are normalized defensively; malformed entries are discarded and duplicate ATM/reason pairs are collapsed.
- Existing route selection rules, KPI limits, cluster ordering, Yandex routing and assignment conflict guards are unchanged.

## Verification

- `node --experimental-strip-types --test tests/*.test.mjs` — 82 passed, 0 failed.
- ZIP integrity checked after packaging.
- TypeScript check and Next.js production build were not run; dependencies are not installed in this working copy.
- No production database, Railway environment, GitHub repository or live Telegram integration was accessed.
