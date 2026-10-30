import { listAtmIssues } from "@/lib/atm-issues";
import { formatTashkentDateTime } from "@/lib/tz";

export const dynamic = "force-dynamic";

/**
 * Единый список заявок "ATMs with problem" (объединяет то, что раньше
 * было в двух разных разделах — /problem-atms и /no-id-reports). Старые
 * страницы оставлены нетронутыми для истории, здесь — все новые заявки.
 */
export default async function AtmIssuesPage() {
  const issues = listAtmIssues();
  const unresolved = issues.filter((i) => i.status !== "Разобран");

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Банкоматы с проблемой</h1>
      <p className="text-sm text-neutral-500 mb-6 max-w-2xl">
        Единая форма из Mini App — не работает, нет наклейки, нет чека, сломана дверь и другие причины.
        Доступна сотрудникам сразу с главного экрана, без предварительного отчёта об очистке.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Всего</div>
          <div className="text-xl font-mono">{issues.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Не разобрано</div>
          <div className="text-xl font-mono text-st-red">{unresolved.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Разобрано</div>
          <div className="text-xl font-mono text-st-green">{issues.length - unresolved.length}</div>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Пока нет заявок.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {issues.map((issue) => {
            let photos: string[] = [];
            if (issue.photosJson) {
              try {
                photos = JSON.parse(issue.photosJson);
              } catch {
                /* ignore */
              }
            }
            return (
              <div key={issue.id} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-wrap gap-1">
                    {issue.reasons.map((r) => (
                      <span key={r} className="text-[11px] bg-st-orange/10 text-st-orange rounded-full px-2 py-0.5">
                        {r}
                      </span>
                    ))}
                  </div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-0.5 ${
                      issue.status === "Разобран" ? "bg-st-green/10 text-st-green" : "bg-st-red/10 text-st-red"
                    }`}
                  >
                    {issue.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-ink mb-1">
                  {issue.atmCode || "без ID"} {issue.address && `— ${issue.address}`}
                </div>
                <div className="text-[12px] text-neutral-500 mb-1">
                  {issue.employeeName} · {formatTashkentDateTime(issue.createdAt)}
                </div>
                {issue.otherText && <div className="text-[12px] text-neutral-600">«{issue.otherText}»</div>}
                {issue.comment && <div className="text-[12px] text-neutral-600 mb-2">Комментарий: «{issue.comment}»</div>}
                {issue.lastNotifyResult && (
                  <div className="text-[11px] text-neutral-400 mb-2">{issue.lastNotifyResult}</div>
                )}
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-1">
                    {photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p} alt="" className="w-full h-16 object-cover rounded" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
