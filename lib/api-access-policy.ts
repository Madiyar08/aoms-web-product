import type { AomsPermission, AomsRole } from "./access-control-core";

/**
 * Server-side API authorization policy for named administrator sessions.
 * Unlisted administrative endpoints are intentionally super-admin only.
 * Public Mini App, Telegram webhook, login/logout, health and photo delivery
 * are excluded by middleware matcher and retain their own authentication.
 */
export function requiredApiPermission(pathname: string, method: string): AomsPermission | "super_admin_only" {
  const path = pathname.replace(/\/$/, "") || "/";
  const verb = method.toUpperCase();

  if (path === "/api/admin-users") return "users:manage";
  if (path === "/api/audit-log") return "audit_log:read";
  if (/^\/api\/cleaning-reports\/[^/]+$/.test(path)) return verb === "GET" ? "operations:write" : "cleaning_reports:review";

  if (path === "/api/inspector-reports" || /^\/api\/inspector-reports\/[^/]+$/.test(path)) {
    return verb === "GET" ? "inspector_reports:read" : "inspector_reports:review";
  }

  // Full ATM registry exports contain the complete bank dataset and are
  // explicitly restricted to super-admin, regardless of general ATM edit rights.
  if (path === "/api/atms/export" || path === "/api/atms/coverage-export") return "super_admin_only";
  if (path === "/api/district-boundaries") return verb === "GET" ? "dashboard:read" : "atms:write";
  if (path === "/api/district-boundaries/fetch-reference") return "atms:write";
  if (path === "/api/change-queue/approve" || path === "/api/change-queue/reject") return "operations:write";
  if (path === "/api/cleaning-reports/export" || path === "/api/reports/export") return "operations:write";

  // Database download, media maintenance and any newly added admin endpoint
  // must be explicitly reviewed before being granted to non-super-admin roles.
  return "super_admin_only";
}

export function roleCanAccessApi(role: AomsRole, pathname: string, method: string, roleHasPermission: (role: AomsRole, permission: AomsPermission) => boolean): boolean {
  const required = requiredApiPermission(pathname, method);
  return required === "super_admin_only" ? role === "super_admin" : roleHasPermission(role, required);
}
