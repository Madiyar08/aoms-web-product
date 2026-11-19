import type { ReactNode } from "react";
import { currentAdminRole, roleHasPermission } from "@/lib/access-control";
import { listMachines } from "@/lib/machines";
import { summarizeWarehouseIssuesByCrew } from "@/lib/warehouse-core";
import { listWarehouseItems, listWarehouseMovements } from "@/lib/warehouse";
import { archiveWarehouseItemAction, createWarehouseItemAction, recordWarehouseMovementAction } from "./actions";

export const dynamic = "force-dynamic";

const formatQuantity = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
const formatDate = (value: string) => new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" });

export default function WarehousePage() {
  const role = currentAdminRole();
  if (!role || !roleHasPermission(role, "warehouse:read")) {
    return <div className="rounded-xl border border-line bg-white p-6 text-sm text-neutral-500">Нет доступа к складскому модулю.</div>;
  }
  const canWrite = roleHasPermission(role, "warehouse:write");
  const items = listWarehouseItems();
  const allItems = listWarehouseItems(true);
  const movements = listWarehouseMovements(500);
  const machines = listMachines();
  const itemById = new Map(allItems.map(item => [item.id, item]));
  const machineById = new Map(machines.map(machine => [machine.id, machine]));
  const lowStock = items.filter(item => item.lowStock);
  const crewSummary = summarizeWarehouseIssuesByCrew(movements);
  const assignedIssues = movements.filter(m => m.type === "issue" && m.machineId).length;

  return <div className="space-y-6 pb-8">
    <header className="rounded-2xl bg-[#172b46] p-6 text-[#ffffff] shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a5c6e7]">AOMS / УЧЁТ РЕСУРСОВ</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-[#ffffff]">Склад и материалы</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d1deed]">Контроль остатков, документирование приходов и выдачи экипажам. Все движения сохраняются в журнале; складские остатки рассчитываются по фактическим операциям.</p>
    </header>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat label="Активные материалы" value={items.length} hint="Позиций в справочнике" />
      <Stat label="Ниже или на минимуме" value={lowStock.length} hint="Требуют внимания" tone={lowStock.length ? "warning" : "normal"} />
      <Stat label="Выдачи экипажам" value={assignedIssues} hint="В последних 500 операциях" />
      <Stat label="Операции в выборке" value={movements.length} hint="Последние 500 записей" />
    </div>

    {lowStock.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <h2 className="text-sm font-semibold text-amber-950">Материалы с низким остатком</h2>
      <p className="mt-1 text-sm text-amber-900">{lowStock.slice(0, 6).map(item => `${item.name}: ${formatQuantity(item.balance)} ${item.unit}`).join(" · ")}{lowStock.length > 6 ? ` · и ещё ${lowStock.length - 6}` : ""}</p>
    </section>}

    {canWrite && <div className="grid gap-4 xl:grid-cols-2">
      <form action={createWarehouseItemAction} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="text-lg font-semibold text-ink">Новый материал</h2><p className="mt-1 text-xs text-neutral-500">Добавьте позицию в справочник. Начальный остаток оформите отдельным приходом.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Артикул *"><input name="sku" required maxLength={40} placeholder="Например, CLEAN-001" className="input w-full" /></Field>
          <Field label="Название *"><input name="name" required maxLength={120} placeholder="Средство для очистки" className="input w-full" /></Field>
          <Field label="Единица измерения *"><input name="unit" required maxLength={20} placeholder="шт, л, кг" className="input w-full" /></Field>
          <Field label="Минимальный остаток"><input name="minimumStock" type="number" min="0" max="1000000" step="0.001" defaultValue="0" className="input w-full" /></Field>
        </div>
        <button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Добавить материал</button>
      </form>

      <form action={recordWarehouseMovementAction} className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <div><h2 className="text-lg font-semibold text-ink">Операция со складом</h2><p className="mt-1 text-xs text-neutral-500">Приход увеличивает остаток, расход уменьшает. Выдачу можно закрепить за конкретным экипажем.</p></div>
        <Field label="Материал *"><select name="itemId" required className="input w-full" defaultValue=""> <option value="" disabled>Выберите материал</option>{items.map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name} · {formatQuantity(item.balance)} {item.unit}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Операция *"><select name="type" className="input w-full" defaultValue="issue"><option value="issue">Выдача / расход</option><option value="receipt">Приход</option></select></Field>
          <Field label="Количество *"><input name="quantity" type="number" min="0.001" max="1000000" step="0.001" required placeholder="0.000" className="input w-full" /></Field>
        </div>
        <Field label="Экипаж (только для выдачи)"><select name="machineId" className="input w-full" defaultValue=""><option value="">Общий расход / без экипажа</option>{machines.map(machine => <option key={machine.id} value={machine.id}>{machine.number || machine.id}</option>)}</select></Field>
        <Field label="Основание / комментарий * для расхода"><input name="note" maxLength={500} placeholder="Накладная, цель выдачи, получатель" className="input w-full" /></Field>
        <p className="text-xs leading-5 text-neutral-500">Для прихода оставьте поле экипажа пустым. Привязка к экипажу не означает автоматическое списание по выполненным маршрутам.</p>
        <button disabled={!items.length} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Сохранить операцию</button>
      </form>
    </div>}

    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-ink">Остатки материалов</h2><p className="mt-1 text-xs text-neutral-500">Архивировать можно только позицию с нулевым остатком.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs text-neutral-600"><tr><th className="p-3">Артикул</th><th className="p-3">Материал</th><th className="p-3">Остаток</th><th className="p-3">Минимум</th><th className="p-3">Статус</th>{canWrite && <th className="p-3">Действие</th>}</tr></thead><tbody className="divide-y divide-line">{items.map(item => <tr key={item.id}><td className="p-3 font-mono text-xs">{item.sku}</td><td className="p-3 font-medium">{item.name}<span className="block text-xs font-normal text-neutral-500">{item.unit}</span></td><td className="p-3 font-semibold tabular-nums">{formatQuantity(item.balance)}</td><td className="p-3 tabular-nums">{formatQuantity(item.minimumStock)}</td><td className="p-3"><span className={item.lowStock ? "font-medium text-amber-700" : "font-medium text-emerald-700"}>{item.lowStock ? "Ниже / на минимуме" : "В норме"}</span></td>{canWrite && <td className="p-3"><form action={archiveWarehouseItemAction}><input type="hidden" name="id" value={item.id}/><button disabled={Math.abs(item.balance) > 1e-9} title={Math.abs(item.balance) > 1e-9 ? "Сначала доведите остаток до нуля" : "Архивировать материал"} className="text-xs font-medium text-slate-700 underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline">Архивировать</button></form></td>}</tr>)}</tbody></table></div>
      {!items.length && <p className="p-6 text-sm text-neutral-500">На складе пока нет активных материалов. Добавьте первую позицию, затем оформите приход.</p>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-ink">Выдано экипажам</h2><p className="mt-1 text-xs text-neutral-500">Агрегация выдач по экипажу и материалу за последние 500 операций. Разные единицы измерения не смешиваются.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-xs text-neutral-600"><tr><th className="p-3">Экипаж</th><th className="p-3">Материал</th><th className="p-3">Выдано</th><th className="p-3">Операций</th></tr></thead><tbody className="divide-y divide-line">{crewSummary.map(row => <tr key={`${row.machineId}:${row.itemId}`}><td className="p-3 font-medium">{machineById.get(row.machineId)?.number || `Экипаж ${row.machineId}`}</td><td className="p-3">{itemById.get(row.itemId)?.name || `Материал ${row.itemId}`}</td><td className="p-3 tabular-nums">{formatQuantity(row.quantity)} {itemById.get(row.itemId)?.unit || ""}</td><td className="p-3 tabular-nums">{row.operations}</td></tr>)}</tbody></table></div>
      {!crewSummary.length && <p className="p-6 text-sm text-neutral-500">Пока нет выдач, закреплённых за экипажами. При оформлении расхода выберите экипаж.</p>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="border-b border-line px-5 py-4"><h2 className="font-semibold text-ink">Журнал движений</h2><p className="mt-1 text-xs text-neutral-500">Последние 500 операций · время Ташкента · архивные материалы сохраняются в истории.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-neutral-600"><tr><th className="p-3">Дата</th><th className="p-3">Материал</th><th className="p-3">Операция</th><th className="p-3">Количество</th><th className="p-3">Экипаж</th><th className="p-3">Основание</th><th className="p-3">Сотрудник</th></tr></thead><tbody className="divide-y divide-line">{movements.map(m => <tr key={m.id}><td className="whitespace-nowrap p-3 text-xs">{formatDate(m.createdAt)}</td><td className="p-3">{itemById.get(m.itemId)?.name || m.itemId}</td><td className="p-3"><span className={m.type === "receipt" ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{m.type === "receipt" ? "Приход" : "Расход"}</span></td><td className="p-3 tabular-nums">{formatQuantity(m.quantity)} {itemById.get(m.itemId)?.unit || ""}</td><td className="p-3">{m.machineId ? machineById.get(m.machineId)?.number || m.machineId : "—"}</td><td className="max-w-xs break-words p-3">{m.note || "—"}</td><td className="p-3">{m.actorLabel}</td></tr>)}</tbody></table></div>
      {!movements.length && <p className="p-6 text-sm text-neutral-500">Операций пока нет.</p>}
    </section>
    <p className="text-xs leading-5 text-neutral-500">Складской учёт ведётся вручную. Привязка выдачи к экипажу не создаёт автоматический расход по отчётам очистки. Инвентаризация и интеграция с бухгалтерией не реализованы.</p>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="block text-xs font-semibold text-slate-700">{label}</span>{children}</label>;
}
function Stat({ label, value, hint, tone = "normal" }: { label: string; value: number; hint: string; tone?: "normal" | "warning" }) {
  return <div className="rounded-xl border border-line bg-white p-4 shadow-sm"><div className="text-xs font-medium text-neutral-500">{label}</div><div className={`mt-2 font-display text-3xl font-semibold tabular-nums ${tone === "warning" ? "text-amber-700" : "text-ink"}`}>{value}</div><div className="mt-1 text-xs text-neutral-500">{hint}</div></div>;
}
