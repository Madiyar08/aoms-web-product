# Iteration 39 — warehouse crew attribution and stock integrity

## Changes

- Warehouse issue transactions can optionally be assigned to an existing crew (`machineId`). The server verifies the crew exists, and forbids crew attribution on receipts. Legacy warehouse movements without `machineId` remain valid.
- The warehouse page now shows crew selection on new issues, crew attribution in the movement ledger, and a per-crew/per-item issued-quantity summary. Totals are calculated from the latest 500 ledger movements; this is explicitly labeled, **not** presented as all-time accounting.
- Archive operations are rejected when stock is nonzero. Previously, archiving could hide remaining stock from the active inventory view. This validation is server-side, inside the existing transaction; the UI also disables archiving nonzero-stock items.
- Movement history resolves archived material names, retaining readable historical records.
- Warehouse quantity validation rejects positive values that would round to zero at 3-decimal precision.
- Updated warehouse UI with clear forms, stock alerts, history and explicit explanation that crew attribution does not automatically debit supplies based on cleaning reports.
- Warehouse audit events for issue/receipt include the attributed `machineId` (or `null`). No schema migration required for the JSON-row SQLite model.

## Compatibility / limitations

- Existing warehouse data and historical movements remain readable.
- New crew attribution is optional so existing general-expense workflows are preserved.
- There is no automatic stock consumption from completed cleaning reports, no inventory reconciliation workflow and no accounting integration.
- No production DB, Railway deployment, GitHub repository or live Telegram integration was accessed.

## Verification

- `node --experimental-strip-types --test tests/*.test.mjs`: **97 passed, 0 failed**.
- Modified TS/TSX files parsed successfully using TypeScript `transpileModule`.
- ZIP integrity checked after packaging.
- Full `tsc --noEmit` and Next.js production build were **not** verified because project dependencies are not installed in the working copy.
