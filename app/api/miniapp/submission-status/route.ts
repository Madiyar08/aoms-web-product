import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { getSubmissionRecord } from "@/lib/submission-idempotency";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const initData = params.get("initData") || "";
  const submissionId = params.get("submissionId") || "";
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(submissionId)) {
    return NextResponse.json({ ok: false, error: "Некорректный идентификатор отправки." }, { status: 400 });
  }
  const auth = validateTelegramInitData(initData);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность (Telegram)." }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) return NextResponse.json({ ok: false, error: "Сотрудник не найден." }, { status: 403 });
  const record = getSubmissionRecord(`${employee.id}:${submissionId}`);
  if (!record) return NextResponse.json({ ok: true, status: "not_found" });
  return NextResponse.json({
    ok: true,
    status: record.status,
    reportId: record.status === "completed" ? record.reportId : undefined,
  });
}
