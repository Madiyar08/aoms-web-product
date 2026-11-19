import { listSchedule } from "./schedule";
import { listRoutes } from "./routes";
import { listMachines } from "./machines";
import { listCleaningReports } from "./cleaning-reports";
import { getAtmById } from "./atms";
import { countDistinctPoints } from "./coordinate-analysis";
import { tashkentDateString } from "./tz";
import { summarizeReportQuality } from "./report-quality";

/**
 * Отчёт строится из «Расписания» + «Маршрутов» (ПЛАН на день) и реальных
 * отчётов сотрудников через Mini App (ФАКТ).
 *
 * ВАЖНО (исправление бага): раньше "Выполнено" считало только отчёты по
 * банкоматам ИЗ построенного маршрута — отчёты "вне маршрута" (сотрудник
 * ввёл ID банкомата, которого не было в плане на сегодня, но того же
 * района) вообще не попадали в статистику, хотя работа была реально
 * сделана. Теперь считаем ОБА вида отдельными колонками и общий итог:
 * doneInRoute — по плану, doneOutOfRoute — вне плана (тот же экипаж,
 * тот же день), doneTotal — сумма обоих.
 *
 * ВАЖНО (KPI по точкам, не по банкоматам): руководитель уточнил, что
 * норма "50 в день" — это 50 ТОЧЕК (остановок экипажа), а не 50
 * отдельных банкоматов. На многих точках стоит 2-4 банкомата рядом —
 * без этой поправки KPI считался бы завышенно строгим (за одну реальную
 * остановку экипаж получал бы 2-4 "банкомата" в счётчике, но норма
 * измерялась бы неправильной единицей). doneStops считает РЕАЛЬНЫЕ
 * точки (та же кластеризация ближе 30м, что и при построении маршрута),
 * и именно он используется для donePct/KPI — doneTotal остаётся в
 * таблице отдельно, для прозрачности (сколько банкоматов физически
 * протёрли).
 */
export interface ReportRow {
  date: string;
  machineNumber: string;
  districts: string;
  kpiTarget: number;
  plannedAtms: number;
  doneInRoute: number;
  doneOutOfRoute: number;
  doneTotal: number;
  pendingReports: number;
  rejectedReports: number;
  doneStops: number;
  donePct: number;
  excludedCount: number;
  reviewCount: number;
  lowGpsCount: number;
  gpsUnavailableCount: number;
  routeStatus: string;
}

export interface ReportTotals {
  plannedAtms: number;
  doneInRoute: number;
  doneOutOfRoute: number;
  doneTotal: number;
  pendingReports: number;
  rejectedReports: number;
  doneStops: number;
  kpiTarget: number;
  reviewCount: number;
  lowGpsCount: number;
  gpsUnavailableCount: number;
}

