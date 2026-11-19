import { NextRequest, NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api-auth";
import { roleHasPermission } from "@/lib/access-control";
import { listAuditEvents } from "@/lib/audit-log";

export async function GET(req: NextRequest) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "audit_log:read")) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: process.env.ADMIN_PASSWORD ? 401 : 503 });
  }
  const raw = Number(req.nextUrl.searchParams.get("limit") || 200);
  const limit = Number.isFinite(raw) ? raw : 200;
  return NextResponse.json({ ok: true, events: listAuditEvents(limit) });
}
