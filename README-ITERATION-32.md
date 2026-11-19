# AOMS 2.0 — Iteration 32: route coordinate guard

## Changes
- Added a shared route-coordinate validator for Uzbekistan bounds.
- Route generation now excludes missing, malformed, non-finite, and out-of-Uzbekistan coordinate pairs before clustering and optimization.
- Route UI clarifies that the excluded coordinate count includes invalid coordinate values, not only blank fields.
- Existing route selection, status/category exclusions, clustering, KPI cap, Yandex API and local optimization are preserved.

## Safety
- No production database, Railway, GitHub, Telegram bot, or environment variables were accessed or modified.
- No migration is required.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`
- TypeScript and Next.js production build are not certified in this workspace because dependencies are not installed.
