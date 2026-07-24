import { listMachines } from "@/lib/machines";
import { listEmployees } from "@/lib/employees";
import { createMachineAction, deleteMachineAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const machines = listMachines();
  const employees = listEmployees();
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Машины</h1>
      <p className="text-sm text-neutral-500 mb-6">{machines.length} машин</p>

      {employees.length === 0 && (
        <div className="mb-4 bg-brass-bg border border-brass/30 text-brass-dark text-sm rounded-lg p-4">
          Сначала добавьте сотрудников на странице «Сотрудники» — иначе некого будет назначить в экипаж.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3.5">
        {machines.map((m) => (
          <div key={m.id} className="bg-white border border-line rounded-[10px] p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-ink">Машина {m.number}</h4>
              <span className="text-[11px] font-semibold px-2 py-1 rounded bg-route-bg text-route">{m.status}</span>
            </div>
            <p className="text-[12.5px] text-neutral-600 mb-1">
              Сотрудник №1: {employeeById.get(m.employee1Id)?.fullName ?? "—"}
            </p>
            <p className="text-[12.5px] text-neutral-600 mb-3">
              Сотрудник №2: {employeeById.get(m.employee2Id)?.fullName ?? "—"}
            </p>
            {m.comments && <p className="text-[11.5px] text-neutral-400 mb-3">{m.comments}</p>}
            <form action={async () => { "use server"; await deleteMachineAction(m.id); }}>
              <button className="text-[11px] text-st-red">Удалить</button>
            </form>
          </div>
        ))}

        <div className="bg-white border border-line rounded-[10px] p-4">
          <h4 className="text-sm font-semibold text-ink mb-3">Добавить машину</h4>
          <form action={createMachineAction} className="flex flex-col gap-2.5">
            <input name="number" placeholder="Номер машины" required className="input" />
            <select name="employee1Id" className="input">
              <option value="">Сотрудник №1 — не выбран</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <select name="employee2Id" className="input">
              <option value="">Сотрудник №2 — не выбран</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <select name="status" className="input">
              <option>Свободна</option>
              <option>На маршруте</option>
              <option>Завершила день</option>
              <option>На ремонте</option>
            </select>
            <textarea name="comments" placeholder="Комментарий" className="input" />
            <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2 mt-1">
              Сохранить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
