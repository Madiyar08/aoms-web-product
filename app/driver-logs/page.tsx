import { listDriverLogs, distanceKm } from "@/lib/driver-logs";

export const dynamic = "force-dynamic";

export default async function DriverLogsPage() {
  const logs = listDriverLogs().sort((a, b) => (a.date < b.date ? 1 : -1));

  const totalKm = logs.reduce((sum, l) => sum + (distanceKm(l) ?? 0), 0);
  const totalFuelLiters = logs.reduce((sum, l) => sum + (l.fuelLiters ?? 0), 0);
  const totalFuelCost = logs.reduce((sum, l) => sum + (l.fuelCost ?? 0), 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Водитель</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Одометр и расход топлива — вносится самим водителем через Telegram Mini App (кнопка «Одометр и
        топливо»). Здесь — сводка по всем машинам.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Пробег всего</div>
          <div className="text-xl font-mono">{totalKm} км</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Топливо всего</div>
          <div className="text-xl font-mono">{totalFuelLiters} л</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Затраты на топливо</div>
          <div className="text-xl font-mono">{totalFuelCost.toLocaleString("ru-RU")}</div>
        </div>
      </div>

      <div className="bg-white border border-line rounded-[10px] p-5">
        {logs.length === 0 ? (
          <p className="text-sm text-neutral-400">Пока нет ни одной записи.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
                <th className="py-2">Дата</th>
                <th className="py-2">Машина</th>
                <th className="py-2">Водитель</th>
                <th className="py-2">Одометр начало</th>
                <th className="py-2">Одометр конец</th>
                <th className="py-2">Пробег, км</th>
                <th className="py-2">Топливо, л</th>
                <th className="py-2">Топливо, сумма</th>
                <th className="py-2">Комментарий</th>
                <th className="py-2">Фото</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-2.5">{l.date}</td>
                  <td className="py-2.5">{l.machineNumber}</td>
                  <td className="py-2.5">{l.employeeName}</td>
                  <td className="py-2.5 font-mono">{l.odometerStart ?? "—"}</td>
                  <td className="py-2.5 font-mono">{l.odometerEnd ?? "—"}</td>
                  <td className="py-2.5 font-mono">{distanceKm(l) ?? "—"}</td>
                  <td className="py-2.5 font-mono">{l.fuelLiters ?? "—"}</td>
                  <td className="py-2.5 font-mono">{l.fuelCost ?? "—"}</td>
                  <td className="py-2.5 text-neutral-500">{l.comment || "—"}</td>
                  <td className="py-2.5">
                    <div className="flex gap-1">
                      {l.odometerStartPhotoUrl && (
                        <a href={l.odometerStartPhotoUrl} target="_blank" rel="noreferrer">
                          <img
                            src={l.odometerStartPhotoUrl}
                            alt="одометр начало"
                            title="Одометр — начало дня"
                            className="w-8 h-8 object-cover rounded border border-line"
                          />
                        </a>
                      )}
                      {l.odometerEndPhotoUrl && (
                        <a href={l.odometerEndPhotoUrl} target="_blank" rel="noreferrer">
                          <img
                            src={l.odometerEndPhotoUrl}
                            alt="одометр конец"
                            title="Одометр — конец дня"
                            className="w-8 h-8 object-cover rounded border border-line"
                          />
                        </a>
                      )}
                      {l.receiptPhotoUrl && (
                        <a href={l.receiptPhotoUrl} target="_blank" rel="noreferrer">
                          <img
                            src={l.receiptPhotoUrl}
                            alt="чек"
                            title="Чек за топливо"
                            className="w-8 h-8 object-cover rounded border border-line"
                          />
                        </a>
                      )}
                      {!l.odometerStartPhotoUrl && !l.odometerEndPhotoUrl && !l.receiptPhotoUrl && (
                        <span className="text-neutral-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
