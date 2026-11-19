# AOMS 2.0 — Iteration 30: Excel import row diagnostics

## What changed

- Excel import preview now returns row-level diagnostics with the original worksheet row number, ATM ID, address, severity, and explanation.
- Missing coordinate pairs and coordinates outside the supported Uzbekistan bounds are reported as errors; those rows are skipped by the importer as before.
- Missing ATM IDs, unresolved district/region context, and duplicate IDs inside the workbook are surfaced as warnings/errors in the preview.
- The import UI shows a compact, horizontally scrollable diagnostics table and separate error/warning counts.
- Diagnostics are bounded to 100 entries to prevent oversized server-action responses for large workbooks.
- Added unit coverage for bounded diagnostics, severity summaries, and preservation of source row context.

## Safety and compatibility

- The existing preview rollback and file SHA-256 confirmation flow remain unchanged.
- Duplicate IDs in the file or database still block confirmation; server-side checks and transactional rollback remain in place.
- No production database, Railway service, environment variables, or Telegram integration was accessed or changed.

## Verification

- `node --experimental-strip-types --test tests/*.test.mjs`: **66 passed, 0 failed**.
- ZIP integrity checked after packaging.
- TypeScript and Next.js production build were not run because dependencies are not installed in this working copy.
