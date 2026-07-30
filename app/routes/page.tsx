import { listSchedule } from "@/lib/schedule";
import { listMachines } from "@/lib/machines";
import { listRoutes, getRouteByScheduleId, isRouteStale } from "@/lib/routes";
import { isTelegramConfigured } from "@/lib/telegram";
import { todayTashkent } from "@/lib/tz";
import { buildRouteAction, sendRouteAction } from "./actions";

export const dynamic = "force-dynamic";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function RoutesPage({ searchParams }: { searchParams: { from?: string; all?: string } }) {
  const today = todayTashkent();
  const defaultFrom = addDays(today, -14);
  const showAll = searchParams.all === "1";
  const from = searchParams.from || defaultFrom;

  // ВАЖНО (производительность): раньше здесь показывалась ВСЯ история
  // маршрутов с самого начала использования системы, и для КАЖДОГО
  // маршрута на странице отдельно проверялось "не устарел ли" —
  // проверка сканирует всю базу банкоматов. С ростом истории маршрутов
  // страница становилась медленнее с каждым днём. По умолчанию — только
  // последние 14 дней (для этого практически всегда и открывают
  // страницу); полная история доступна по ссылке ниже, без проверки
  // устаревания (она нужна только для актуальных, недавних маршрутов).
  const allEntries = [...listSchedule()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const entries = showAll ? allEntries : allEntries.filter((e) => e.date >= from);
  const machines = listMachines();
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const routes = listRoutes();
  const telegramReady = isTelegramConfigured();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Маршруты</h1>
      {!showAll && allEntries.length > entries.length && (
        <p className="text-[12.5px] text-neutral-400 mb-1">
          Показаны последние 14 дней ({entries.length} из {allEntries.length}) — так страница открывается быстрее.{" "}
          <a href="?all=1" className="underline text-route">
            Показать всю историю →
          </a>
        </p>
      )}
      <p className="text-sm text-neutral-500 mb-2">
        Строится из районов, назначенных в «Расписании». Банкоматы категории «Внутри здания»
        и неподтверждённых статусов исключаются автоматически.
      </p>
      {!telegramReady && (
        <p className="text-[12px] text-st-orange mb-4">
          Telegram не настроен (нет TELEGRAM_BOT_TOKEN в .env) — отправка экипажу зафиксирует
          попытку, но сообщение реально не уйдёт, пока не добавите токен. См. README.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Сначала назначьте машину и районы на странице «Расписание».
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const route = getRouteByScheduleId(entry.id) ?? routes.find((r) => r.scheduleId === entry.id);
            const machine = machineById.get(entry.machineId);
            return (
              <div key={entry.id} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-ink text-sm">
                      {entry.date} · Машина {machine?.number ?? "—"}
                    </span>
                    <span className="text-[12px] text-neutral-500 ml-2">{entry.districts.join(", ")}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded bg-route-bg text-route">
                    KPI {entry.kpiTarget}
                  </span>
                </div>

                {route ? (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[12.5px] text-neutral-600">
                      В маршруте: <b>{route.atmIds.length}</b> банкоматов · остановок на карте:{" "}
                      <b>{route.stopsCount}</b>
                      <span
                        className={`ml-2 text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${
                          route.optimized ? "bg-route-bg text-route" : "bg-st-white-bg text-st-white"
                        }`}
                      >
                        {route.optimized ? "оптимизирован" : "без оптимизации"}
                      </span>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{route.optimizationNote}</div>
                      {route.remainingForTomorrow > 0 && (
                        <div className="mt-2 bg-brass-bg text-brass-dark text-[12px] rounded-lg px-2.5 py-1.5 max-w-md">
                          📅 Территория больше дневной нормы — <b>{route.remainingForTomorrow}</b> точек перенесено
                          на следующий раз (вошли самые давно необслуженные).
                        </div>
                      )}
                      {!showAll && isRouteStale(route) && (
                        <div className="mt-2 bg-st-orange/10 text-st-orange text-[12px] rounded-lg px-2.5 py-1.5 max-w-md">
                          ⚠️ Данные изменились после построения этого маршрута (категория, статус или район
                          банкомата) — список может быть неактуален. Постройте маршрут заново, чтобы применить
                          изменения.
                        </div>
                      )}
                      {route.excludedCount > 0 && (
                        <div className="text-st-orange mt-1">
                          Исключено правилами: {route.excludedCount}
                          {route.excludedByStatus > 0 && (
                            <span> · без подтверждённого статуса: {route.excludedByStatus}</span>
                          )}
                          {route.excludedByCategory > 0 && (
                            <span> · категория не для маршрута: {route.excludedByCategory}</span>
                          )}
                          {route.excludedNoCoords > 0 && (
                            <span> · нет координат: {route.excludedNoCoords}</span>
                          )}
                          {route.excludedDistrictMismatch > 0 && (
                            <span>
                              {" "}
                              · район по координатам не совпадает: {route.excludedDistrictMismatch}{" "}
                              <a href="/district-boundaries" className="underline">
                                (проверить границы →)
                              </a>
                            </span>
                          )}
                          {route.atmIds.length === 0 && (
                            <div className="mt-1">
                              <a href="/atms" className="underline">
                                Перейти в «Банкоматы», отфильтровать по этому району и подтвердить статус →
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {route.status === "Отправлен" && (
                        <div className="text-[11px] text-neutral-400 mt-1">{route.lastSendResult}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {route.yandexUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
                        >
                          {route.yandexUrls.length > 1
                            ? `Отрезок ${i + 1}/${route.yandexUrls.length} в Яндекс Картах`
                            : "Открыть в Яндекс Картах"}
                        </a>
                      ))}
                      <form action={async () => { "use server"; await buildRouteAction(entry.id); }}>
                        <button className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50">
                          Пересчитать
                        </button>
                      </form>
                      <form action={async () => { "use server"; await sendRouteAction(route.id); }}>
                        <button className="text-xs font-semibold bg-brass text-white rounded-md px-3 py-2">
                          Отправить экипажу
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <form action={async () => { "use server"; await buildRouteAction(entry.id); }}>
                    <button className="text-xs font-semibold bg-brass text-white rounded-md px-3 py-2">
                      Построить маршрут
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
