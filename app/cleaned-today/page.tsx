import Link from "next/link";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { getAtmById } from "@/lib/atms";
import { listEmployees } from "@/lib/employees";
import { listMachines } from "@/lib/machines";
import { todayTashkent, tashkentDateString, formatTashkentDateTime } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function CleanedTodayPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const today = todayTashkent();
  const date = searchParams.date || today;

  const allReports = listCleaningReports();
  const reports = allReports
    .filter((r) => tashkentDateString(new Date(r.clientTime)) === date)
    .sort((a, b) => (a.clientTime < b.clientTime ? 1 : -1));

  const machines = listMachines();
  const machineNumberById = new Map(machines.map((m) => [m.id, m.number]));
  const machineByEmployee = new Map<string, string>();
  for (const m of machines) {
    if (m.employee1Id) machineByEmployee.set(m.employee1Id, m.number);
    if (m.employee2Id) machineByEmployee.set(m.employee2Id, m.number);
  }
  // Сопоставление по имени — только запасной вариант для отчётов ДО
  // введения machineId (см. lib/reports.ts). Для новых отчётов машина
  // уже записана напрямую в самом отчёте — надёжнее, чем поиск по имени
  // сотрудника (которое может повториться или измениться).
  const employeeIdByName = new Map(listEmployees().map((e) => [e.fullName, e.id]));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-2xl font-medium text-ink">Отчёт: очищено за день</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/cleaning-reports/export?date=${date}`}
            className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
          >
            Скачать Excel
          </a>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        Отчёты об очистке за выбранную дату (по времени Ташкента) — обновляются по мере отправки сотрудниками
        из Mini App.
      </p>

      <form className="flex items-center gap-2 mb-6">
        <label className="text-[12.5px] text-neutral-500">Дата:</label>
        <input type="date" name="date" defaultValue={date} className="input !w-auto" max={today} />
        <button className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50">
          Показать
        </button>
        {date !== today && (
          <Link href="/cleaned-today" className="text-[12px] text-route hover:underline">
            Вернуться к сегодня
          </Link>
        )}
      </form>

      <div className="grid grid-cols-4 gap-4 mb-6 max-w-3xl">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Всего отчётов</div>
          <div className="text-xl font-mono">{reports.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">В маршруте</div>
          <div className="text-xl font-mono text-route">{reports.filter((r) => r.inRoute).length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Вне маршрута</div>
          <div className="text-xl font-mono text-st-orange">{reports.filter((r) => !r.inRoute).length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">С замечаниями</div>
          <div className="text-xl font-mono text-st-red">{reports.filter((r) => r.antifraudFlags.length > 0).length}</div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          За {date} отчётов нет.
        </div>
      ) : (
        <div className="bg-white border border-line rounded-[10px] overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-neutral-500 border-b border-line">
                <th className="py-2 px-3">Время</th>
                <th className="py-2 px-3">Банкомат</th>
                <th className="py-2 px-3">Адрес</th>
                <th className="py-2 px-3">Сотрудник</th>
                <th className="py-2 px-3">Машина</th>
                <th className="py-2 px-3">Статус</th>
                <th className="py-2 px-3">Маршрут</th>
                <th className="py-2 px-3">GPS</th>
                <th className="py-2 px-3">Замечания</th>
                <th className="py-2 px-3">Фото</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const atm = getAtmById(r.atmId);
                const machineNumber = r.machineId
                  ? machineNumberById.get(r.machineId)
                  : machineByEmployee.get(employeeIdByName.get(r.employeeName) || "");
                let photos: string[] = [];
                if (r.photosJson) {
                  try {
                    photos = JSON.parse(r.photosJson);
                  } catch {
                    /* ignore */
                  }
                }
                if (photos.length === 0 && r.photoData) photos = [r.photoData];
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 align-top">
                    <td className="py-2 px-3 whitespace-nowrap text-neutral-500">
                      {formatTashkentDateTime(r.clientTime).split(",")[1]?.trim() || formatTashkentDateTime(r.clientTime)}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-mono">{r.atmCode || "без ID"}</span>
                      {atm && <div className="text-neutral-500">{atm.name}</div>}
                    </td>
                    <td className="py-2 px-3 text-neutral-500 max-w-[180px]">{atm?.address || "—"}</td>
                    <td className="py-2 px-3">{r.employeeName}</td>
                    <td className="py-2 px-3">{machineNumber || "—"}</td>
                    <td className="py-2 px-3">{r.reportedWorkStatusName || "—"}</td>
                    <td className="py-2 px-3">
                      {r.inRoute ? (
                        <span className="text-route">в маршруте</span>
                      ) : (
                        <span className="text-st-orange">вне маршрута</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-neutral-500">
                      {Number.isNaN(r.distanceMeters) ? "—" : `${r.distanceMeters} м`}
                    </td>
                    <td className="py-2 px-3 text-st-red max-w-[220px]">
                      {r.antifraudFlags.length > 0 ? r.antifraudFlags.join("; ") : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {photos.length > 0 ? (
                        <div className="flex gap-1">
                          {photos.slice(0, 3).map((p, i) => (
                            <a key={i} href={p} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p} alt="" className="w-10 h-10 object-cover rounded border border-line" />
                            </a>
                          ))}
                          {photos.length > 3 && (
                            <span className="text-neutral-400 self-center">+{photos.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">нет</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
