import { listSettings, ensureDefaultSettings } from "@/lib/settings";
import { createSettingAction, updateSettingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  ensureDefaultSettings();
  const settings = listSettings();
  const categories = Array.from(new Set(settings.map((s) => s.category)));

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Настройки</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Изменения применяются сразу для всей системы. Данные, а не код.
      </p>

      {categories.map((category) => (
        <div key={category} className="bg-white border border-line rounded-[10px] p-5 mb-4">
          <h3 className="text-sm font-semibold text-ink mb-3">{category}</h3>
          <div className="flex flex-col gap-3">
            {settings
              .filter((s) => s.category === category)
              .map((setting) => (
                <form
                  key={setting.id}
                  action={async (formData) => {
                    "use server";
                    await updateSettingAction(setting.id, String(formData.get("value")));
                  }}
                  className="flex items-end gap-3"
                >
                  <div className="flex-1">
                    <label className="block text-[11.5px] font-semibold text-neutral-500 mb-1">
                      {setting.key}
                    </label>
                    <input
                      name="value"
                      defaultValue={setting.value}
                      className="w-full border border-line rounded-md px-3 py-2 text-sm"
                    />
                    {setting.description && (
                      <p className="text-[11px] text-neutral-400 mt-1">{setting.description}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
                  >
                    Сохранить
                  </button>
                </form>
              ))}
          </div>
        </div>
      ))}

      <div className="bg-white border border-line rounded-[10px] p-5">
        <h3 className="text-sm font-semibold text-ink mb-3">Добавить настройку</h3>
        <form action={createSettingAction} className="grid grid-cols-2 gap-3">
          <input name="key" placeholder="Ключ (латиницей)" className="border border-line rounded-md px-3 py-2 text-sm" />
          <input name="value" placeholder="Значение" className="border border-line rounded-md px-3 py-2 text-sm" />
          <input name="category" placeholder="Категория" className="border border-line rounded-md px-3 py-2 text-sm" />
          <select name="valueType" className="border border-line rounded-md px-3 py-2 text-sm">
            <option value="string">string</option>
            <option value="int">int</option>
            <option value="float">float</option>
            <option value="bool">bool</option>
            <option value="csv">csv</option>
          </select>
          <textarea name="description" placeholder="Описание" className="border border-line rounded-md px-3 py-2 text-sm col-span-2" />
          <button
            type="submit"
            className="col-span-2 bg-brass text-white text-sm font-semibold rounded-md py-2"
          >
            Добавить
          </button>
        </form>
      </div>
    </div>
  );
}
