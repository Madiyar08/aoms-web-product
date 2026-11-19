export const ROLES = ["super_admin", "operations_manager", "inspector", "viewer"] as const;
export type AomsRole = (typeof ROLES)[number];
export type AomsPermission = "dashboard:read" | "operations:write" | "atms:write" | "schedule:write" | "inspector_reports:read" | "inspector_reports:review" | "cleaning_reports:review" | "audit_log:read" | "users:manage" | "settings:manage" | "warehouse:read" | "warehouse:write";
const ROLE_PERMISSIONS: Record<AomsRole, ReadonlySet<AomsPermission>> = {
  super_admin: new Set(["dashboard:read", "operations:write", "atms:write", "schedule:write", "inspector_reports:read", "inspector_reports:review", "cleaning_reports:review", "audit_log:read", "users:manage", "settings:manage", "warehouse:read", "warehouse:write"]),
  operations_manager: new Set(["dashboard:read", "operations:write", "atms:write", "schedule:write", "inspector_reports:read", "inspector_reports:review", "cleaning_reports:review", "audit_log:read", "warehouse:read", "warehouse:write"]),
  inspector: new Set(["dashboard:read", "inspector_reports:read"]), viewer: new Set(["dashboard:read", "inspector_reports:read", "warehouse:read"]),
};
export function roleHasPermission(role: AomsRole, permission: AomsPermission): boolean { return ROLE_PERMISSIONS[role].has(permission); }
export function isAomsRole(value: unknown): value is AomsRole { return typeof value === "string" && ROLES.includes(value as AomsRole); }
