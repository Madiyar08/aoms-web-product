import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { listReportsByEmployee } from "@/lib/cleaning-reports";
import { toEmployeeCleaningReportView } from "@/lib/miniapp-report-view";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос." }, { status: 400 });
  }
  const initData = body && typeof body === "object" && !Array.isArray(body)
    ? String((body as Record<string, unknown>).initData || "") : "";
  const auth = validateTelegramInitData(initData);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность (Telegram)." }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) return NextResponse.json({ ok: false, error: "Сотрудник не найден." }, { status: 403 });

  const reports = listReportsByEmployee(employee.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
    .map(toEmployeeCleaningReportView);

  return NextResponse.json({ ok: true, reports, limit: 100 });
}
