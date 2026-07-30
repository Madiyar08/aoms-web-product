import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId, getTodayRouteForEmployee } from "@/lib/miniapp";
import { listStatuses } from "@/lib/statuses";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { todayTashkent, tashkentDateString } from "@/lib/tz";

export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }

  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Вы не привязаны к системе. Обратитесь к руководителю." }, { status: 403 });
  }

  const { atms, machineNumber, scheduleFound } = getTodayRouteForEmployee(employee.id);

  // Банкоматы, по которым УЖЕ пришёл отчёт сегодня (не важно, от кого из
  // экипажа) — чтобы в списке они подсвечивались зелёным даже после
  // обновления страницы, а не только в текущей сессии.
  const today = todayTashkent();
  const doneTodayIds = new Set(
    listCleaningReports()
      .filter((r) => tashkentDateString(new Date(r.clientTime)) === today)
      .map((r) => r.atmId)
  );

  return NextResponse.json({
    ok: true,
    employeeName: employee.fullName,
    employeeRole: employee.role || "",
    machineNumber,
    scheduleFound,
    atms: atms.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      doneToday: doneTodayIds.has(a.id),
    })),
    statuses: listStatuses().map((s) => ({ id: s.id, name: s.name })),
  });
}
