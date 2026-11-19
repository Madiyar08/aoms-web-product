import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateTelegramInitData, validateTelegramWebhookSecret } from '../lib/telegram-auth-core.ts';

function makeInitData(token, values) {
  const params = new URLSearchParams(values);
  const dataCheckString = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('Telegram initData accepts a valid signed, fresh user payload', () => {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  try {
    const now = 1_800_000_000;
    const payload = makeInitData('test-bot-token', {
      auth_date: String(now - 60),
      user: JSON.stringify({ id: 123456, first_name: 'Test' }),
      query_id: 'query-1',
    });
    assert.deepEqual(validateTelegramInitData(payload, now), { valid: true, userId: '123456' });
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Telegram initData rejects stale, future, modified and duplicate-key payloads', () => {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  try {
    const now = 1_800_000_000;
    const fresh = makeInitData('test-bot-token', { auth_date: String(now - 60), user: JSON.stringify({ id: 123 }) });
    const stale = makeInitData('test-bot-token', { auth_date: String(now - 86_401), user: JSON.stringify({ id: 123 }) });
    const future = makeInitData('test-bot-token', { auth_date: String(now + 60), user: JSON.stringify({ id: 123 }) });
    assert.equal(validateTelegramInitData(stale, now).error, 'expired');
    assert.equal(validateTelegramInitData(future, now).error, 'expired');
    assert.equal(validateTelegramInitData(`${fresh}&auth_date=1800000000`, now).error, 'malformed');
    assert.equal(validateTelegramInitData(fresh.replace('user=', 'user=x'), now).error, 'invalid_signature');
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Telegram initData fails closed when bot token is missing or user is absent', () => {
  const previous = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal(validateTelegramInitData('auth_date=1&hash=abc').error, 'not_configured');
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
  try {
    const now = 1_800_000_000;
    const noUser = makeInitData('test-bot-token', { auth_date: String(now) });
    assert.equal(validateTelegramInitData(noUser, now).error, 'invalid_user');
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previous;
  }
});

test('Telegram webhook secret requires configured 32+ character secret and exact match', () => {
  const secret = 'a'.repeat(64);
  assert.equal(validateTelegramWebhookSecret(undefined, secret), false);
  assert.equal(validateTelegramWebhookSecret(secret, null), false);
  assert.equal(validateTelegramWebhookSecret('short', 'short'), false);
  assert.equal(validateTelegramWebhookSecret(secret, secret), true);
  assert.equal(validateTelegramWebhookSecret(secret, `${secret}x`), false);
});
