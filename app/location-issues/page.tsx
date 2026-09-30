import Link from "next/link";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { getAtmById } from "@/lib/atms";
import { formatTashkentDateTime } from "@/lib/tz";

export const dynamic = "force-dynamic";

/**
 * Раздел для сигналов "адрес/координаты неверны", которые сотрудники
 * отмечают на месте. Раньше это подтверждение ни на что не влияло —
 * теперь каждый отрицательный ответ сбрасывает флаг подтверждения на
 * банкомате (см. submit-cleaning) И появляется здесь одним списком,
 * чтобы руководитель мог разобрать и поправить данные.
 */
export default async function LocationIssuesPage() {
  const reports = listCleaningReports()
    .filter((r) => r.addressCorrect === false || r.coordsCorrect === false)
    .sort((a, b) => (a.clientTime < b.clientTime ? 1 : -1));

  // Группируем по банкомату — если несколько сотрудников независимо
  // жаловались на один и тот же банкомат, это сильный сигнал, что данные
  // реально неверны (не единичная ошибка на месте).
  const byAtm = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = r.atmId || r.atmCode || "unknown";
    if (!byAtm.has(key)) byAtm.set(key, []);
    byAtm.get(key)!.push(r);
  }
  const groups = Array.from(byAtm.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Требует уточнения адреса/координат</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-3xl">
        Банкоматы, у которых сотрудники на месте отметили «адрес неверный» или «координаты неверные».
        Чем больше независимых отметок — тем вероятнее, что данные в базе действительно нужно поправить.
      </p>

      {groups.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Сигналов нет — все подтверждения положительные.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([key, group]) => {
            const atm = group[0].atmId ? getAtmById(group[0].atmId) : null;
            return (
              <div key={key} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm">
                      {group[0].atmCode || "без ID"} {atm ? `— ${atm.name}` : ""}
                    </span>
                    <span className="ml-2 text-[11px] bg-st-red/10 text-st-red rounded-full px-2 py-0.5">
                      {group.length} {group.length === 1 ? "отметка" : "отметок"}
                    </span>
                  </div>
                  {atm && (
                    <Link href={`/atms/${atm.id}`} className="text-[12px] text-route hover:underline">
                      Открыть карточку →
                    </Link>
                  )}
                </div>
                {atm && <div className="text-[12px] text-neutral-500 mb-2">{atm.address}</div>}
                <div className="flex flex-col gap-1.5">
                  {group.slice(0, 5).map((r) => (
                    <div key={r.id} className="text-[12px] bg-neutral-50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between text-neutral-500">
                        <span>{r.employeeName}</span>
                        <span>{formatTashkentDateTime(r.clientTime)}</span>
                      </div>
                      <div>
                        {r.addressCorrect === false && <span className="text-st-red mr-2">Адрес неверный</span>}
                        {r.coordsCorrect === false && <span className="text-st-red">Координаты неверные</span>}
                      </div>
                      {r.locationComment && <div className="text-neutral-600 mt-1">«{r.locationComment}»</div>}
                    </div>
                  ))}
                  {group.length > 5 && (
                    <div className="text-[11px] text-neutral-400">и ещё {group.length - 5}…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