export function buildReportRows(filters: { dateFrom?: string; dateTo?: string; machineId?: string }): ReportRow[] {
  const machines = listMachines();
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const routes = listRoutes();
  const routeByScheduleId = new Map(routes.map((r) => [r.scheduleId, r]));
  const reports = listCleaningReports();

  let entries = listSchedule();
  if (filters.dateFrom) entries = entries.filter((e) => e.date >= filters.dateFrom!);
  if (filters.dateTo) entries = entries.filter((e) => e.date <= filters.dateTo!);
  if (filters.machineId) entries = entries.filter((e) => e.machineId === filters.machineId);

  return entries
    .map((e) => {
      const route = routeByScheduleId.get(e.id);
      const routeAtmIds = new Set(route?.atmIds ?? []);
      const machine = machineById.get(e.machineId);

      // ИСПРАВЛЕНИЕ СВЯЗКИ: раньше отчёт относили к машине через "состав
      // экипажа этой машины СЕЙЧАС" (employee1Id/employee2Id на текущий
      // момент) — то есть если сотрудника позже пересадили на другую
      // машину, его старые отчёты "переезжали" вслед за ним при каждом
      // построении отчёта, задним числом меняя историю. Теперь у отчёта
      // есть зафиксированный machineId (записан в момент отправки) —
      // сопоставляем по нему напрямую, это факт на тот день, неизменный.
      //
      // Отчёты ДО этого исправления (machineId ещё не заполнялся) не
      // потеряны — для них откатываемся на старый способ через
      // employeeId, иначе вся история до сегодня обнулится.
      const crewIds = new Set([machine?.employee1Id, machine?.employee2Id].filter(Boolean));
      const todaysCrewReports = reports.filter((r) => {
        if (tashkentDateString(new Date(r.clientTime)) !== e.date) return false;
        if (r.machineId) return r.machineId === e.machineId;
        return crewIds.has(r.employeeId); // legacy-отчёты без machineId
      });

      // ВАЖНО (исправление недосчёта): считаем ЧИСЛО ОТЧЁТОВ, а не число
      // уникальных atmId. Раньше здесь стоял Set по atmId — это ломало
      // подсчёт двумя способами: (1) банкомат, реально очищенный дважды
      // за день, считался один раз; (2) что серьёзнее — у отчётов по
      // банкоматам, которых нет в базе (сотрудник вводит ID вручную, банкомат
      // не находится), atmId = "" у ВСЕХ таких отчётов сразу, и Set
      // схлопывал их все в одну запись. Именно это давало расхождение с
      // ручным подсчётом по сообщениям в Telegram-группе (там считают
      // каждое сообщение/фото, а не уникальный банкомат).
      const approvedReports = todaysCrewReports.filter((r) => r.approvalStatus === "approved");
      const pendingReports = todaysCrewReports.filter((r) => !r.approvalStatus || r.approvalStatus === "pending").length;
      const rejectedReports = todaysCrewReports.filter((r) => r.approvalStatus === "rejected").length;
      const doneInRoute = approvedReports.filter((r) => routeAtmIds.has(r.atmId)).length;
      const doneOutOfRoute = approvedReports.filter((r) => !routeAtmIds.has(r.atmId)).length;

      const plannedAtms = route?.atmIds.length ?? 0;
      const doneTotal = doneInRoute + doneOutOfRoute;

      // Точки (остановки) — реально очищенные банкоматы сегодня, схлопнутые
      // по близости (≤30м), как и при построении маршрута. Банкоматы, для
      // которых нет записи в базе (atmId пуст — старые отчёты "вне базы"),
      // считаются каждый отдельной точкой — их не с чем группировать.
      const cleanedAtmIds = new Set(approvedReports.map((r) => r.atmId).filter(Boolean));
      const cleanedAtmObjects = Array.from(cleanedAtmIds)
        .map((id) => getAtmById(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const reportsWithoutAtm = approvedReports.filter((r) => !r.atmId).length;
      const doneStops = countDistinctPoints(cleanedAtmObjects, 30) + reportsWithoutAtm;

      const quality = summarizeReportQuality(todaysCrewReports);

      return {
        date: e.date,
        machineNumber: machine?.number ?? "—",
        districts: e.districts.join(", "),
        kpiTarget: e.kpiTarget,
        plannedAtms,
        doneInRoute,
        doneOutOfRoute,
        doneTotal,
        pendingReports,
        rejectedReports,
        doneStops,
        // % считаем от KPI по ТОЧКАМ, не по числу банкоматов — норма
        // "50 в день" это 50 точек, а не 50 отдельных устройств.
        donePct: e.kpiTarget > 0 ? Math.round((doneStops / e.kpiTarget) * 100) : 0,
        excludedCount: route?.excludedCount ?? 0,
        // SUBMITTED/APPROVED workflow is not present in the current cleaning report model.
        // Surface antifraud/GPS review signals separately; never label these as approved KPI.
        reviewCount: quality.reviewCount,
        lowGpsCount: quality.lowGpsCount,
        gpsUnavailableCount: quality.gpsUnavailableCount,
        routeStatus: route?.status ?? "Маршрут не построен",
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Суммарные показатели по всем строкам — для блока "Итого". */
export function buildReportTotals(rows: ReportRow[]): ReportTotals {
  return rows.reduce(
    (acc, r) => ({
      plannedAtms: acc.plannedAtms + r.plannedAtms,
      doneInRoute: acc.doneInRoute + r.doneInRoute,
      doneOutOfRoute: acc.doneOutOfRoute + r.doneOutOfRoute,
      doneTotal: acc.doneTotal + r.doneTotal,
      pendingReports: acc.pendingReports + r.pendingReports,
      rejectedReports: acc.rejectedReports + r.rejectedReports,
      doneStops: acc.doneStops + r.doneStops,
      kpiTarget: acc.kpiTarget + r.kpiTarget,
      reviewCount: acc.reviewCount + r.reviewCount,
      lowGpsCount: acc.lowGpsCount + r.lowGpsCount,
      gpsUnavailableCount: acc.gpsUnavailableCount + r.gpsUnavailableCount,
    }),
    { plannedAtms: 0, doneInRoute: 0, doneOutOfRoute: 0, doneTotal: 0, pendingReports: 0, rejectedReports: 0, doneStops: 0, kpiTarget: 0, reviewCount: 0, lowGpsCount: 0, gpsUnavailableCount: 0 }
  );
}
