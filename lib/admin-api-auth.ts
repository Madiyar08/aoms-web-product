import { NextRequest } from "next/server";
import { computeSessionToken, SESSION_COOKIE_NAME, sessionSigningSecret, verifyAdminSessionToken, type AdminSessionClaims } from "./session-token";

export async function getAdminApiSession(req: NextRequest): Promise<AdminSessionClaims | { sub: string; username: string; name: string; role: "super_admin" } | null> {
  const supplied = req.cookies.get(SESSION_COOKIE_NAME)?.value || "";
  const named = await verifyAdminSessionToken(supplied, sessionSigningSecret());
  if (named) return named;
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !supplied) return null;
  const expected = await computeSessionToken(password);
  if (supplied.length !== expected.length) return null;
  let diff = 0; for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? { sub: "shared-admin-session", username: "legacy-admin", name: "Общая сессия администратора", role: "super_admin" } : null;
}
export async function isAdminApiRequest(req: NextRequest): Promise<boolean> { return !!(await getAdminApiSession(req)); }
