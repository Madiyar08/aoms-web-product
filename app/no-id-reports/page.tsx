import { listNoIdReports } from "@/lib/no-id-reports";
import { formatTashkentDateTime } from "@/lib/tz";

export const dynamic = "force-dynamic";

export default async function NoIdReportsPage() {
  const reports = listNoIdReports();
  const unresolved = reports.filter((r) => r.status !== "Разобран");

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-ink mb-1">Банкоматы без ID</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Нештатные ситуации на месте: нет наклейки, банкомат не работает, не удалось получить чек.
        Отправляются сотрудниками из Mini App отдельно от обычных отчётов об очистке.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Всего</div>
          <div className="text-xl font-mono">{reports.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Не разобрано</div>
          <div className="text-xl font-mono text-st-red">{unresolved.length}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-4">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Разобрано</div>
          <div className="text-xl font-mono text-st-green">{reports.length - unresolved.length}</div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border border-line rounded-[10px] p-8 text-center text-neutral-400 text-sm">
          Пока нет таких отчётов.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {reports.map((r) => {
            const photos: string[] = r.photosJson ? JSON.parse(r.photosJson) : [];
            const tags = [
              r.noSticker && "Нет наклейки",
              r.notWorking && "Не работает",
              r.cantGetReceipt && "Нет чека",
              r.gotReceipt && "Чек получен",
            ].filter(Boolean) as string[];
            return (
              <div key={r.id} className="bg-white border border-line rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="text-[11px] bg-st-orange/10 text-st-orange rounded-full px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-0.5 ${
                      r.status === "Разобран" ? "bg-st-green/10 text-st-green" : "bg-st-red/10 text-st-red"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="text-sm font-medium text-ink mb-1">{r.address || "Адрес не указан"}</div>
                <div className="text-[12px] text-neutral-500 mb-1">
                  {r.employeeName} · {formatTashkentDateTime(r.createdAt)}
                </div>
                {r.comment && <div className="text-[12px] text-neutral-600 mb-2">«{r.comment}»</div>}
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
