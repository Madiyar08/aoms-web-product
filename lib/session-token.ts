/**
 * Простой общий пароль руководителя для входа в веб-интерфейс (не Mini
 * App — тот использует свой механизм через подпись Telegram initData).
 * Осознанно простая схема без ролей/пользователей — как договорились:
 * один пароль, один "администратор".
 *
 * Web Crypto API (crypto.subtle), а не node:crypto — потому что этот
 * файл используется и в middleware.ts, который выполняется на Edge
 * Runtime в Next.js 14 и не имеет доступа к модулям node:*. Web Crypto
 * доступен в обеих средах (Edge и обычный Node 19+) без дополнительных
 * импортов.
 */
export async function computeSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password + ":aoms-session-v1");
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SESSION_COOKIE_NAME = "aoms_session";
