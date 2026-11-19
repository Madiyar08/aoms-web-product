"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importExcelAction } from "./actions";
import type { ImportSummary } from "@/lib/excel-import";
import { importIssueSummary } from "@/lib/import-diagnostics";

function SubmitButton({ confirm = false }: { confirm?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brass text-white text-sm font-semibold rounded-md py-2 px-5 disabled:opacity-50"
    >
      {pending ? (confirm ? "Сохраняем…" : "Проверяем…") : (confirm ? "Подтвердить импорт" : "Проверить файл")}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useFormState(importExcelAction, null);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="file"
          name="file"
          accept=".xlsx"
          required
          className="text-sm border border-line rounded-md px-3 py-2 bg-white"
        />
        {state && "mode" in state && state.mode === "preview" && state.summary.duplicateCodesInFile.length === 0 && state.summary.duplicateCodesInDatabase.length === 0 ? (
          <>
            <input type="hidden" name="confirm" value="yes" />
            <input type="hidden" name="expectedHash" value={state.fileHash} />
            <SubmitButton confirm />
          </>
        ) : <SubmitButton />}
      </form>

      {state && "error" in state && (
        <div className="bg-st-red-bg text-st-red text-sm rounded-lg p-4">{state.error}</div>
      )}

      {state && "mode" in state && state.mode === "preview" && (state.summary.duplicateCodesInFile.length > 0 || state.summary.duplicateCodesInDatabase.length > 0) && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <b>Импорт заблокирован из-за повторяющихся ID.</b>
          <p className="mt-1">Сначала устраните дубли в исходном файле или базе. Подтверждение импорта недоступно, чтобы не обновить неправильную запись.</p>
        </div>
      )}
      {state && "mode" in state && state.mode === "preview" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Предварительная проверка завершена. Данные в базе не изменены.</b>
          <p className="mt-1">Файл: {state.fileName}. Чтобы подтвердить импорт, повторно выберите этот же файл и нажмите «Подтвердить импорт».</p>
        </div>
      )}
      {state && "mode" in state && <ImportResult summary={state.summary} title={state.mode === "preview" ? "Предварительный результат" : "Результат импорта"} /> }
    </div>
  );
}

function ImportResult({ summary, title }: { summary: ImportSummary; title: string }) {
  return (
    <div className="bg-white border border-line rounded-[10px] p-5">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Обработано строк" value={summary.totalRows} />
        <Stat label="Создано новых" value={summary.created} good />
        <Stat label="Обновлено" value={summary.updated} good />
        <Stat label="Без ID" value={summary.withoutId} warn />
        <Stat label="Пропущено (без координат)" value={summary.skippedNoCoords} warn />
        <Stat label="Пустых строк" value={summary.skippedEmptyRow} />
      </div>
      {summary.regionsFound.length > 0 && (
        <div className="mb-4">
          <p className="text-[11.5px] font-semibold text-neutral-500 mb-2">Найдено регионов ({summary.regionsFound.length}):</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.regionsFound.map((region) => (
              <span key={region} className="text-[11px] bg-route-bg text-route px-2 py-1 rounded">{region}</span>
            ))}
          </div>
        </div>
      )}

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

      {(summary.duplicateCodesInFile.length > 0 || summary.duplicateCodesInDatabase.length > 0) && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <b>Повторяющиеся ID — импорт нельзя подтверждать</b>
          {summary.duplicateCodesInFile.length > 0 && <p className="mt-1">В файле: {summary.duplicateCodesInFile.join(", ")}</p>}
          {summary.duplicateCodesInDatabase.length > 0 && <p className="mt-1">В базе: {summary.duplicateCodesInDatabase.join(", ")}</p>}
        </div>
      )}

      {summary.rowIssues.length > 0 && (() => {
        const counts = importIssueSummary(summary.rowIssues);
        return (
          <section className="mt-5 border-t border-line pt-4" aria-label="Замечания к строкам Excel">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-semibold text-ink">Проверка строк файла</h4>
                <p className="text-xs text-neutral-500 mt-1">Показываем до 100 замечаний с номерами строк исходного Excel.</p>
              </div>
              <div className="flex gap-2 text-xs">
                {counts.errors > 0 && <span className="rounded-full bg-red-50 text-red-700 px-2.5 py-1">Ошибки: {counts.errors}</span>}
                {counts.warnings > 0 && <span className="rounded-full bg-amber-50 text-amber-800 px-2.5 py-1">Предупреждения: {counts.warnings}</span>}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs min-w-[620px]">
                <thead className="bg-neutral-50 text-neutral-500 text-left">
                  <tr><th className="px-3 py-2 font-medium">Строка</th><th className="px-3 py-2 font-medium">ID</th><th className="px-3 py-2 font-medium">Адрес</th><th className="px-3 py-2 font-medium">Проверка</th></tr>
                </thead>
                <tbody>
                  {summary.rowIssues.map((issue, index) => (
                    <tr key={`${issue.rowNumber}-${issue.reason}-${index}`} className="border-t border-line align-top">
                      <td className="px-3 py-2 tabular-nums text-neutral-500">{issue.rowNumber}</td>
                      <td className="px-3 py-2 font-medium text-ink">{issue.code || "—"}</td>
                      <td className="px-3 py-2 text-neutral-600 max-w-[220px]">{issue.address || "—"}</td>
                      <td className="px-3 py-2"><span className={issue.severity === "error" ? "text-red-700" : "text-amber-800"}>{issue.severity === "error" ? "Ошибка" : "Предупреждение"}</span><p className="text-neutral-600 mt-0.5">{issue.reason}</p></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.rowIssuesTruncated && <p className="text-xs text-amber-800 mt-2">Список ограничен первыми 100 замечаниями. Исправьте файл и выполните проверку повторно.</p>}
          </section>
        );
      })()}

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
