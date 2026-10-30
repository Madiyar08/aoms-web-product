import Link from "next/link";
import { listMachines } from "@/lib/machines";
import { listEmployees } from "@/lib/employees";
import { listSchedule } from "@/lib/schedule";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { listAtmIssues } from "@/lib/atm-issues";
import { todayTashkent, formatTashkentDateTime } from "@/lib/tz";
import MonitoringAutoRefresh from "./MonitoringAutoRefresh";
import MonitoringFullscreenButton from "./MonitoringFullscreenButton";

export const dynamic = "force-dynamic";

function elapsedLabel(iso?: string | null): string {
  if (!iso) return "Нет данных";
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "Нет данных";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Только что";
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} ч ${rest} мин. назад` : `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн. назад`;
}

function timeValue(iso?: string | null): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "green" | "blue" | "orange" | "red" | "gray" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function Metric({ icon, label, value, detail, tone = "blue" }: { icon: string; label: string; value: string | number; detail: string; tone?: "blue" | "green" | "purple" | "orange" | "red" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-violet-50 text-violet-700",
    orange: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-lg ${tones[tone]}`}>{icon}</div>
    <p className="text-xs font-medium text-neutral-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    <p className="mt-1 text-[11px] text-neutral-400">{detail}</p>
  </div>;
}

