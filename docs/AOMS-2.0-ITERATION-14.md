# AOMS 2.0 — Iteration 14: inspector media archive queue

## Implemented

- Added a persistent SQLite JSON-row queue `inspector_media_queue` for inspector report photos and video.
- Inspector report creation enqueues local media before returning the API response; Telegram upload runs in the existing Node runtime worker.
- Queue jobs are idempotently named by report ID, leased while processing, recovered after a stale lease, and retried with exponential backoff (up to 12 attempts).
- Each successful archive step updates the inspector report media URL and the queue checkpoint before deleting the local file.
- Photo archive uses Telegram `sendPhoto`; video archive uses Telegram `sendVideo`.
- Telegram-hosted video is served through the existing photo route with HTTP byte-range support.
- Inspector media remains in the separate inspector report model and does not enter cleaning reports or cleaning KPI calculations.

## Important limitations / follow-up

- Telegram API behavior and archive channel permissions were not live-tested; no production token or channel was accessed.
- Telegram video proxy currently advertises MP4 because Telegram `sendVideo` is used; source MOV/WebM handling should be validated against actual Telegram API behavior before production rollout.
- A process crash after Telegram accepts an upload but before SQLite records the returned `file_id` can cause a duplicate archive upload on retry. The local source is retained until the DB checkpoint succeeds, so this is an at-least-once delivery design, not exactly-once delivery.
- The pre-existing `/api/photos/[filename]` route does not enforce authenticated media access. This iteration does not claim to solve that security issue; access-control hardening is required before exposing sensitive inspection media.
- Full Next.js build and TypeScript compilation were not run because dependencies were not installed in this environment.
- Real Android/iOS, Telegram archive, Telegram outage/restart, and concurrent-worker tests remain required in staging.

## Verification

`node --experimental-strip-types --test tests/*.test.mjs` — 25 tests passed, 0 failed.
