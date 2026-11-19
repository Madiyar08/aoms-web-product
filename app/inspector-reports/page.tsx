import { listInspectorReports } from "@/lib/inspector-reports";
import { formatTashkentDateTime } from "@/lib/tz";
import InspectorReportReview from "@/components/inspector-report-review";

export const dynamic = "force-dynamic";

export default function InspectorReportsPage() {
  const reports = listInspectorReports();
  const newCount = reports.filter((r) => r.status === "Новый").length;
  return <div>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div><h1 className="font-display text-2xl font-medium text-ink mb-1">Инспекторские отчёты</h1>
        <p className="text-sm text-neutral-500">Отдельный журнал проверок. Не влияет на KPI и историю уборки.</p></div>
      <div className="flex gap-3 text-xs"><span className="rounded-lg border border-line bg-white px-3 py-2">Всего: <b>{reports.length}</b></span><span className="rounded-lg border border-line bg-white px-3 py-2">Новые: <b>{newCount}</b></span></div>
    </div>
    {reports.length === 0 ? <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-neutral-400">Инспекторских отчётов пока нет.</div> :
      <div className="space-y-3">{reports.map((r) => {
        let photos: string[] = [];
        try { photos = JSON.parse(r.photosJson || "[]"); } catch { /* ignore malformed legacy data */ }
        return <article key={r.id} className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2"><div className="font-semibold text-sm">{r.atmCode || "Банкомат не указан"}{r.atmName ? ` — ${r.atmName}` : ""}</div><span className="rounded-full bg-st-orange/10 px-2 py-1 text-[11px] text-st-orange">{r.status}</span></div>
          <div className="text-xs text-neutral-500 mb-2">{r.employeeName} · {formatTashkentDateTime(r.createdAt)} · GPS: {r.gpsQuality === "good" ? "хорошее" : r.gpsQuality === "weak" ? "слабое/неполное" : "не получен"}</div>
          {r.address && <div className="text-xs text-neutral-500 mb-2">{r.address}</div>}
          <div className="text-[11px] text-neutral-400 mb-2">Уведомление: {r.notificationStatus || "статус неизвестен"}</div>
          <p className="text-sm text-ink whitespace-pre-wrap">{r.comment}</p>
          {photos.length > 0 && <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">{photos.map((p, i) => <a href={p} target="_blank" rel="noreferrer" key={`${r.id}-${i}`}><img src={p} alt={`Фото ${i + 1}`} className="h-24 w-full rounded-lg object-cover" /></a>)}</div>}
          {r.videoUrl && <div className="mt-3"><div className="text-xs font-medium mb-1">Видео инспекции</div><video src={r.videoUrl} controls preload="metadata" playsInline className="w-full max-w-xl rounded-lg bg-black" /></div>}
          {r.latitude !== null && r.longitude !== null && <div className="mt-2 text-[11px] text-neutral-400">{r.latitude}, {r.longitude} · точность {r.gpsAccuracy ?? "—"} м</div>}
          {r.reviewedAt && <div className="mt-2 text-[11px] text-neutral-400">Последняя проверка: {formatTashkentDateTime(r.reviewedAt)} · {r.reviewedBy || "Администратор"}</div>}
          {r.managerComment && <div className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm"><b>Комментарий руководителя:</b><p className="mt-1 whitespace-pre-wrap">{r.managerComment}</p></div>}
          <InspectorReportReview id={r.id} initialStatus={r.status} initialComment={r.managerComment || ""} />
        </article>;
      })}</div>}
  </div>;
}
