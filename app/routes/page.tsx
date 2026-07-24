import { listSchedule } from "@/lib/schedule";
import { listMachines } from "@/lib/machines";
import { listRoutes, getRouteByScheduleId, isRouteStale } from "@/lib/routes";
import { isTelegramConfigured } from "@/lib/telegram";
import { buildRouteAction, sendRouteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const entries = [...listSchedule()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const machines = listMachines();
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const routes = listRoutes();
  const telegramReady = isTelegramConfigured();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Маршруты</h1>
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
                      {isRouteStale(route) && (
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
