import { listEmployees } from "@/lib/employees";
import { listMachines } from "@/lib/machines";
import { listLatestPingsByEmployee, purgeOldPings } from "@/lib/location-pings";

export const dynamic = "force-dynamic";

/** Сколько минут без обновления считаем "потерян сигнал" (жёлтый/красный). */
const STALE_AFTER_MIN = 10;
const OFFLINE_AFTER_MIN = 30;

function minutesAgo(iso: string): number {
  return Math.round((Date.now() - Date.parse(iso)) / 60000);
}

export default async function CrewLocationsPage() {
  // Ленивая чистка старых точек — без отдельного cron в этом окружении
  // проще всего чистить по факту захода на страницу.
  purgeOldPings();

  const employees = listEmployees().filter((e) => e.status === "Активен");
  const machines = listMachines();
  const machineByEmployee = new Map<string, string>();
  for (const m of machines) {
    if (m.employee1Id) machineByEmployee.set(m.employee1Id, m.number);
    if (m.employee2Id) machineByEmployee.set(m.employee2Id, m.number);
  }

  const latestPings = listLatestPingsByEmployee();

  const rows = employees
    .map((emp) => {
      const ping = latestPings.get(emp.id);
      const ago = ping ? minutesAgo(ping.capturedAt) : null;
      return {
        employee: emp,
        machineNumber: machineByEmployee.get(emp.id) || "—",
        ping,
        minutesAgo: ago,
      };
    })
    // Сначала те, у кого есть live-сигнал (свежее — выше), потом остальные
    .sort((a, b) => {
      if (a.ping && !b.ping) return -1;
      if (!a.ping && b.ping) return 1;
      if (a.minutesAgo != null && b.minutesAgo != null) return a.minutesAgo - b.minutesAgo;
      return a.employee.fullName.localeCompare(b.employee.fullName);
    });

  const withSignal = rows.filter((r) => r.ping && r.minutesAgo! <= OFFLINE_AFTER_MIN).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Где экипажи</h1>
      <p className="text-sm text-neutral-500 mb-2">
        Последняя геопозиция по трансляции Telegram Live Location. Сотрудник включает трансляцию сам
        (скрепка → Геопозиция → «Транслировать геопозицию») — без этого данных не будет.
      </p>
      <p className="text-[12px] text-neutral-400 mb-6">
        На связи сейчас: <b className="text-st-green">{withSignal}</b> из {employees.length} активных сотрудников.
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Нет активных сотрудников.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const hasPing = Boolean(r.ping);
            const isStale = r.minutesAgo != null && r.minutesAgo > STALE_AFTER_MIN && r.minutesAgo <= OFFLINE_AFTER_MIN;
            const isOffline = r.minutesAgo != null && r.minutesAgo > OFFLINE_AFTER_MIN;
            const dotClass = !hasPing
              ? "bg-st-white border-2 border-neutral-300"
              : isOffline
              ? "bg-st-red"
              : isStale
              ? "bg-st-orange"
              : "bg-st-green";

            const mapUrl = r.ping
              ? `https://yandex.ru/maps/?pt=${r.ping.longitude},${r.ping.latitude}&z=16&l=map`
              : null;

            return (
              <div key={r.employee.id} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-ink">{r.employee.fullName}</span>
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`} />
                </div>
                <div className="text-[12px] text-neutral-500 mb-2">
                  Машина {r.machineNumber} · {r.employee.role || "роль не указана"}
                </div>
                {hasPing ? (
                  <>
                    <div className="text-[12px] text-neutral-600 mb-1">
                      Обновлено:{" "}
                      <span className={isOffline ? "text-st-red" : isStale ? "text-st-orange" : "text-st-green"}>
                        {r.minutesAgo === 0 ? "только что" : `${r.minutesAgo} мин назад`}
                      </span>
                    </div>
                    <a
                      href={mapUrl!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-route hover:underline"
                    >
                      Открыть на Яндекс.Картах →
                    </a>
                  </>
                ) : (
                  <div className="text-[12px] text-neutral-400">Трансляция не включена</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
