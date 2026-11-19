"use client";
import { useState } from "react";
export default function CleaningReportReview({ id }: { id: string }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function decide(status: "approved" | "rejected") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/cleaning-reports/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось сохранить решение");
      setMessage(status === "approved" ? "Отчёт утверждён" : "Отчёт отклонён");
      window.location.reload();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Ошибка"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 border-t border-line pt-3">
    <label className="block text-xs text-neutral-500">Комментарий руководителя
      <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" placeholder="Причина отклонения или примечание (необязательно)" />
    </label>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button disabled={busy} onClick={() => decide("approved")} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Утвердить</button>
      <button disabled={busy} onClick={() => decide("rejected")} className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Отклонить</button>
      {message && <span role="status" className="text-xs text-neutral-500">{message}</span>}
    </div>
  </div>;
}
