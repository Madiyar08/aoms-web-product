import { listRecurringSchedules } from "@/lib/recurring-schedule";
import { listMachines } from "@/lib/machines";
import {
  createRecurringScheduleAction,
  toggleRecurringScheduleAction,
  deleteRecurringScheduleAction,
} from "./actions";

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function RecurringScheduleSection({ districts }: { districts: string[] }) {
  const recurring = listRecurringSchedules();
  const machines = listMachines();
  const machineById = new Map(machines.map((m) => [m.id, m]));

  return (
    <div className="bg-white border border-line rounded-[10px] p-5 mt-4">
      <h3 className="text-sm font-semibold text-ink mb-1">Регулярное расписание</h3>
      <p className="text-[12px] text-neutral-500 mb-4">
        Для экипажей с фиксированным графиком (например, вторник/четверг/суббота) — система сама создаёт
        запись в расписании на ближайшие 14 дней, не нужно каждый раз назначать вручную. Не перезаписывает
        уже существующие (в том числе вручную поправленные) записи — только заполняет пропуски.
      </p>

      {recurring.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {recurring.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-neutral-50 rounded-lg p-3">
              <div>
                <div className="text-[13px] font-medium">
                  {machineById.get(r.machineId)?.number || "?"} —{" "}
                  {r.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ")}
                </div>
                <div className="text-[11.5px] text-neutral-500">
                  {r.districts.join(", ")} · KPI {r.kpiTarget}
                  {!r.active && <span className="text-st-orange ml-2">(приостановлено)</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={toggleRecurringScheduleAction.bind(null, r.id, !r.active)}>
                  <button className="text-[11px] border border-line rounded-md px-2 py-1 bg-white">
                    {r.active ? "Приостановить" : "Включить"}
                  </button>
                </form>
                <form action={deleteRecurringScheduleAction.bind(null, r.id)}>
                  <button className="text-[11px] border border-st-red/40 text-st-red rounded-md px-2 py-1">
                    Удалить
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <details>
        <summary className="text-[12.5px] text-route cursor-pointer">+ Добавить регулярное расписание</summary>
        <form action={createRecurringScheduleAction} className="mt-3 flex flex-col gap-3 max-w-md">
          <div>
            <label className="block text-[11.5px] text-neutral-500 mb-1">Машина</label>
            <select name="machineId" className="input w-full" required>
              <option value="">— выберите —</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11.5px] text-neutral-500 mb-1">Дни недели</label>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, idx) => (
                <label key={idx} className="flex items-center gap-1 text-[12px] bg-neutral-50 rounded-md px-2 py-1">
                  <input type="checkbox" name="daysOfWeek" value={idx} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11.5px] text-neutral-500 mb-1">Районы</label>
            <select name="districts" multiple className="input w-full" style={{ height: 100 }} required>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11.5px] text-neutral-500 mb-1">KPI (точек в день)</label>
            <input type="number" name="kpiTarget" defaultValue={50} className="input w-full" required />
          </div>
          <div>
            <label className="block text-[11.5px] text-neutral-500 mb-1">Комментарий (необязательно)</label>
            <input type="text" name="comments" className="input w-full" />
          </div>
          <button className="text-xs font-semibold bg-ink text-white rounded-md px-3 py-2 self-start">
            Сохранить регулярное расписание
          </button>
        </form>
      </details>
    </div>
  );
}
