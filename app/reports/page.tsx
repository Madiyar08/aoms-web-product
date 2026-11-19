import { buildReportRows, buildReportTotals } from "@/lib/reports";
import { listMachines } from "@/lib/machines";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; machineId?: string };
}) {
  const machines = listMachines();
  const rows = buildReportRows(searchParams);
  const totals = buildReportTotals(rows);

  const exportUrl = `/api/reports/export?${new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  ).toString()}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Отчёты</h1>
      <p className="text-sm text-neutral-500 mb-2">
        План по расписанию и маршрутам — дата, машина, районы, KPI, банкоматов в маршруте, сколько реально
        сделано по утверждённым отчётам сотрудников из Mini App.
      </p>
      <p className="text-[12px] text-st-orange mb-6">
        Пробег и топливо теперь считаются отдельно на странице «Водитель» (данные появятся, как только
        водители начнут вносить одометр/топливо через Mini App). «Выполнено» ниже — реальные данные из
        отчётов сотрудников.
      </p>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-neutral-500">Антифрод: нужна проверка</p><p className="mt-2 text-2xl font-semibold text-amber-700">{totals.reviewCount}</p><p className="mt-1 text-[11px] text-neutral-400">Отчёты с флагом ручной проверки</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-neutral-500">GPS низкой точности</p><p className="mt-2 text-2xl font-semibold text-orange-700">{totals.lowGpsCount}</p><p className="mt-1 text-[11px] text-neutral-400">Нужна оценка качества координат</p></div>
        <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs text-neutral-500">GPS недоступен</p><p className="mt-2 text-2xl font-semibold text-neutral-700">{totals.gpsUnavailableCount}</p><p className="mt-1 text-[11px] text-neutral-400">В отчёте нет подтверждённых координат</p></div>
      </section>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Антифрод и GPS показывают качество поступивших отчётов. В KPI включаются только отчёты, утверждённые руководителем. Новые и отклонённые отчёты показываются отдельно.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3"><a href="/cleaning-review" className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">Очередь проверки отчётов</a><span className="text-xs text-neutral-500">Ожидают решения: {totals.pendingReports} · Отклонено: {totals.rejectedReports}</span></div>
      <form className="flex flex-wrap items-end gap-3 mb-5" method="get">
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Дата с</span>
          <input type="date" name="dateFrom" defaultValue={searchParams.dateFrom} className="input" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Дата по</span>
          <input type="date" name="dateTo" defaultValue={searchParams.dateTo} className="input" />
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Машина</span>
          <select name="machineId" defaultValue={searchParams.machineId} className="input">
            <option value="">Все</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>Машина {m.number}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white h-[36px]">
          Применить
        </button>
        <a
          href={exportUrl}
          className="text-xs font-semibold bg-brass text-white rounded-md px-3 py-2 h-[36px] flex items-center"
        >
          Экспорт в Excel
        </a>
      </form>

      <div className="bg-white border border-line rounded-[10px] p-5 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400">Нет данных за выбранный период.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
                <th className="py-2">Дата</th>
                <th className="py-2">Машина</th>
                <th className="py-2">Районы</th>
                <th className="py-2">KPI (точек)</th>
                <th className="py-2">В маршруте (план)</th>
                <th className="py-2">Выполнено в маршруте</th>
                <th className="py-2">Выполнено вне маршрута</th>
                <th className="py-2">Утверждено ATM</th>
                <th className="py-2">Ожидают</th>
                <th className="py-2">Отклонено</th>
                <th className="py-2">Точек (для KPI)</th>
                <th className="py-2">% от KPI</th>
                <th className="py-2">На проверку</th>
                <th className="py-2">GPS низкой точности</th>
                <th className="py-2">GPS нет</th>
                <th className="py-2">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-b border-line last:border-0">
                  <td className="py-2.5">{r.date}</td>
                  <td className="py-2.5">{r.machineNumber}</td>
                  <td className="py-2.5">{r.districts}</td>
                  <td className="py-2.5 font-mono">{r.kpiTarget}</td>
                  <td className="py-2.5 font-mono">{r.plannedAtms}</td>
                  <td className="py-2.5 font-mono">{r.doneInRoute}</td>
                  <td className="py-2.5 font-mono text-st-orange">{r.doneOutOfRoute}</td>
                  <td className="py-2.5 font-mono text-neutral-400">{r.doneTotal}</td>
                  <td className="py-2.5 font-mono text-amber-700">{r.pendingReports}</td>
                  <td className="py-2.5 font-mono text-rose-700">{r.rejectedReports}</td>
                  <td className="py-2.5 font-mono font-semibold">{r.doneStops}</td>
                  <td className={`py-2.5 font-mono ${r.donePct >= 100 ? "text-route" : "text-st-orange"}`}>
                    {r.donePct}%
                  </td>
                  <td className="py-2.5 font-mono text-amber-700">{r.reviewCount}</td>
                  <td className="py-2.5 font-mono text-orange-700">{r.lowGpsCount}</td>
                  <td className="py-2.5 font-mono">{r.gpsUnavailableCount}</td>
                  <td className="py-2.5">{r.routeStatus}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink font-semibold bg-neutral-50">
                <td className="py-2.5" colSpan={3}>
                  Итого
                </td>
                <td className="py-2.5 font-mono">{totals.kpiTarget}</td>
                <td className="py-2.5 font-mono">{totals.plannedAtms}</td>
                <td className="py-2.5 font-mono">{totals.doneInRoute}</td>
                <td className="py-2.5 font-mono text-st-orange">{totals.doneOutOfRoute}</td>
                <td className="py-2.5 font-mono text-neutral-400">{totals.doneTotal}</td>
                <td className="py-2.5 font-mono text-amber-700">{totals.pendingReports}</td>
                <td className="py-2.5 font-mono text-rose-700">{totals.rejectedReports}</td>
                <td className="py-2.5 font-mono">{totals.doneStops}</td>
                <td className="py-2.5 font-mono">
                  {totals.kpiTarget > 0 ? Math.round((totals.doneStops / totals.kpiTarget) * 100) : 0}%
                </td>
                <td className="py-2.5 font-mono text-amber-700">{totals.reviewCount}</td>
                <td className="py-2.5 font-mono text-orange-700">{totals.lowGpsCount}</td>
                <td className="py-2.5 font-mono">{totals.gpsUnavailableCount}</td>
                <td className="py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
