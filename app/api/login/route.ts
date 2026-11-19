import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionToken, SESSION_COOKIE_NAME, sessionSigningSecret } from "@/lib/session-token";
import { shouldUseSecureCookie } from "@/lib/auth-policy";
import { authenticateAdminUser, ensureBootstrapAdmin } from "@/lib/admin-users";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const username = String(formData.get("username") || process.env.ADMIN_USERNAME || "admin");
  const password = String(formData.get("password") || "");
  const url = new URL(req.url);
  const secret = sessionSigningSecret();
  if (!secret) return NextResponse.redirect(new URL("/login?error=notset", url), 303);
  await ensureBootstrapAdmin();
  const user = await authenticateAdminUser(username, password);
  if (!user) return NextResponse.redirect(new URL("/login?error=wrong", url), 303);
  const token = await createAdminSessionToken({ sub: user.id, username: user.username, name: user.displayName, role: user.role }, secret);
  const res = NextResponse.redirect(new URL("/", url), 303);
  res.cookies.set(SESSION_COOKIE_NAME, token, { httpOnly: true, secure: shouldUseSecureCookie(url.protocol), sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
  return res;
}
