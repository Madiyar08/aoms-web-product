# AOMS 2.0 — Iteration 25: Monitoring filters

## Changes
- Added region and district filters to the monitoring workspace.
- Geographic filtering is based on the ATM master-data region/district, not on the crew's planned district labels.
- Filtered report list, unique ATM count, district completion summary, and open ATM issues.
- When a geographic filter is active, the crew table shows crews with actual reports in that geography; the unfiltered view continues to show every crew scheduled for today.
- District options are scoped to the selected region.
- Added clear/reset behavior and explanatory labels so the scope of the filter is visible.

## Validation
- `node --experimental-strip-types --test tests/*.test.mjs`: 56 passed, 0 failed.
- TypeScript and Next production build were not run because dependency installation is not available in this work session.
- No production database, Railway, environment variables, GitHub, or Telegram channel was accessed.
