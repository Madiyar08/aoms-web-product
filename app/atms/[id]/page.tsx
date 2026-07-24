import Link from "next/link";
import { notFound } from "next/navigation";
import { getAtmById, verificationStatus } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { listStatuses } from "@/lib/statuses";
import { listReportsByAtm } from "@/lib/cleaning-reports";
import { formatTashkentDateTime } from "@/lib/tz";
import { updateAtmAction } from "../actions";
import { DeleteAtmButton } from "./DeleteAtmButton";

export const dynamic = "force-dynamic";

export default async function AtmDetailPage({ params }: { params: { id: string } }) {
  const atm = getAtmById(params.id);
  if (!atm) notFound();

  const categories = listCategories();
  const statuses = listStatuses();
  const v = verificationStatus(atm);
  const reports = listReportsByAtm(atm.id);

  return (
    <div>
      <Link href="/atms" className="text-[12px] text-route">
        ← Назад к банкоматам
      </Link>

      <div className="flex items-center gap-3 mt-2 mb-1">
        <span className={`inline-block w-3 h-3 rounded-full ${v.dotClass}`} />
        <h1 className="font-display text-2xl font-medium text-ink">{atm.name}</h1>
      </div>
      <p className="text-[12.5px] font-mono text-neutral-500 mb-6">
        {atm.code || "без ID"} · {v.label}
      </p>

      <form
        action={async (formData) => {
          "use server";
          await updateAtmAction(atm.id, formData);
        }}
        className="bg-white border border-line rounded-[10px] p-5 grid grid-cols-2 gap-4 max-w-3xl"
      >
        <Field label="ID банкомата">
          <input name="code" defaultValue={atm.code} className="input" />
        </Field>
        <Field label="Название">
          <input name="name" defaultValue={atm.name} required className="input" />
        </Field>
        <Field label="Адрес" full>
          <input name="address" defaultValue={atm.address} className="input" />
        </Field>
        <Field label="Район">
          <input name="district" defaultValue={atm.district} className="input" />
        </Field>
        <Field label="Источник данных">
          <input value={atm.source} disabled className="input opacity-60" />
        </Field>
        <Field label="Широта">
          <input name="latitude" defaultValue={atm.latitude} className="input" />
        </Field>
        <Field label="Долгота">
          <input name="longitude" defaultValue={atm.longitude} className="input" />
        </Field>
        <Field label="Категория">
          <select name="categoryId" defaultValue={atm.categoryId} className="input">
            <option value="">— не указана —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Статус работы">
          <select name="workStatusId" defaultValue={atm.workStatusId} className="input">
            <option value="">— не указан —</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" name="addressVerified" defaultChecked={atm.addressVerified} /> Адрес проверен
        </label>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" name="coordsVerified" defaultChecked={atm.coordsVerified} /> Координаты проверены
        </label>
        <Field label="Комментарий" full>
          <textarea name="comments" defaultValue={atm.comments} className="input" />
        </Field>

        <div className="col-span-2 flex items-center justify-between mt-2 pt-3 border-t border-line">
          <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2 px-6">
            Сохранить изменения
          </button>
          <DeleteAtmButton id={atm.id} />
        </div>
      </form>

      <div className="mt-5 max-w-3xl">
        <h2 className="font-display text-lg font-medium text-ink mb-3">
          История очисток {reports.length > 0 && `(${reports.length})`}
        </h2>
        {reports.length === 0 ? (
          <div className="bg-neutral-50 border border-line rounded-[10px] p-5 text-[12.5px] text-neutral-500">
            Пока нет ни одного отчёта об очистке по этому банкомату.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border border-line rounded-[10px] p-4 flex gap-4">
                {r.photoData ? (
                  <img
                    src={r.photoData}
                    alt="Фото очистки"
                    className="w-28 h-28 object-cover rounded-md border border-line shrink-0"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-md border border-line shrink-0 flex items-center justify-center text-[11px] text-neutral-400 text-center p-2">
                    Фото отсутствует
                  </div>
                )}
                <div className="text-[12.5px] flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.employeeName}</span>
                    <span className="text-neutral-400">{formatTashkentDateTime(r.clientTime)}</span>
                  </div>
                  <div className="mt-1 text-neutral-600">
                    Статус на месте: <b>{r.reportedWorkStatusName || "не указан"}</b>
                  </div>
                  <div className="text-neutral-600">
                    Адрес верный: {r.addressCorrect ? "да" : "нет"} · Координаты верные:{" "}
                    {r.coordsCorrect ? "да" : "нет"}
                    {r.locationComment && ` — ${r.locationComment}`}
                  </div>
                  <div className="text-neutral-600">
                    В маршруте: {r.inRoute ? "да" : "нет (внеочередная)"} · Расстояние GPS:{" "}
                    {Number.isNaN(r.distanceMeters) ? "не проверено" : `${r.distanceMeters} м`}
                  </div>
                  {r.codeMismatch && (
                    <div className="text-red-600 mt-1">
                      ⚠️ Введён код «{r.enteredCode}», не совпал с ID банкомата
                    </div>
                  )}
                  {r.antifraudFlags.length > 0 && (
                    <div className="text-st-orange mt-1">⚠️ {r.antifraudFlags.join("; ")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11.5px] text-neutral-400 mt-3">
          Последнее изменение записи банкомата: {formatTashkentDateTime(atm.updatedAt)}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
