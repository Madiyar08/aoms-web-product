import { buildAtmAnalysis, buildDistrictOverview } from "@/lib/atm-analysis";

export const dynamic = "force-dynamic";

function Card({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-white border border-line rounded-[10px] p-4">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      <div className={`text-xl font-mono ${tone || "text-ink"}`}>{value}</div>
    </div>
  );
}

type DistrictGroup = { district: string; atms: { code: string; name: string; address: string }[] };

/** Раскрываемый список районов, а внутри каждого — раскрываемый список
 * самих банкоматов. Отвечает на "а какие именно районы и банкоматы?" —
 * не нужно скачивать базу и считать вручную ради этого вопроса. */
function DistrictBreakdown({ groups }: { groups: DistrictGroup[] }) {
  if (!groups || groups.length === 0) return null;
  return (
    <details>
      <summary className="text-[11px] text-route cursor-pointer">Показать районы и банкоматы →</summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {groups.map((g) => (
          <details key={g.district} className="bg-neutral-50 rounded-lg px-2.5 py-1.5">
            <summary className="text-[11.5px] cursor-pointer">
              {g.district} — <span className="font-mono">{g.atms.length}</span>
            </summary>
            <div className="mt-1.5 flex flex-col gap-1 pl-1">
              {g.atms.map((atm, i) => (
                <div key={i} className="text-[11px] text-neutral-500">
                  <span className="font-mono">{atm.code}</span> — {atm.name}
                  {atm.address && <span className="text-neutral-400"> · {atm.address}</span>}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}

export default function AtmAnalysisPage() {
  const a = buildAtmAnalysis();
  const districtOverview = buildDistrictOverview();
  // Колонки категорий — только те, что реально встречаются хоть в одном
  // районе, отсортированы по общей встречаемости (самые частые — слева).
  const categoryTotals = new Map<string, number>();
  for (const row of districtOverview) {
    for (const c of row.byCategory) {
      categoryTotals.set(c.name, (categoryTotals.get(c.name) || 0) + c.count);
    }
  }
  const districtCategoryNames = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
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
          <p className="text-[11.5px] text-neutral-400 mb-2">
            Ни один экипаж ещё не работал в этом районе (в «Расписании» его не было ни разу) — не проблема
            банкомата, а того, что до района очередь не дошла.
          </p>
          <DistrictBreakdown groups={a.neverCleaned.districtNeverScheduledByDistrict} />
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[13px] font-medium text-ink mb-1">Район назначался, но не дошли</div>
          <div className="text-lg font-mono text-st-orange mb-1">{a.neverCleaned.scheduledButNotReached}</div>
          <p className="text-[11.5px] text-neutral-400 mb-2">
            Экипаж работал в этом районе, но конкретно до этого банкомата очередь ещё не дошла (KPI-ограничение
            оставляет часть точек на следующий раз) — либо стоит проверить вручную, если банкоматов немного.
          </p>
          <DistrictBreakdown groups={a.neverCleaned.scheduledButNotReachedByDistrict} />
        </div>
      </div>
      {neverCleanedExplainedSum !== a.neverCleaned.total && (
        <p className="text-[11px] text-neutral-400 mb-6">
          Сумма причин ({neverCleanedExplainedSum}) не совпадает с общим числом ({a.neverCleaned.total}) —
          обратитесь к разработчику, это сигнал ошибки в подсчёте.
        </p>
      )}

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2 mt-4">
        По районам — полная картина
      </h2>
      <p className="text-[11.5px] text-neutral-400 mb-2 max-w-2xl">
        Категории (какие реально встречаются в районе), сколько может попасть в маршрут прямо сейчас, сколько
        исключено и почему, и сколько из допущенных экипаж уже реально очистил — видно, где именно затор.
      </p>
      <div className="bg-white border border-line rounded-[10px] overflow-x-auto mb-6">
        <table className="w-full text-[12px] whitespace-nowrap">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-neutral-500 border-b border-line">
              <th className="py-2 px-3">Район</th>
              <th className="py-2 px-3">Всего</th>
              {districtCategoryNames.map((name) => (
                <th key={name} className="py-2 px-3">
                  {name}
                </th>
              ))}
              <th className="py-2 px-3 bg-route-bg">В маршрут может попасть</th>
              <th className="py-2 px-3">Исключено: категория</th>
              <th className="py-2 px-3">Исключено: статус</th>
              <th className="py-2 px-3">Нет координат</th>
              <th className="py-2 px-3 text-st-green">Уже очищено хоть раз</th>
              <th className="py-2 px-3 text-st-orange">Ещё ни разу (работа осталась)</th>
            </tr>
          </thead>
          <tbody>
            {districtOverview.map((row) => (
              <tr key={row.district} className="border-b border-line last:border-0">
                <td className="py-2 px-3 font-medium">{row.district}</td>
                <td className="py-2 px-3 font-mono">{row.total}</td>
                {districtCategoryNames.map((name) => {
                  const found = row.byCategory.find((c) => c.name === name);
                  return (
                    <td key={name} className="py-2 px-3 font-mono text-neutral-500">
                      {found ? found.count : "—"}
                    </td>
                  );
                })}
                <td className="py-2 px-3 font-mono bg-route-bg font-semibold">{row.eligibleForRouting}</td>
                <td className="py-2 px-3 font-mono text-neutral-400">{row.excludedByCategory || "—"}</td>
                <td className="py-2 px-3 font-mono text-neutral-400">{row.excludedByStatus || "—"}</td>
                <td className="py-2 px-3 font-mono text-neutral-400">{row.noCoordinates || "—"}</td>
                <td className="py-2 px-3 font-mono text-st-green">{row.cleanedAtLeastOnce}</td>
                <td className="py-2 px-3 font-mono text-st-orange font-semibold">{row.neverCleanedEligible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-[13px] font-semibold text-neutral-500 uppercase tracking-wide mb-2 mt-4">Проблемные</h2>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Card label="Статус «Проблемный»" value={a.problem.byStatusProblem} tone="text-st-red" />
        <Card label="Открытых заявок" value={a.problem.pendingIssues} tone="text-st-orange" />
      </div>
    </div>
  );
}
