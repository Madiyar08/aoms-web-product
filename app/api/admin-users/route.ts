import { NextRequest, NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api-auth";
import { createAdminUser, listAdminUsers, isAomsRole, updateAdminUser, resetAdminPassword } from "@/lib/admin-users";
import { roleHasPermission } from "@/lib/access-control";
import { appendAuditEvent } from "@/lib/audit-log";
import { withTransaction } from "@/lib/db";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "users:manage")) return NextResponse.json({ ok: false, error: "Недостаточно прав" }, { status: 403 });
  return NextResponse.json({ ok: true, users: listAdminUsers() });
}
export async function POST(req: NextRequest) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "users:manage")) return NextResponse.json({ ok: false, error: "Недостаточно прав" }, { status: 403 });
  try {
    const body = await req.json();
    if (!isAomsRole(body.role)) return NextResponse.json({ ok: false, error: "Недопустимая роль" }, { status: 400 });
    const user = await createAdminUser({ username: String(body.username || ""), displayName: String(body.displayName || ""), role: body.role, password: String(body.password || "") });
    withTransaction(() => appendAuditEvent({ actorId: session.sub, actorLabel: session.name, actorRole: session.role, action: "admin_user.created", entityType: "admin_user", entityId: user.id, detailsJson: JSON.stringify({ username: user.username, role: user.role }) }));
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Не удалось создать пользователя" }, { status: 400 }); }
}
export async function PATCH(req: NextRequest) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "users:manage")) return NextResponse.json({ ok: false, error: "Недостаточно прав" }, { status: 403 });
  try {
    const body = await req.json(); const id = String(body.id || "");
    if (!id) return NextResponse.json({ ok: false, error: "Не указан пользователь" }, { status: 400 });
    let ok = false; let action = "admin_user.updated";
    if (body.password !== undefined) { ok = await resetAdminPassword(id, String(body.password)); action = "admin_user.password_reset"; }
    else ok = updateAdminUser(id, { ...(body.displayName !== undefined ? { displayName: String(body.displayName) } : {}), ...(body.role !== undefined ? { role: body.role } : {}), ...(body.active !== undefined ? { active: Boolean(body.active) } : {}) });
    if (!ok) return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });
    withTransaction(() => appendAuditEvent({ actorId: session.sub, actorLabel: session.name, actorRole: session.role, action: action as "admin_user.updated", entityType: "admin_user", entityId: id, detailsJson: JSON.stringify({ changedFields: body.password !== undefined ? ["password"] : Object.keys(body).filter(k => k !== "id") }) }));
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Не удалось обновить пользователя" }, { status: 400 }); }
}
