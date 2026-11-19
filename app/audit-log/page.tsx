import { listAuditEvents } from "@/lib/audit-log";
import { currentAdminRole } from "@/lib/access-control";
import { formatTashkentDateTime } from "@/lib/tz";

export const dynamic = "force-dynamic";

function actionLabel(action: string): string {
  if (action === "inspector_report.reviewed") return "Изменение инспекторского отчёта";
  if (action === "inspector_report.comment_updated") return "Комментарий к инспекторскому отчёту";
  const labels: Record<string, string> = {
    "atm.created": "Создание банкомата", "atm.updated": "Изменение банкомата", "atm.deleted": "Удаление банкомата",
    "atm.bulk_updated": "Массовое изменение банкоматов", "atm.bulk_deleted": "Массовое удаление банкоматов",
    "schedule.created": "Создание записи расписания", "schedule.deleted": "Удаление записи расписания",
    "employee.created": "Создание сотрудника", "employee.updated": "Изменение сотрудника", "employee.deleted": "Удаление сотрудника",
    "machine.created": "Создание экипажа/машины", "machine.updated": "Изменение машины", "machine.deleted": "Удаление машины",
    "recurring_schedule.created": "Создание регулярного расписания", "recurring_schedule.updated": "Изменение регулярного расписания", "recurring_schedule.deleted": "Удаление регулярного расписания",
    "admin_user.created": "Создание учётной записи", "admin_user.updated": "Изменение учётной записи", "admin_user.password_reset": "Сброс пароля учётной записи",
  };
  return labels[action] || action;
}

export default function AuditLogPage() {
  if (!currentAdminRole()) return <div className="rounded-xl border border-line bg-white p-6 text-sm text-neutral-500">Журнал аудита недоступен: не настроена административная авторизация.</div>;
  const events = listAuditEvents(300);
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div><h1 className="font-display text-2xl font-medium text-ink mb-1">Журнал аудита</h1><p className="text-sm text-neutral-500">История административных действий с указанием персональной учётной записи и роли.</p></div>
      <span className="rounded-lg border border-line bg-white px-3 py-2 text-xs">Событий: <b>{events.length}</b></span>
    </div>
    {events.length === 0 ? <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-neutral-400">Зарегистрированных событий пока нет.</div> :
      <div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full text-left text-xs"><thead className="border-b border-line text-neutral-500"><tr><th className="p-3">Время</th><th className="p-3">Действие</th><th className="p-3">Объект</th><th className="p-3">Пользователь / роль</th><th className="p-3">Детали</th></tr></thead><tbody className="divide-y divide-line">
        {events.map((event) => <tr key={event.id}><td className="p-3 whitespace-nowrap">{formatTashkentDateTime(event.createdAt)}</td><td className="p-3">{actionLabel(event.action)}</td><td className="p-3">{({ inspector_report: "Инспекторский отчёт", atm: "Банкомат", schedule: "Расписание", employee: "Сотрудник", machine: "Машина", recurring_schedule: "Регулярное расписание", admin_user: "Учётная запись" } as Record<string, string>)[event.entityType] || event.entityType}<br/><span className="text-neutral-400">{event.entityId.slice(0, 8)}</span></td><td className="p-3">{event.actorLabel}<br/><span className="text-neutral-400">{event.actorRole}</span></td><td className="p-3 max-w-xs break-all"><code>{event.detailsJson}</code></td></tr>)}
      </tbody></table></div>}
    <p className="mt-4 text-xs text-neutral-400">Для старых событий до перехода на персональные учётные записи сохраняется отметка общей административной сессии.</p>
  </div>;
}
