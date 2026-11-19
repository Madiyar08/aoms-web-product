# AOMS 2.0 — Iteration 12: Inspector Mini App form

## Implemented
- Added a role-gated entry point for employees whose role is `Проверяющий`.
- Added a Mini App form for an optional ATM ID, required comment, up to five photos, and optional GPS metadata.
- Photo selection uses the device camera when supported by the Telegram WebView/browser (`capture="environment"`) and also allows the browser's normal image picker.
- Photos are resized client-side to a maximum 1600 px edge and JPEG quality 78 before upload.
- GPS capture is user-initiated; permission denial or unavailable GPS does not prevent report submission.
- Form posts to the existing `/api/miniapp/inspector-report` endpoint. Server-side role validation and separate `inspector_reports` storage remain authoritative.
- Inspector reports remain separate from cleaning reports and cleaning KPI.

## Verification
- `node --experimental-strip-types --test tests/*.test.mjs`: 20/20 passed.
- `npx tsc --noEmit`: could not complete because this working copy has incomplete dependencies/types (Next.js, React, Node, ExcelJS, Sharp, etc. missing from `node_modules`). The output is dependency-resolution/JSX typing errors; this is not a successful typecheck.
- Browser/device test not performed. Camera behavior depends on Telegram WebView and device permissions.

## Not included yet
- Video capture/upload (60 seconds with audio).
- Durable background archive queue for inspector media and retry after process restart.
- Supervisor status/comment workflow.
- Full build and end-to-end Telegram test.

No production Railway service, production database, production Telegram channel, or GitHub branch was accessed or modified.
