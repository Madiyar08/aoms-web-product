/** Edge-compatible session helpers. Legacy shared-password tokens remain accepted during migration. */
export async function computeSessionToken(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password + ":aoms-session-v1");
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const SESSION_COOKIE_NAME = "aoms_session";
export interface AdminSessionClaims { sub: string; username: string; name: string; role: "super_admin" | "operations_manager" | "inspector" | "viewer"; exp: number; }
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeBase64Url(value: string): Uint8Array {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base + "=".repeat((4 - base.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function signingKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}
export async function createAdminSessionToken(claims: Omit<AdminSessionClaims, "exp">, secret: string, now = Date.now()): Promise<string> {
  const payload: AdminSessionClaims = { ...claims, exp: Math.floor(now / 1000) + 60 * 60 * 12 };
  const encoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await signingKey(secret, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded)));
  return `v2.${encoded}.${encodeBase64Url(signature)}`;
}
export async function verifyAdminSessionToken(token: string | undefined, secret: string | undefined, now = Date.now()): Promise<AdminSessionClaims | null> {
  if (!token || !secret || !token.startsWith("v2.")) return null;
  const parts = token.split("."); if (parts.length !== 3) return null;
  try {
    const key = await signingKey(secret, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[1]));
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as AdminSessionClaims;
    if (!claims.sub || !claims.username || !claims.name || !["super_admin", "operations_manager", "inspector", "viewer"].includes(claims.role) || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(now / 1000)) return null;
    return claims;
  } catch { return null; }
}
export function sessionSigningSecret(): string | undefined { return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || undefined; }
