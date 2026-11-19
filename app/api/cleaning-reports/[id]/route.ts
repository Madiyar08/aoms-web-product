import { NextRequest, NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/admin-api-auth";
import { roleHasPermission } from "@/lib/access-control";
import { getCleaningReportById, updateCleaningReport } from "@/lib/cleaning-reports";
import { appendAuditEvent } from "@/lib/audit-log";
import { nowIso } from "@/lib/entity";
import { withTransaction } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminApiSession(req);
  if (!session || !roleHasPermission(session.role, "cleaning_reports:review")) {
    return NextResponse.json({ ok: false, error: "Недостаточно прав для проверки отчётов" }, { status: 401 });
  }
  const current = getCleaningReportById(params.id);
  if (!current) return NextResponse.json({ ok: false, error: "Отчёт не найден" }, { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Некорректные данные" }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.status !== "approved" && input.status !== "rejected") return NextResponse.json({ ok: false, error: "Статус должен быть approved или rejected" }, { status: 400 });
  if (current.approvalStatus === "approved" || current.approvalStatus === "rejected") {
    return NextResponse.json({ ok: false, error: "Отчёт уже рассмотрен. Повторное решение запрещено." }, { status: 409 });
  }
  const comment = input.comment === undefined ? "" : input.comment;
  if (typeof comment !== "string" || comment.length > 2000) return NextResponse.json({ ok: false, error: "Комментарий должен содержать не более 2000 символов" }, { status: 400 });
  const actorRole = session.role;
  const action = input.status === "approved" ? "cleaning_report.approved" : "cleaning_report.rejected";
  try {
    withTransaction(() => {
      const ok = updateCleaningReport(params.id, {
        approvalStatus: input.status as "approved" | "rejected",
        reviewedAt: nowIso(), reviewedBy: session.name, reviewComment: comment.trim(),
      });
      if (!ok) throw new Error("REPORT_UPDATE_CONFLICT");
      appendAuditEvent({ actorId: session.sub, actorLabel: session.name, actorRole, action, entityType: "cleaning_report", entityId: params.id,
        detailsJson: JSON.stringify({ status: input.status, commentLength: comment.trim().length }) });
    });
  } catch (error) {
    console.error("[cleaning-reports] approval transaction failed", error);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить решение и аудит" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, report: getCleaningReportById(params.id) });
}
