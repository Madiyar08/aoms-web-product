import { listProblemReports, PROBLEM_REASONS } from "@/lib/problem-atms";
import { listAtms } from "@/lib/atms";
import { formatTashkentDateTime } from "@/lib/tz";
import {
  createProblemReportAction,
  deleteProblemReportAction,
  resolveProblemReportAction,
  sendToTechnicianAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ProblemAtmsPage() {
  const reports = [...listProblemReports()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const atms = listAtms();
  const atmById = new Map(atms.map((a) => [a.id, a]));

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Проблемные банкоматы</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Физические неисправности — причина, комментарий, передача техническому специалисту в Telegram.
      </p>

      <div className="grid grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-3">
          {reports.length === 0 ? (
            <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
              Проблемных банкоматов пока нет.
            </div>
          ) : (
            reports.map((r) => {
              const atm = atmById.get(r.atmId);
              const coordinates = atm ? `${atm.latitude}, ${atm.longitude}` : "";
              const dateTime = formatTashkentDateTime(r.createdAt);
              return (
                <div key={r.id} className="bg-white border border-line rounded-[10px] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-ink">
                      {atm?.name ?? "банкомат удалён"}{" "}
                      <span className="font-mono text-[11px] text-neutral-500">{atm?.code}</span>
                    </h4>
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded ${
                        r.status === "Решён"
                          ? "bg-route-bg text-route"
                          : r.status === "Передан технику"
                          ? "bg-st-amber-bg text-st-amber"
                          : "bg-st-red-bg text-st-red"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-neutral-500 mb-1">{atm?.address}</p>
                  <p className="text-[12.5px] text-ink mb-1">
                    <b>Причина:</b> {r.reason}
                  </p>
                  {r.comment && <p className="text-[12px] text-neutral-500 mb-2">{r.comment}</p>}
                  {r.photoUrl && (
                    <img
                      src={r.photoUrl}
                      alt="Фото неисправности"
                      className="w-24 h-24 object-cover rounded-md border border-line mb-2"
                    />
                  )}
                  <p className="text-[11px] text-neutral-400 mb-3">
                    {dateTime} · сообщил: {r.reportedBy}
                  </p>
                  {r.lastNotifyResult && (
                    <p className="text-[11px] text-neutral-400 mb-2">{r.lastNotifyResult}</p>
                  )}
                  <div className="flex gap-2">
                    {r.status !== "Решён" && (
                      <form
                        action={async () => {
                          "use server";
                          await sendToTechnicianAction(
                            r.id,
                            atm?.code || "",
                            atm?.address || "",
                            coordinates,
                            r.reason,
                            r.reportedBy,
                            dateTime
                          );
                        }}
                      >
                        <button className="text-xs font-semibold bg-brass text-white rounded-md px-3 py-1.5">
                          Передать технику
                        </button>
                      </form>
                    )}
                    {r.status !== "Решён" && (
                      <form action={async () => { "use server"; await resolveProblemReportAction(r.id); }}>
                        <button className="text-xs font-semibold border border-line rounded-md px-3 py-1.5 bg-white">
                          Отметить решённым
                        </button>
                      </form>
                    )}
                    <form action={async () => { "use server"; await deleteProblemReportAction(r.id); }}>
                      <button className="text-xs text-st-red">Удалить</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="bg-white border border-line rounded-[10px] p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Сообщить о проблеме</h3>
          <form action={createProblemReportAction} className="flex flex-col gap-3">
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">ID банкомата</span>
              <input name="atmCode" list="atm-options" required className="input" placeholder="Начните вводить ID" />
              <datalist id="atm-options">
                {atms.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="block text-[11.5px] font-semibold text-neutral-500 mb-1">Причина</span>
              <select name="reason" required className="input">
                <option value="">— выберите —</option>
                {PROBLEM_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <textarea name="comment" placeholder="Комментарий" className="input" />
            <input name="reportedBy" placeholder="Кто сообщил" className="input" defaultValue="Руководитель" />
            <button type="submit" className="bg-brass text-white text-sm font-semibold rounded-md py-2">
              Зарегистрировать проблему
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
