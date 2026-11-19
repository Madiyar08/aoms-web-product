import { listDeliveryJobs, getDeliveryQueueStats } from "@/lib/delivery-queue";
import { RetryButton } from "./retry-button";
export const dynamic = "force-dynamic";
export default function DeliveryQueuePage() {
  const stats = getDeliveryQueueStats();
  const jobs = listDeliveryJobs().slice(0, 100);
  return <div>
    <div className="mb-6"><h1 className="font-display text-2xl font-medium text-ink">Очередь Telegram-доставки</h1>
      <p className="text-sm text-neutral-500 mt-1">Отчёты уже сохранены в SQLite. Здесь отображается доставка уведомлений и архивирование фотографий.</p></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Stat label="Всего" value={stats.total}/><Stat label="Ожидают" value={stats.pending}/><Stat label="В обработке" value={stats.processing}/><Stat label="Завершено" value={stats.completed}/><Stat label="Ошибки" value={stats.failed}/>
    </div>
    <div className="bg-white border border-line rounded-[10px] overflow-hidden">
      <table className="w-full text-[12px]"><thead><tr className="text-left text-neutral-500 border-b border-line"><th className="p-3">Создано</th><th className="p-3">Отчёт</th><th className="p-3">Статус</th><th className="p-3">Попытки</th><th className="p-3">Последняя ошибка</th><th className="p-3"></th></tr></thead>
        <tbody>{jobs.map((job) => <tr key={job.id} className="border-b border-line last:border-0"><td className="p-3">{new Date(job.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}</td><td className="p-3 font-mono">{job.reportId}</td><td className="p-3">{job.status}</td><td className="p-3">{job.attempts}</td><td className="p-3 max-w-[420px] break-words text-st-red">{job.lastError || "—"}</td><td className="p-3">{job.status === "failed" ? <RetryButton id={job.id}/> : "—"}</td></tr>)}</tbody>
      </table>
      {jobs.length === 0 && <p className="p-6 text-sm text-neutral-400">Задач пока нет.</p>}
    </div>
    <p className="text-xs text-neutral-400 mt-3">Показываются последние 100 задач. Очередь выполняется фоновым worker'ом Node.js; ошибки повторяются с увеличивающейся задержкой, максимум 12 попыток.</p>
  </div>;
}
function Stat({ label, value }: {label:string;value:number}) { return <div className="bg-white border border-line rounded-lg p-4"><div className="text-xs text-neutral-500">{label}</div><div className="font-display text-2xl mt-1">{value}</div></div>; }
