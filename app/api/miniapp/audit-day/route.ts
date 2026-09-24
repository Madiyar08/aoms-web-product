import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { listScheduleByDate } from "@/lib/schedule";
import { getRouteByScheduleId } from "@/lib/routes";
import { getMachineById } from "@/lib/machines";
import { getEmployeeById } from "@/lib/employees";
import { listAtms } from "@/lib/atms";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { tashkentDateString } from "@/lib/tz";

/**
 * Шаг 1-3 раздела "Проверка": для выбранной даты — список экипажей,
 * работавших в этот день, и для каждого — районы с охватом (задано /
 * сделано / %). Доступно только роли "Проверяющий".
 */
export async function POST(req: NextRequest) {
  const { initData, date } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee || employee.role !== "Проверяющий") {
    return NextResponse.json({ ok: false, error: "Доступно только с ролью «Проверяющий»" }, { status: 403 });
  }
  if (!date) {
    return NextResponse.json({ ok: false, error: "Не указана дата" }, { status: 400 });
  }

  const entries = listScheduleByDate(String(date));
  const allAtms = listAtms();
  const atmById = new Map(allAtms.map((a) => [a.id, a]));
  const reportsThisDay = listCleaningReports().filter((r) => tashkentDateString(new Date(r.clientTime)) === date);

  const crews = entries.map((entry) => {
    const machine = getMachineById(entry.machineId);
    const crewNames = machine
      ? [machine.employee1Id, machine.employee2Id]
          .filter(Boolean)
          .map((id) => getEmployeeById(id)?.fullName)
          .filter(Boolean)
          .join(" + ")
      : "";

    const route = getRouteByScheduleId(entry.id);
    const routeAtmIds = new Set(route?.atmIds || []);
    // отчёты именно этого экипажа в этот день (по зафиксированному
    // machineId в отчёте — тот же надёжный способ, что и в reports.ts)
    const crewReports = reportsThisDay.filter((r) => r.machineId === entry.machineId);
    const doneAtmIds = new Set(crewReports.map((r) => r.atmId).filter(Boolean));

    const districts = entry.districts.map((districtName) => {
      // банкоматы этого района, попавшие в построенный маршрут этого дня
      const districtAtmIds = Array.from(routeAtmIds).filter((id) => atmById.get(id)?.district === districtName);
      const assigned = districtAtmIds.length;
      const done = districtAtmIds.filter((id) => doneAtmIds.has(id)).length;
      return {
        district: districtName,
        assigned,
        done,
        pct: assigned > 0 ? Math.round((done / assigned) * 100) : 0,
      };
    });

    return {
      scheduleId: entry.id,
      machineId: entry.machineId,
      machineNumber: machine?.number || "?",
      crewNames,
      districts,
      routeBuilt: !!route,
    };
  });

  return NextResponse.json({ ok: true, crews });
}
