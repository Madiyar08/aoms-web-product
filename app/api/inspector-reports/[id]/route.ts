import { NextRequest, NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api-auth";
import { roleHasPermission } from "@/lib/access-control";
import { getInspectorReportById, updateInspectorReport } from "@/lib/inspector-reports";
import { nowIso } from "@/lib/entity";
import { appendAuditEvent } from "@/lib/audit-log";
import { currentAdminActor } from "@/lib/access-control";
import { withTransaction } from "@/lib/db";

const STATUSES = new Set(["Новый", "На рассмотрении", "Закрыт"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "inspector_reports:review")) {
    return NextResponse.json({ ok: false, error: "Требуется авторизация администратора" }, { status: process.env.ADMIN_PASSWORD ? 401 : 503 });
  }
  const current = getInspectorReportById(params.id);
  if (!current) return NextResponse.json({ ok: false, error: "Отчёт не найден" }, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Некорректные данные" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const patch: { status?: "Новый" | "На рассмотрении" | "Закрыт"; managerComment?: string; reviewedAt?: string; reviewedBy?: string } = {};
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !STATUSES.has(input.status)) return NextResponse.json({ ok: false, error: "Недопустимый статус" }, { status: 400 });
    patch.status = input.status as "Новый" | "На рассмотрении" | "Закрыт";
  }
  if (input.managerComment !== undefined) {
    if (typeof input.managerComment !== "string" || input.managerComment.length > 4000) return NextResponse.json({ ok: false, error: "Комментарий должен быть текстом до 4000 символов" }, { status: 400 });
    patch.managerComment = input.managerComment.trim();
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "Нет изменений" }, { status: 400 });
  patch.reviewedAt = nowIso();
  patch.reviewedBy = session.name;
  const actor = currentAdminActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Сессия администратора недоступна" }, { status: 503 });
  const action = patch.managerComment !== undefined
    ? "inspector_report.comment_updated" as const
    : "inspector_report.reviewed" as const;
  try {
    withTransaction(() => {
      const updated = updateInspectorReport(params.id, patch);
      if (!updated) throw new Error("REPORT_UPDATE_CONFLICT");
      appendAuditEvent({
        actorId: actor.actorId,
        actorLabel: actor.actorLabel,
        actorRole: actor.role,
        action,
        entityType: "inspector_report",
        entityId: params.id,
        detailsJson: JSON.stringify({ status: patch.status ?? current.status, commentChanged: patch.managerComment !== undefined, commentLength: patch.managerComment?.length ?? null }),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_UPDATE_CONFLICT") {
      return NextResponse.json({ ok: false, error: "Не удалось обновить отчёт" }, { status: 409 });
    }
    console.error("[inspector-reports] review + audit transaction failed", error);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить изменение и запись аудита" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, report: getInspectorReportById(params.id) });
}
