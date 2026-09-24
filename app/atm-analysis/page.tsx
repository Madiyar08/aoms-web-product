import { buildAtmAnalysis } from "@/lib/atm-analysis";

export const dynamic = "force-dynamic";

function Card({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-white border border-line rounded-[10px] p-4">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      <div className={`text-xl font-mono ${tone || "text-ink"}`}>{value}</div>
    </div>
  );
}

export default function AtmAnalysisPage() {
  const a = buildAtmAnalysis();
  const neverCleanedExplainedSum =
    a.neverCleaned.excludedByCategory +
    a.neverCleaned.noCoordinates +
    a.neverCleaned.districtNeverScheduled +
    a.neverCleaned.scheduledButNotReached;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Анализ базы банкоматов</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Полный срез текущего состояния базы — строится заново при каждом открытии страницы, не кешируется.
      </p>

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Общая картина</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <Card label="Всего банкоматов" value={a.total} />
        <Card label="Актуальные (не исключены)" value={a.active} tone="text-route" />
        <Card label="Никогда не очищено" value={a.neverCleaned.total} tone="text-st-orange" />
        <Card label="Проблемных (статус)" value={a.problem.byStatusProblem} tone="text-st-red" />
      </div>

      <div className="bg-white border-2 border-st-red/30 rounded-[10px] p-4 mb-6 max-w-xl">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
          Не обслуживается прямо сейчас — по любой причине (готовое число, не нужно складывать вручную)
        </div>
        <div className="text-2xl font-mono text-st-red mb-1">{a.notServiceableNow.total}</div>
        <p className="text-[11.5px] text-neutral-400">
          Никогда не очищено: {a.notServiceableNow.neverCleanedCount} + Проблемных:{" "}
          {a.notServiceableNow.problemStatusCount}
          {a.notServiceableNow.overlapCount > 0 &&
            ` − пересечение (банкомат попадает в оба списка сразу): ${a.notServiceableNow.overlapCount}`}
        </p>
      </div>

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">По категориям</h2>
      <div className="bg-white border border-line rounded-[10px] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
              <th className="py-2 px-3">Категория</th>
              <th className="py-2 px-3">Количество</th>
              <th className="py-2 px-3">Участвует в маршруте</th>
            </tr>
          </thead>
          <tbody>
            {a.byCategory.map((c) => (
              <tr key={c.name} className="border-b border-line last:border-0">
                <td className="py-2 px-3">{c.name}</td>
                <td className="py-2 px-3 font-mono">{c.count}</td>
                <td className="py-2 px-3">
                  {c.excludedFromRouting ? (
                    <span className="text-st-red">нет — исключена</span>
                  ) : (
                    <span className="text-st-green">да</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">По статусу работы</h2>
      <div className="bg-white border border-line rounded-[10px] overflow-hidden mb-6">
        <table className="w-full text-[13px]">
          <tbody>
            {a.byStatus.map((s) => (
              <tr key={s.name} className="border-b border-line last:border-0">
                <td className="py-2 px-3">{s.name}</td>
                <td className="py-2 px-3 font-mono">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">
        Никогда не очищено — почему ({a.neverCleaned.total})
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[13px] font-medium text-ink mb-1">Категория не для маршрута</div>
          <div className="text-lg font-mono text-neutral-500 mb-1">{a.neverCleaned.excludedByCategory}</div>
          <p className="text-[11.5px] text-neutral-400">
            «Внутри здания» / «Местоположение неизвестно» — это нормально, они и не должны очищаться экипажами.
          </p>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[13px] font-medium text-ink mb-1">Нет координат</div>
          <div className="text-lg font-mono text-st-red mb-1">{a.neverCleaned.noCoordinates}</div>
          <p className="text-[11.5px] text-neutral-400">
            Технически невозможно построить маршрут — нужно заполнить координаты вручную или через импорт.
          </p>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[13px] font-medium text-ink mb-1">Район ни разу не назначался</div>
          <div className="text-lg font-mono text-st-orange mb-1">{a.neverCleaned.districtNeverScheduled}</div>
          <p className="text-[11.5px] text-neutral-400">
            Ни один экипаж ещё не работал в этом районе (в «Расписании» его не было ни разу) — не проблема
            банкомата, а того, что до района очередь не дошла.
          </p>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[13px] font-medium text-ink mb-1">Район назначался, но не дошли</div>
          <div className="text-lg font-mono text-st-orange mb-1">{a.neverCleaned.scheduledButNotReached}</div>
          <p className="text-[11.5px] text-neutral-400">
            Экипаж работал в этом районе, но конкретно до этого банкомата очередь ещё не дошла (KPI-ограничение
            оставляет часть точек на следующий раз) — либо стоит проверить вручную, если банкоматов немного.
          </p>
        </div>
      </div>
      {neverCleanedExplainedSum !== a.neverCleaned.total && (
        <p className="text-[11px] text-neutral-400 mb-6">
          Сумма причин ({neverCleanedExplainedSum}) не совпадает с общим числом ({a.neverCleaned.total}) —
          обратитесь к разработчику, это сигнал ошибки в подсчёте.
        </p>
      )}

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2 mt-4">Проблемные</h2>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Card label="Статус «Проблемный»" value={a.problem.byStatusProblem} tone="text-st-red" />
        <Card label="Открытых заявок" value={a.problem.pendingIssues} tone="text-st-orange" />
      </div>
    </div>
  );
}
