import { listSchedule, isTashkentCityDay } from "@/lib/schedule";
import { listMachines } from "@/lib/machines";
import { listDistinctDistricts } from "@/lib/atms";
import { getSettingValue } from "@/lib/settings";
import { ensureRecurringSchedulesMaterialized } from "@/lib/recurring-schedule";
import { createScheduleAction, deleteScheduleAction } from "./actions";
import { RecurringScheduleSection } from "./RecurringScheduleSection";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  ensureRecurringSchedulesMaterialized();

  const entries = [...listSchedule()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const machines = listMachines();
  const districts = listDistinctDistricts();
  const defaultKpi = getSettingValue("kpi_min_atms_per_day", 50);
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const todayCount = entries.filter((entry) => entry.date === today).length;
  const futureCount = entries.filter((entry) => entry.date > today).length;
  const pastCount = entries.filter((entry) => entry.date < today).length;

  return (
    <div className="schedule-page space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em] text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Операционное управление
          </div>
          <h1>Планирование экипажей</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Назначайте экипажи на даты, распределяйте районы и задавайте дневную цель по банкоматам. Регулярные назначения управляются отдельно и материализуются в расписание автоматически.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Часовой пояс: Ташкент · UTC+5</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Сводка расписания">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Назначения на сегодня</p>
          <div className="mt-2 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight text-slate-900">{todayCount}</strong><span className="text-xs text-slate-400">экипажей</span></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Предстоящие назначения</p>
          <div className="mt-2 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight text-slate-900">{futureCount}</strong><span className="text-xs text-slate-400">в расписании</span></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500">Прошедшие назначения</p>
          <div className="mt-2 flex items-end justify-between"><strong className="text-3xl font-bold tracking-tight text-slate-900">{pastCount}</strong><span className="text-xs text-slate-400">записей</span></div>
        </div>
      </section>

      {(machines.length === 0 || districts.length === 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Для планирования не хватает справочных данных</p>
          <ul className="mt-1 list-inside list-disc text-amber-800">
            {machines.length === 0 && <li>Сначала добавьте автомобили и экипажи на странице «Автомобили».</li>}
            {districts.length === 0 && <li>Районы появятся после заполнения данных банкоматов или импорта Excel.</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 2xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,.85fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
            <div><h2 className="text-base font-bold text-slate-900">Назначения экипажей</h2><p className="mt-1 text-xs text-slate-500">Сначала отображаются самые ближайшие даты</p></div>
            <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Всего: {entries.length}</span>
          </div>
          {entries.length === 0 ? (
            <div className="px-6 py-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-xl text-slate-500">▦</div><p className="mt-3 text-sm font-semibold text-slate-800">Расписание пока пустое</p><p className="mt-1 text-xs text-slate-500">Создайте первое назначение с помощью формы справа.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead><tr><th>Дата</th><th>Экипаж / машина</th><th>Назначенные районы</th><th className="text-right">Цель</th><th className="text-right">Действие</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td><span className="font-semibold text-slate-800">{entry.date}</span>{isTashkentCityDay(entry.date) && <span className="mt-1 block w-fit rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Ташкент-день</span>}</td>
                      <td><span className="font-semibold text-slate-800">Машина {machineById.get(entry.machineId)?.number ?? "—"}</span><span className="mt-1 block text-[11px] text-slate-400">ID: {entry.machineId}</span></td>
                      <td><div className="flex max-w-[390px] flex-wrap gap-1.5">{entry.districts.map((district) => <span key={district} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{district}</span>)}</div></td>
                      <td className="text-right"><span className="font-mono text-sm font-bold text-slate-800">{entry.kpiTarget}</span><span className="ml-1 text-[10px] text-slate-400">ATM</span></td>
                      <td className="text-right"><form action={async () => { "use server"; await deleteScheduleAction(entry.id); }}><button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Удалить</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-blue-700">Новое назначение</p><h2 className="mt-1 text-base font-bold text-slate-900">Создать план экипажа</h2><p className="mt-1 text-xs text-slate-500">Заполните параметры смены и сохраните назначение.</p></div>
          <form action={createScheduleAction} className="flex flex-col gap-4 p-5">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Дата смены <span className="text-rose-600">*</span></span><input type="date" name="date" required className="w-full" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Машина / экипаж <span className="text-rose-600">*</span></span><select name="machineId" required className="w-full"><option value="">Выберите экипаж</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>Машина {machine.number}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Дневная цель, банкоматов</span><input type="number" name="kpiTarget" min="0" max="500" defaultValue={defaultKpi} className="w-full" /><span className="mt-1 block text-[11px] text-slate-400">Стандартное значение из настроек: {defaultKpi}</span></label>
            <fieldset><legend className="mb-1.5 text-xs font-semibold text-slate-700">Районы работы <span className="text-rose-600">*</span></legend><p className="mb-2 text-[11px] text-slate-400">Можно выбрать несколько районов для одного экипажа.</p><div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2">{districts.length === 0 ? <p className="p-2 text-xs text-slate-400">Нет доступных районов</p> : <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 2xl:grid-cols-1">{districts.map((district) => <label key={district} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-700 hover:bg-white"><input type="checkbox" name="districts" value={district} className="h-4 w-4 rounded border-slate-300" />{district}</label>)}</div>}</div></fieldset>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Комментарий</span><textarea name="comments" rows={3} placeholder="Дополнительные инструкции экипажу" className="w-full resize-y" /></label>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={machines.length === 0 || districts.length === 0}>Сохранить назначение <span className="ml-2">→</span></button>
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-base font-bold text-slate-900">Регулярное расписание</h2><p className="mt-1 text-xs text-slate-500">Шаблоны назначений для автоматического заполнения будущих дат.</p></div><RecurringScheduleSection districts={districts} /></section>
    </div>
  );
}
