import { listEmployees } from "@/lib/employees";
import { buildRegistrationLink } from "@/lib/telegram";
import { createEmployeeAction, deleteEmployeeAction, setTelegramChatIdAction, setEmployeeRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const employees = listEmployees();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Сотрудники</h1>
      <p className="text-sm text-neutral-500 mb-2">{employees.length} сотрудников</p>
      <p className="text-[12px] text-neutral-500 mb-6">
        Chat ID можно ввести вручную (для локального теста без вебхука) или дождаться
        автоматической привязки по ссылке — см. подсказку в столбце Telegram.
      </p>

      <div className="grid grid-cols-[1.7fr_1fr] gap-4">
        <div className="bg-white border border-line rounded-[10px] p-5">
          {employees.length === 0 ? (
            <p className="text-sm text-neutral-400">Пока нет ни одного сотрудника.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500 border-b border-line">
                  <th className="py-2">ФИО</th>
                  <th className="py-2">Телефон</th>
                  <th className="py-2">Статус</th>
                  <th className="py-2">Роль</th>
                  <th className="py-2 w-56">Telegram Chat ID</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const link = buildRegistrationLink(e.id);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="py-2.5">{e.fullName}</td>
                      <td className="py-2.5 font-mono text-neutral-500">{e.phone || "—"}</td>
                      <td className="py-2.5">{e.status}</td>
                      <td className="py-2.5">
                        <form
                          action={async (formData) => {
                            "use server";
                            await setEmployeeRoleAction(e.id, String(formData.get("role") || ""));
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <select name="role" defaultValue={e.role || ""} className="input !py-1 !text-[11px] !w-24">
                            <option value="">— нет —</option>
                            <option value="Водитель">Водитель</option>
                            <option value="Уборщик">Уборщик</option>
                          </select>
                          <button className="text-[10.5px] font-semibold border border-line rounded px-2 py-1 bg-white">
                            Сохр.
                          </button>
                        </form>
                      </td>
                      <td className="py-2.5">
                        <form
                          action={async (formData) => {
                            "use server";
                            await setTelegramChatIdAction(e.id, String(formData.get("chatId") || ""));
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            name="chatId"
                            defaultValue={e.telegramChatId}
                            placeholder="например 123456789"
                            className="input !py-1 !text-[11px] !w-32"
                          />
                          <button className="text-[10.5px] font-semibold border border-line rounded px-2 py-1 bg-white">
                            Сохр.
                          </button>
                        </form>
                        {!e.telegramChatId && link && (
                          <a href={link} target="_blank" rel="noreferrer" className="text-[10.5px] text-brass-dark block mt-1">
                            или ссылка для автоподключения →
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <form action={async () => { "use server"; await deleteEmployeeAction(e.id); }}>
                          <button className="text-[11px] text-st-red">Удалить</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-line rounded-[10px] p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Добавить сотрудника</h3>
          <form action={createEmployeeAction} className="flex flex-col gap-3">
            <input name="fullName" placeholder="ФИО" required className="input" />
            <input name="phone" placeholder="Телефон" className="input" />
            <select name="status" className="input">
              <option>Активен</option>
              <option>На больничном</option>
              <option>В отпуске</option>
              <option>Уволен</option>
            </select>
            <select name="role" className="input">
              <option value="">Роль — не указана</option>
              <option value="Водитель">Водитель</option>
              <option value="Уборщик">Уборщик</option>
            </select>
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">
                Telegram Chat ID (необязательно, можно добавить позже)
              </span>
              <input name="telegramChatId" placeholder="например 123456789" className="input" />
            </label>
            <textarea name="comments" placeholder="Комментарий" className="input" />
            <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2">
              Сохранить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
