import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, type AdminSessionClaims } from "./session-token";

export { ROLES, roleHasPermission } from "./access-control-core";
export type { AomsRole, AomsPermission } from "./access-control-core";
import type { AomsRole, AomsPermission } from "./access-control-core";
import { roleHasPermission as coreRoleHasPermission } from "./access-control-core";
function readNamedClaims(): AdminSessionClaims | null {
  try {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!token?.startsWith("v2.")) return null;
    const encoded = token.split(".")[1];
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - encoded.length % 4) % 4));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AdminSessionClaims;
  } catch { return null; }
}
export function currentAdminRole(): AomsRole | null {
  const claims = readNamedClaims();
  if (claims && claims.exp > Math.floor(Date.now() / 1000)) return claims.role;
  return process.env.ADMIN_PASSWORD ? "super_admin" : null;
}
export function currentAdminActor(): { actorId: string; actorLabel: string; role: AomsRole } | null {
  const claims = readNamedClaims();
  if (claims && claims.exp > Math.floor(Date.now() / 1000)) return { actorId: claims.sub, actorLabel: claims.name, role: claims.role };
  return process.env.ADMIN_PASSWORD ? { actorId: "shared-admin-session", actorLabel: "Общая сессия администратора", role: "super_admin" } : null;
}

/** Enforce permissions again inside Server Actions; page visibility is not authorization. */
export function requireAdminPermission(permission: AomsPermission): AomsRole {
  const role = currentAdminRole();
  if (!role || !coreRoleHasPermission(role, permission)) {
    throw new Error("Недостаточно прав для выполнения операции");
  }
  return role;
}
