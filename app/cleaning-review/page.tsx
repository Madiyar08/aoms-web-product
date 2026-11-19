import { listCleaningReports } from "@/lib/cleaning-reports";
import { formatTashkentDateTime } from "@/lib/tz";
import CleaningReportReview from "@/components/cleaning-report-review";
export const dynamic = "force-dynamic";
export default function CleaningReviewPage() {
  const reports = listCleaningReports().filter(r => !r.approvalStatus || r.approvalStatus === "pending").sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return <div>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="mb-1 font-display text-2xl font-medium text-ink">Проверка отчётов очистки</h1><p className="text-sm text-neutral-500">Утверждённые отчёты учитываются в KPI. Новые отчёты ожидают решения руководителя.</p></div><div className="rounded-lg border border-line bg-white px-4 py-2 text-sm">Ожидают проверки: <b>{reports.length}</b></div></div>
    {reports.length === 0 ? <div className="rounded-xl border border-line bg-white p-8 text-center text-sm text-neutral-500">Нет отчётов, ожидающих проверки.</div> : <div className="space-y-3">{reports.map(r => { let photos: string[] = []; try { photos = JSON.parse(r.photosJson || "[]"); } catch { if (r.photoData) photos = [r.photoData]; } return <article key={r.id} className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{r.atmCode || "Без ID"}</b><span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">Ожидает проверки</span></div>
      <div className="mt-2 text-xs text-neutral-500">{r.employeeName} · {formatTashkentDateTime(r.clientTime)} · GPS {r.gpsQuality || "не указан"} · {r.inRoute ? "В маршруте" : "Вне маршрута"}</div>
      {r.antifraudFlags?.length > 0 && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Флаги: {r.antifraudFlags.join("; ")}</div>}
      {r.locationComment && <p className="mt-2 text-sm text-neutral-700">{r.locationComment}</p>}
      {photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((url,i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Фото отчёта ${i+1}`} className="h-28 w-full rounded-lg object-cover" /></a>)}</div>}
      <CleaningReportReview id={r.id} />
    </article>; })}</div>}
  </div>;
}
