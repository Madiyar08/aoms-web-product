import crypto from "node:crypto";

// Mini App can remain open for an entire work shift; accept signed initData for at most 24 hours.
export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
export const TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS = 30;

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Проверяет подпись и свежесть initData Telegram Mini App.
 * Старые initData отклоняются, чтобы перехваченный payload нельзя было
 * использовать неограниченно долго. nowSeconds вынесен для детерминированных тестов.
 */
export function validateTelegramInitData(
  initData: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
): { valid: boolean; userId?: string; error?: "not_configured" | "malformed" | "invalid_signature" | "expired" | "invalid_user" } {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { valid: false, error: "not_configured" };
  if (!initData || initData.length > 16_384) return { valid: false, error: "malformed" };

  const params = new URLSearchParams(initData);
  const entries = Array.from(params.entries());
  // Повторяющиеся ключи неоднозначны и не допускаются.
  if (entries.length === 0 || new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { valid: false, error: "malformed" };
  }
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  if (!hash || !authDateRaw || !/^\d+$/.test(authDateRaw)) return { valid: false, error: "malformed" };

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!constantTimeHexEqual(computedHash, hash)) return { valid: false, error: "invalid_signature" };

  const authDate = Number(authDateRaw);
  if (!Number.isSafeInteger(authDate) || authDate > nowSeconds + TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS || nowSeconds - authDate > maxAgeSeconds) {
    return { valid: false, error: "expired" };
  }

  try {
    const userJson = params.get("user");
    if (!userJson) return { valid: false, error: "invalid_user" };
    const user = JSON.parse(userJson) as { id?: unknown };
    if ((typeof user.id !== "number" && typeof user.id !== "string") || !/^\d+$/.test(String(user.id))) {
      return { valid: false, error: "invalid_user" };
    }
    return { valid: true, userId: String(user.id) };
  } catch {
    return { valid: false, error: "invalid_user" };
  }
}

/** Telegram webhook secret_token header validation. Missing configuration fails closed. */
export function validateTelegramWebhookSecret(configuredSecret: string | undefined, suppliedSecret: string | null): boolean {
  if (!configuredSecret || !suppliedSecret) return false;
  const a = Buffer.from(configuredSecret, "utf8");
  const b = Buffer.from(suppliedSecret, "utf8");
  return a.length === b.length && a.length >= 32 && crypto.timingSafeEqual(a, b);
}

