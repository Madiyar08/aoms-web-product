# AOMS 2.0 — Iteration 23: UX/UI redesign foundation

## What changed
- Replaced the previous compact, dark-only shell with a restrained light operations workspace and a dark navy navigation rail.
- Increased baseline typography, navigation hit areas, table readability, form control sizes and page spacing.
- Added active-route highlighting based on the current pathname; the overview item is no longer highlighted on every page.
- Added a mobile drawer with backdrop and automatic close after navigation.
- Reworked shared page styling so legacy modules use consistent white surfaces, neutral borders, readable tables and visible focus states.
- Updated metadata and neutralized the hard-coded personal administrator label in the global shell.

## Verification
- Existing automated unit suite: 56/56 passed on Node 22.16.0.
- Browser visual regression and production build are not yet verified in this environment because project dependencies are not installed.
- No production database, Railway environment, GitHub repository or live Telegram configuration was accessed.
