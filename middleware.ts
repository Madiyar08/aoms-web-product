import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, SESSION_COOKIE_NAME, sessionSigningSecret, verifyAdminSessionToken } from "@/lib/session-token";
import { decideAdminPageAccess } from "@/lib/auth-policy";
import { roleHasPermission } from "@/lib/access-control-core";
import { roleCanAccessApi } from "@/lib/api-access-policy";

export async function middleware(req: NextRequest) {
  const supplied = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const named = await verifyAdminSessionToken(supplied, sessionSigningSecret());
  if (named) {
    const path = req.nextUrl.pathname;
    if (path.startsWith("/api/")) {
      if (!roleCanAccessApi(named.role, path, req.method, roleHasPermission)) {
        return NextResponse.json({ ok: false, error: "Недостаточно прав" }, { status: 403 });
      }
      return NextResponse.next();
    }
    if (named.role === "viewer" && !["/", "/monitoring", "/reports", "/inspector-reports", "/atms", "/atms-map"].some(p => path === p || path.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/?access=denied", req.url));
    }
    if (named.role === "inspector" && !["/", "/monitoring", "/inspector-reports"].some(p => path === p || path.startsWith(p + "/"))) {
      return NextResponse.redirect(new URL("/?access=denied", req.url));
    }
    if (named.role === "operations_manager" && (path === "/users" || path.startsWith("/users/") || path === "/settings" || path.startsWith("/settings/"))) {
      return NextResponse.redirect(new URL("/?access=denied", req.url));
    }
    return NextResponse.next();
  }
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const expectedToken = configuredPassword ? await computeSessionToken(configuredPassword) : undefined;
  const decision = decideAdminPageAccess(configuredPassword, supplied, expectedToken);
  if (decision === "allow") return NextResponse.next();
  const loginUrl = new URL("/login", req.url);
  if (decision === "redirect_not_configured") loginUrl.searchParams.set("error", "notset");
  else loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
export const config = { matcher: ["/((?!login|miniapp|api/miniapp|api/login|api/logout|api/telegram|api/photos/|api/health|_next/static|_next/image|favicon.ico).*)"] };