export default async function MonitoringPage() {
  const today = todayTashkent();
  const machines = listMachines();
  const employees = listEmployees();
  const scheduleToday = listSchedule().filter((item) => item.date === today);
  const allReports = listCleaningReports();
  const todayReports = allReports.filter((report) => {
    const date = report.clientTime || report.createdAt;
    return date && !Number.isNaN(new Date(date).getTime()) &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date)) === today;
  });
  const issues = listAtmIssues().filter((issue) => {
    const date = issue.createdAt;
    return Boolean(date && !Number.isNaN(new Date(date).getTime()) &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date)) === today);
  });
  const openIssues = issues.filter((issue) => issue.status !== "Разобран");
  const machineById = new Map(machines.map((machine) => [machine.id, machine]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const reportsByMachine = new Map<string, typeof todayReports>();

  for (const report of todayReports) {
    let machineId = report.machineId;
    if (!machineId) {
      const employeeMachine = machines.find((machine) => machine.employee1Id === report.employeeId || machine.employee2Id === report.employeeId);
      machineId = employeeMachine?.id ?? "";
    }
    if (!machineId) continue;
    const list = reportsByMachine.get(machineId) ?? [];
    list.push(report);
    reportsByMachine.set(machineId, list);
  }

  const crewRows = scheduleToday.map((schedule) => {
    const machine = machineById.get(schedule.machineId);
    const crewReports = reportsByMachine.get(schedule.machineId) ?? [];
    const cleaned = new Set(crewReports.map((report) => report.atmId).filter((id) => Boolean(id && id.trim()))).size;
    const lastReport = [...crewReports].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt))[0];
    const lastActivity = timeValue(lastReport?.createdAt);
    let state = "Не начал";
    let stateTone: "green" | "blue" | "orange" | "red" | "gray" = "gray";
    if (cleaned >= schedule.kpiTarget && schedule.kpiTarget > 0) { state = "План выполнен"; stateTone = "green"; }
    else if (cleaned > 0) { state = "В работе"; stateTone = "blue"; }
    else if (lastActivity > 0 && Date.now() - lastActivity > 90 * 60000) { state = "Нет свежих данных"; stateTone = "orange"; }
    return {
      schedule, machine, cleaned,
      driver: machine ? employeeById.get(machine.employee1Id) : undefined,
      cleaner: machine ? employeeById.get(machine.employee2Id) : undefined,
      lastReport, lastActivity: lastActivity || null,
      state, stateTone,
    };
  });


  const totalPlan = crewRows.reduce((sum, row) => sum + Math.max(0, row.schedule.kpiTarget || 0), 0);
  const totalCleaned = new Set(todayReports.map((report) => report.atmId).filter((id) => Boolean(id && id.trim()))).size;
  const completion = totalPlan > 0 ? Math.round((totalCleaned / totalPlan) * 100) : 0;
  const activeCount = crewRows.filter((row) => row.cleaned > 0 && row.cleaned < row.schedule.kpiTarget).length;
  const latestReports = [...todayReports].sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt)).slice(0, 10);
  const districtNames = [...new Set(scheduleToday.flatMap((item) => item.districts))].sort();
  const validReportTimes = [...allReports].map((report) => timeValue(report.createdAt)).filter(Boolean).sort((a, b) => b - a);
  const intervals = validReportTimes.slice(0, 30).slice(0, -1).map((value, index) => value - validReportTimes[index + 1]).filter((value) => value > 0 && value < 24 * 60 * 60000);
  const averageIntervalMinutes = intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length / 60000) : null;

  return <div id="monitoring-fullscreen" className="monitoring-fullscreen mx-auto max-w-[1800px]">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-neutral-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> AOMS / Оперативный контроль</div>
        <h1 className="font-display text-3xl font-medium text-ink">Мониторинг</h1>
        <p className="mt-1 text-sm text-neutral-500">Работа экипажей и отчёты за сегодня · {today}</p>
      </div>
      <div className="flex items-center gap-2">
        <MonitoringAutoRefresh />
        <MonitoringFullscreenButton />
        <span className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-neutral-600">Ташкент · UTC+5</span>
        <Link href="/monitoring" className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:opacity-90">↻ Обновить</Link>
      </div>
    </header>

    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric icon="🚚" label="Экипажи по расписанию" value={crewRows.length} detail={`${activeCount} с отчётами в работе`} />
      <Metric icon="▣" label="План на сегодня" value={totalPlan} detail="Точек KPI по расписанию" tone="purple" />
      <Metric icon="✓" label="Отчёты сегодня" value={totalCleaned} detail={`${completion}% от суммарного KPI`} tone="green" />
      <Metric icon="◷" label="Средний интервал отчётов" value={averageIntervalMinutes === null ? "—" : `${averageIntervalMinutes} мин.`} detail="Между последними 30 отчётами" tone="orange" />
      <Metric icon="⚠" label="Открытые проблемы" value={openIssues.length} detail="Зарегистрированы и не разобраны" tone={openIssues.length ? "red" : "green"} />
    </section>

    <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div><h2 className="font-semibold text-ink">Экипажи и последняя активность</h2><p className="mt-1 text-xs text-neutral-400">Последнее фактическое сообщение экипажа</p></div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{crewRows.length} экипажей</span>
        </div>
        {crewRows.length === 0 ? <div className="p-10 text-center text-sm text-neutral-400">На сегодня нет экипажей по расписанию.</div> : <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-neutral-500"><tr>
              <th className="px-4 py-3">Машина</th><th className="px-4 py-3">Экипаж</th><th className="px-4 py-3">Район</th><th className="px-4 py-3">План</th><th className="px-4 py-3">Уникальные ID</th><th className="px-4 py-3">Выполнение</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Последний отчёт</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {crewRows.map((row) => {
                const pct = row.schedule.kpiTarget > 0 ? Math.min(100, Math.round(row.cleaned / row.schedule.kpiTarget * 100)) : 0;
                return <tr key={row.schedule.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-4"><span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-800">{row.machine?.number || "—"}</span></td>
                  <td className="px-4 py-4"><div className="font-medium text-ink">{row.driver?.fullName || "Водитель не назначен"}</div><div className="mt-1 text-neutral-500">{row.cleaner?.fullName || "Уборщик не назначен"}</div></td>
                  <td className="max-w-[160px] px-4 py-4 text-neutral-600">{row.schedule.districts.join(", ") || "—"}</td>
                  <td className="px-4 py-4 font-mono">{row.schedule.kpiTarget}</td><td className="px-4 py-4 font-mono font-semibold">{row.cleaned}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} /></div><span className="font-mono text-neutral-600">{pct}%</span></div></td>
                  <td className="px-4 py-4"><Badge tone={row.stateTone}>{row.state}</Badge></td>
                  <td className="px-4 py-4"><div className="font-medium text-ink">{elapsedLabel(row.lastReport?.createdAt)}</div><div className="mt-1 text-[10px] text-neutral-400">{row.lastReport?.createdAt ? formatTashkentDateTime(row.lastReport.createdAt) : "Нет отчётов"}</div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
        <div className="flex flex-wrap gap-4 border-t border-line px-5 py-3 text-[10px] text-neutral-400"><span>● В работе — есть отчёты, план не выполнен</span><span>● Нет свежих данных — давно нет активности</span><span>Учитываются уникальные ID банкоматов за сегодня, включая проблемные точки</span></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line p-5"><div><h2 className="font-semibold text-ink">Последние 10 отчётов</h2><p className="mt-1 text-xs text-neutral-400">Новые отчёты отображаются сверху</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{latestReports.length}</span></div>
        {latestReports.length === 0 ? <p className="p-6 text-sm text-neutral-400">Отчётов пока нет.</p> : <div className="divide-y divide-line">
          {latestReports.map((report) => {
            const machine = machineById.get(report.machineId);
            const hasFlags = Boolean(report.codeMismatch || (report.antifraudFlags?.length ?? 0) > 0);
            const reportStatus = hasFlags ? "Проверить" : "Принят";
            const tone = hasFlags ? "orange" : "green";
            return <div key={report.id} className="p-4 transition hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-ink">{report.employeeName || "Сотрудник"}</p><p className="mt-1 text-[11px] text-neutral-500">Машина {machine?.number || "—"} · ID {report.enteredCode || report.atmCode || "не указан"}</p></div><span className="shrink-0 text-[10px] text-neutral-400">{elapsedLabel(report.createdAt)}</span></div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Badge tone={tone}>{reportStatus}</Badge><span className="text-[10px] text-neutral-400">{report.createdAt ? formatTashkentDateTime(report.createdAt) : "Время неизвестно"}</span></div>
              {hasFlags && <p className="mt-2 text-[10px] text-amber-700">{report.codeMismatch ? "ID не совпадает. " : ""}{report.antifraudFlags?.join(" · ")}</p>}
            </div>;
          })}
        </div>}
        <div className="border-t border-line p-4"><Link href="/reports" className="block text-center text-xs font-semibold text-route hover:underline">Открыть отчёты →</Link></div>
      </section>
    </div>

    <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-ink">Выполнение по районам</h2><p className="mt-1 text-xs text-neutral-400">По расписанию и отчётам за сегодня</p></div><Link href="/reports" className="text-xs text-route hover:underline">Детали →</Link></div>
        {districtNames.length === 0 ? <p className="mt-5 text-sm text-neutral-400">Расписание на сегодня не найдено.</p> : <div className="mt-5 space-y-4">{districtNames.map((district) => {
          const rows = crewRows.filter((row) => row.schedule.districts.includes(district));
          const plan = rows.reduce((sum, row) => sum + Math.max(0, row.schedule.kpiTarget), 0);
          const done = rows.reduce((sum, row) => sum + row.cleaned, 0);
          const pct = plan > 0 ? Math.round(done / plan * 100) : 0;
          return <div key={district}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="text-neutral-600">{district}</span><span className="font-mono font-semibold text-ink">{done} / {plan} · {pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} /></div></div>;
        })}</div>}
      </div>
      <div className="rounded-xl border border-line bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-ink">Требуют внимания</h2><p className="mt-1 text-xs text-neutral-400">Открытые проблемы и неактивные экипажи</p></div><Badge tone={openIssues.length ? "red" : "green"}>{openIssues.length} проблем</Badge></div>
        <div className="mt-4 space-y-3">{crewRows.filter((row) => row.state === "Нет свежих данных" || row.state === "Не начал").slice(0, 5).map((row) => <div key={row.schedule.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-xs font-semibold text-ink">Машина {row.machine?.number || "—"}</p><p className="mt-1 text-[11px] text-neutral-500">{row.schedule.districts.join(", ")} · {row.driver?.fullName || "Водитель не назначен"}</p></div><Badge tone={row.state === "Нет свежих данных" ? "orange" : "gray"}>{row.state}</Badge></div>)}
          {crewRows.every((row) => row.state !== "Нет свежих данных" && row.state !== "Не начал") && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">По активности экипажей предупреждений нет.</p>}
          <Link href="/atm-issues" className="flex items-center justify-between rounded-lg border border-line p-3 text-xs hover:bg-slate-50"><span>Открытые проблемы банкоматов</span><strong>{openIssues.length} →</strong></Link>
        </div>
      </div>
    </section>
  </div>;
}
