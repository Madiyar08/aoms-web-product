import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { listScheduleByDate } from "@/lib/schedule";
import { getRouteByScheduleId } from "@/lib/routes";
import { listAtms } from "@/lib/atms";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { tashkentDateString } from "@/lib/tz";

/** Шаг 4: список банкоматов конкретного района конкретного экипажа в
 * конкретный день, с отметкой очищен/нет. */
export async function POST(req: NextRequest) {
  const { initData, date, machineId, district } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee || employee.role !== "Проверяющий") {
    return NextResponse.json({ ok: false, error: "Доступно только с ролью «Проверяющий»" }, { status: 403 });
  }
  if (!date || !machineId || !district) {
    return NextResponse.json({ ok: false, error: "Не хватает параметров" }, { status: 400 });
  }

  const entry = listScheduleByDate(String(date)).find((e) => e.machineId === machineId);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Расписание на эту дату/машину не найдено" }, { status: 404 });
  }

  const route = getRouteByScheduleId(entry.id);
  const routeAtmIds = new Set(route?.atmIds || []);
  const allAtms = listAtms();
  const districtAtms = allAtms.filter((a) => routeAtmIds.has(a.id) && a.district === district);

  const reportsThisDay = listCleaningReports().filter(
    (r) => tashkentDateString(new Date(r.clientTime)) === date && r.machineId === machineId
  );
  const reportByAtmId = new Map(reportsThisDay.filter((r) => r.atmId).map((r) => [r.atmId, r]));

  const points = districtAtms
    .map((a) => {
      const report = reportByAtmId.get(a.id);
      return {
        atmId: a.id,
        code: a.code,
        name: a.name,
        address: a.address,
        done: !!report,
        reportId: report?.id || null,
        reportTime: report ? report.clientTime : null,
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done)); // неочищенные — первыми

  return NextResponse.json({ ok: true, points });
}
