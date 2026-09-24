import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { getAtmById } from "@/lib/atms";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { formatTashkentDateTime } from "@/lib/tz";

/** Шаг 5: детали конкретного отчёта — фото, время, кто отправил, статус. */
export async function POST(req: NextRequest) {
  const { initData, reportId } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee || employee.role !== "Проверяющий") {
    return NextResponse.json({ ok: false, error: "Доступно только с ролью «Проверяющий»" }, { status: 403 });
  }
  if (!reportId) {
    return NextResponse.json({ ok: false, error: "Не указан ID отчёта" }, { status: 400 });
  }

  const report = listCleaningReports().find((r) => r.id === reportId);
  if (!report) {
    return NextResponse.json({ ok: false, error: "Отчёт не найден" }, { status: 404 });
  }
  const atm = report.atmId ? getAtmById(report.atmId) : null;

  let photos: string[] = [];
  if (report.photosJson) {
    try {
      photos = JSON.parse(report.photosJson);
    } catch {
      /* игнорируем битый JSON */
    }
  } else if (report.photoData) {
    photos = [report.photoData];
  }

  return NextResponse.json({
    ok: true,
    report: {
      atmCode: report.atmCode,
      atmName: atm?.name || "",
      employeeName: report.employeeName,
      time: formatTashkentDateTime(report.clientTime),
      inRoute: report.inRoute,
      reportedStatus: report.reportedWorkStatusName,
      antifraudFlags: report.antifraudFlags,
      photos,
    },
  });
}
