import Link from "next/link";
import { listAtms } from "@/lib/atms";
import { listCategories, ensureDefaultCategories } from "@/lib/categories";
import { listStatuses, ensureDefaultStatuses } from "@/lib/statuses";
import { createAtmAction } from "./actions";
import { AtmTable } from "./AtmTable";
import { ClearAllButton } from "./ClearAllButton";

export const dynamic = "force-dynamic";

export default async function AtmsPage() {
  ensureDefaultCategories();
  ensureDefaultStatuses();

  const atms = listAtms();
  const categories = listCategories();
  const statuses = listStatuses();
  const uncategorized = atms.filter((a) => !a.categoryId).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Банкоматы</h1>
          <p className="text-sm text-neutral-500 mt-1">{atms.length} банкоматов в базе</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/atms/export"
            className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
          >
            Скачать Excel
          </a>
          <a
            href="/api/atms/export?format=csv"
            className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
          >
            Скачать CSV
          </a>
          <Link
            href="/atms/import"
            className="text-xs font-semibold border border-line rounded-md px-3 py-2 bg-white hover:bg-neutral-50"
          >
            Импорт из Excel
          </Link>
          <ClearAllButton count={atms.length} />
        </div>
      </div>

      {uncategorized > 0 && (
        <div className="mb-4 bg-brass-bg border border-brass/30 text-brass-dark text-sm rounded-lg p-4">
          {uncategorized} банкоматов без категории (обычно — после импорта из Excel, в файле
          категория не указана). Выделите нужные строки чекбоксами в таблице и назначьте
          категорию массово через панель, которая появится сверху.
        </div>
      )}

      <div className="grid grid-cols-[1.7fr_1fr] gap-4 items-start">
        <div className="bg-white border border-line rounded-[10px] p-5">
          {atms.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Пока нет ни одного банкомата — добавьте первый в форме справа или импортируйте из Excel.
            </p>
          ) : (
            <AtmTable atms={atms} categories={categories} statuses={statuses} />
          )}
        </div>

        <div className="bg-white border border-line rounded-[10px] p-5 sticky top-6">
          <h3 className="text-sm font-semibold text-ink mb-3">Добавить банкомат</h3>
          <form action={createAtmAction} className="flex flex-col gap-3">
            <Field label="ID банкомата (можно пусто)"><input name="code" className="input" /></Field>
            <Field label="Название"><input name="name" required className="input" /></Field>
            <Field label="Адрес"><input name="address" className="input" /></Field>
            <Field label="Район"><input name="district" className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Широта"><input name="latitude" className="input" /></Field>
              <Field label="Долгота"><input name="longitude" className="input" /></Field>
            </div>
            <Field label="Категория">
              <select name="categoryId" className="input">
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Статус работы">
              <select name="workStatusId" className="input">
                <option value="">—</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="addressVerified" /> Адрес проверен
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="coordsVerified" /> Координаты проверены
            </label>
            <Field label="Комментарий"><textarea name="comments" className="input" /></Field>
            <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2 mt-1">
              Сохранить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
