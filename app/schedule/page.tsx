import { listSchedule, isTashkentCityDay } from "@/lib/schedule";
import { listMachines } from "@/lib/machines";
import { listDistinctDistricts } from "@/lib/atms";
import { getSettingValue } from "@/lib/settings";
import { createScheduleAction, deleteScheduleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const entries = [...listSchedule()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const machines = listMachines();
  const districts = listDistinctDistricts();
  const defaultKpi = getSettingValue("kpi_min_atms_per_day", 50);
  const machineById = new Map(machines.map((m) => [m.id, m]));

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Расписание</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Районы и KPI назначаются вручную на каждый экипаж и каждый день — без автогенерации.
        Понедельник и пятница обычно закрепляются за городом Ташкент (BR-001), но это подсказка,
        а не жёсткое ограничение.
      </p>

      {machines.length === 0 && (
        <div className="mb-4 bg-brass-bg border border-brass/30 text-brass-dark text-sm rounded-lg p-4">
          Сначала добавьте машины на странице «Машины».
        </div>
      )}
      {districts.length === 0 && (
        <div className="mb-4 bg-brass-bg border border-brass/30 text-brass-dark text-sm rounded-lg p-4">
          Районов пока нет — они появляются автоматически из поля «Район» банкоматов
          (заполняется вручную или через импорт Excel).
        </div>
      )}

      <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-start">
        <div className="bg-white border border-line rounded-[10px] p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Назначения</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-neutral-400">Пока ничего не назначено.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
                  <th className="py-2">Дата</th>
                  <th className="py-2">Машина</th>
                  <th className="py-2">Районы</th>
                  <th className="py-2">KPI</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="py-2.5">
                      {e.date}
                      {isTashkentCityDay(e.date) && (
                        <span className="ml-1.5 text-[10px] bg-brass-bg text-brass-dark px-1.5 py-0.5 rounded">
                          Ташкент-день
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">{machineById.get(e.machineId)?.number ?? "—"}</td>
                    <td className="py-2.5">{e.districts.join(", ")}</td>
                    <td className="py-2.5 font-mono">{e.kpiTarget}</td>
                    <td className="py-2.5 text-right">
                      <form action={async () => { "use server"; await deleteScheduleAction(e.id); }}>
                        <button className="text-[11px] text-st-red">Удалить</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-line rounded-[10px] p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Новое назначение</h3>
          <form action={createScheduleAction} className="flex flex-col gap-3">
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Дата</span>
              <input type="date" name="date" required className="input" />
            </label>
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Машина</span>
              <select name="machineId" required className="input">
                <option value="">— выберите —</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>Машина {m.number}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">
                KPI на этот экипаж/день
              </span>
              <input type="number" name="kpiTarget" defaultValue={defaultKpi} className="input" />
            </label>
            <div>
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1.5">
                Районы (можно несколько)
              </span>
              <div className="max-h-48 overflow-auto border border-line rounded-md p-2 flex flex-col gap-1">
                {districts.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" name="districts" value={d} /> {d}
                  </label>
                ))}
              </div>
            </div>
            <textarea name="comments" placeholder="Комментарий" className="input" />
            <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2">
              Сохранить назначение
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
