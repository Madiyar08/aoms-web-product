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
        сделано по отчётам сотрудников из Mini App.
      </p>
      <p className="text-[12px] text-st-orange mb-6">
        Пробег и топливо теперь считаются отдельно на странице «Водитель» (данные появятся, как только
        водители начнут вносить одометр/топливо через Mini App). «Выполнено» ниже — реальные данные из
        отчётов сотрудников.
      </p>

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

      <div className="bg-white border border-line rounded-[10px] p-5">
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
                <th className="py-2">Банкоматов всего</th>
                <th className="py-2">Точек (для KPI)</th>
                <th className="py-2">% от KPI</th>
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
                  <td className="py-2.5 font-mono font-semibold">{r.doneStops}</td>
                  <td className={`py-2.5 font-mono ${r.donePct >= 100 ? "text-route" : "text-st-orange"}`}>
                    {r.donePct}%
                  </td>
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
                <td className="py-2.5 font-mono">{totals.doneStops}</td>
                <td className="py-2.5 font-mono">
                  {totals.kpiTarget > 0 ? Math.round((totals.doneStops / totals.kpiTarget) * 100) : 0}%
                </td>
                <td className="py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
