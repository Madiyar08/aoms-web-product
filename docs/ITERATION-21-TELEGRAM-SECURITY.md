# Iteration 21 — Telegram authentication hardening

## Changes

- Telegram Mini App `initData` validation now requires a signed `auth_date` and a valid numeric Telegram user ID.
- Signed `initData` is accepted for up to 24 hours to support a Mini App that remains open during a full work shift; timestamps more than 30 seconds in the future are rejected.
- Duplicate query keys and oversized payloads are rejected.
- HMAC digest comparison uses a constant-time comparison.
- Telegram webhook requests now require the `X-Telegram-Bot-Api-Secret-Token` header to match `TELEGRAM_WEBHOOK_SECRET`; comparison is constant-time.
- Missing webhook secret fails closed with HTTP 503; a wrong or missing request header returns HTTP 401.
- `.env.example` and README include webhook secret configuration and the `setWebhook` parameter.

## Required deployment configuration

Before deploying this iteration, set `TELEGRAM_WEBHOOK_SECRET` in the hosting environment to a random string of at least 32 characters. Keep it out of Git. Then register/update the Telegram webhook with:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<APP_HOST>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

If the secret is not configured, webhook processing is intentionally unavailable (503). Existing Telegram Mini App requests continue to require a valid Telegram-signed `initData` and a linked employee.

## Verification

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

Result in this workspace: 49 tests passed, 0 failed.

TypeScript and Next.js production build were not run because dependencies are not installed in this workspace. No production webhook, bot, database, or hosting configuration was changed.
