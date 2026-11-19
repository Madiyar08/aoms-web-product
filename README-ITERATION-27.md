# AOMS 2.0 — Iteration 27: ATM data quality workspace

## Delivered
- Added a reusable ATM data-quality analyzer (`lib/atm-quality.ts`).
- Added summary indicators for missing IDs, duplicate IDs, missing/invalid coordinates, missing districts and missing regions.
- Added one-click filters for these data-quality cases, plus missing address.
- Duplicate detection uses the same normalization rules as ATM lookup: trim/case-insensitive matching and leading-zero normalization for numeric IDs. Empty IDs are not treated as duplicates.
- Added coordinate pair validation helper for numeric values and geographic ranges.
- Fixed table selection behavior: selecting all now applies to the currently visible rows and does not accidentally clear selections hidden by active filters.
- Added automated tests for normalization, coordinate validation and quality counters.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`: 59 passed, 0 failed.
- ZIP archive integrity checked after packaging.
- TypeScript compiler and Next.js production build were not run because dependencies are not installed in this workspace.
- No production database, Railway deployment, GitHub push, environment variables or live Telegram integrations were accessed.

## Notes
The quality panel reports data gaps; it does not silently alter or delete ATM records. Coordinate validation checks numeric ranges only and does not claim that a point is actually located inside Uzbekistan or inside its assigned district. Geographic validation remains a separate step based on trusted administrative boundaries.
