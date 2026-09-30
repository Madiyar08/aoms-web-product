"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importExcelAction } from "./actions";
import type { ImportSummary } from "@/lib/excel-import";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brass text-white text-sm font-semibold rounded-md py-2 px-5 disabled:opacity-50"
    >
      {pending ? "Импортируем…" : "Загрузить и импортировать"}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useFormState(importExcelAction, null);

  return (
    <div>
      <form action={formAction} className="flex items-center gap-3 mb-5">
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="text-sm border border-line rounded-md px-3 py-2 bg-white"
        />
        <SubmitButton />
      </form>

      {state && "error" in state && (
        <div className="bg-st-red-bg text-st-red text-sm rounded-lg p-4">{state.error}</div>
      )}

      {state && "created" in state && <ImportResult summary={state} />}
    </div>
  );
}

function ImportResult({ summary }: { summary: ImportSummary }) {
  return (
    <div className="bg-white border border-line rounded-[10px] p-5">
      <h3 className="text-sm font-semibold text-ink mb-3">Результат импорта</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Обработано строк" value={summary.totalRows} />
        <Stat label="Создано новых" value={summary.created} good />
        <Stat label="Обновлено" value={summary.updated} good />
        <Stat label="Без ID" value={summary.withoutId} warn />
        <Stat label="Пропущено (без координат)" value={summary.skippedNoCoords} warn />
        <Stat label="Пустых строк" value={summary.skippedEmptyRow} />
      </div>
      {summary.districtsFound.length > 0 && (
        <div>
          <p className="text-[11.5px] font-semibold text-neutral-500 mb-2">
            Найдено районов ({summary.districtsFound.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.districtsFound.map((d) => (
              <span key={d} className="text-[11px] bg-route-bg text-route px-2 py-1 rounded">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {(summary.categoryColumnFound || summary.statusColumnFound || summary.verifiedColumnsFound) && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-[11.5px] font-semibold text-neutral-500 mb-2">Из дополнительных колонок:</p>
          <div className="flex flex-wrap gap-3 text-[12px]">
            {summary.categoryColumnFound && (
              <span className="text-route">Категорий назначено: {summary.categoriesAssigned}</span>
            )}
            {summary.statusColumnFound && (
              <span className="text-route">Статусов назначено: {summary.statusesAssigned}</span>
            )}
            {summary.verifiedColumnsFound && (
              <span className="text-neutral-500">Колонки «проверено» распознаны ✓</span>
            )}
          </div>

          {summary.unmatchedCategoryNames.length > 0 && (
            <div className="mt-3 bg-st-orange-bg text-st-orange text-[11.5px] rounded-lg p-3">
              Эти названия категорий не совпали ни с одной существующей и были пропущены:{" "}
              <b>{summary.unmatchedCategoryNames.join(", ")}</b>. Сначала создайте такие категории на
              странице «Банкоматы» (вкладка категорий) или исправьте написание в Excel — регистр не важен,
              но название должно совпадать.
            </div>
          )}
          {summary.unmatchedStatusNames.length > 0 && (
            <div className="mt-2 bg-st-orange-bg text-st-orange text-[11.5px] rounded-lg p-3">
              Эти названия статусов не совпали и были пропущены: <b>{summary.unmatchedStatusNames.join(", ")}</b>.
            </div>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-neutral-400 mt-4">
        Если в файле не было колонок категории/статуса — новые банкоматы получают статус «Новый банкомат»
        (или «Без ID») и не помечаются проверенными. Добавьте колонки в Excel и переимпортируйте, чтобы
        заполнить всё разом.
      </p>
    </div>
  );
}

function Stat({ label, value, good, warn }: { label: string; value: number; good?: boolean; warn?: boolean }) {
  const color = good ? "text-route" : warn ? "text-st-orange" : "text-ink";
  return (
    <div className="bg-neutral-50 rounded-lg p-3">
      <div className="text-[11px] text-neutral-500 mb-1">{label}</div>
      <div className={`font-display text-xl ${color}`}>{value}</div>
    </div>
  );
}
