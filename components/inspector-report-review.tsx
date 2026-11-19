"use client";

import { useState } from "react";

type Status = "Новый" | "На рассмотрении" | "Закрыт";
export default function InspectorReportReview({ id, initialStatus, initialComment }: { id: string; initialStatus: Status; initialComment: string }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [comment, setComment] = useState(initialComment);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/inspector-reports/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, managerComment: comment }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось сохранить изменения");
      setMessage("Сохранено");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка сохранения"); }
    finally { setBusy(false); }
  }

  return <div className="mt-4 border-t border-line pt-3">
    <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
      <label className="text-xs text-neutral-500">Статус проверки
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink">
          <option>Новый</option><option>На рассмотрении</option><option>Закрыт</option>
        </select>
      </label>
      <label className="text-xs text-neutral-500">Комментарий руководителя
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={4000} rows={2} placeholder="Результат проверки или поручение" className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" />
      </label>
    </div>
    <div className="mt-2 flex items-center gap-3"><button type="button" onClick={save} disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить проверку"}</button>{message && <span role="status" className="text-xs text-neutral-500">{message}</span>}</div>
  </div>;
}
