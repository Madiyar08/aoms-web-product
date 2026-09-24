"use client";

import { useState, useEffect } from "react";

function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

export function StorageCleanupClient() {
  const [stats, setStats] = useState<{ totalBytes: number; totalCount: number; largeCount: number; largeBytes: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; freedBytes: number } | null>(null);
  const [deleteDays, setDeleteDays] = useState("180");
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadStats() {
    setLoadingStats(true);
    const res = await fetch("/api/photos-storage/stats");
    const data = await res.json();
    setStats(data);
    setLoadingStats(false);
  }

  useEffect(() => {
    loadStats();
  }, []);

  async function runCompression() {
    setCompressing(true);
    setProgress({ processed: 0, freedBytes: 0 });
    let totalProcessed = 0;
    let totalFreed = 0;
    // Обрабатываем пачками по 30, пока сервер не скажет "больше нечего" —
    // это безопаснее одного огромного запроса на тысячах файлов.
    while (true) {
      const res = await fetch("/api/photos-storage/recompress", { method: "POST" });
      const data = await res.json();
      if (!data.ok || data.processed === 0) break;
      totalProcessed += data.processed;
      totalFreed += data.bytesBefore - data.bytesAfter;
      setProgress({ processed: totalProcessed, freedBytes: totalFreed });
      if (data.remaining === 0) break;
    }
    setCompressing(false);
    await loadStats();
  }

  async function runDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await fetch("/api/photos-storage/delete-old", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(deleteDays) }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeleteResult(`Удалено ${data.deleted} фото, освобождено ${fmtMB(data.freedBytes)}`);
        await loadStats();
      } else {
        setDeleteResult(data.error || "Ошибка");
      }
    } catch {
      setDeleteResult("Ошибка сети");
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-line rounded-[10px] p-5 mb-6">
        <h2 className="text-sm font-semibold text-ink mb-3">Текущее состояние</h2>
        {loadingStats ? (
          <p className="text-sm text-neutral-400">Считаю…</p>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-neutral-500">Всего фото</div>
              <div className="text-lg font-mono">{stats.totalCount}</div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500">Занимают места</div>
              <div className="text-lg font-mono">{fmtMB(stats.totalBytes)}</div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500">Крупных (кандидаты)</div>
              <div className="text-lg font-mono text-st-orange">
                {stats.largeCount} ({fmtMB(stats.largeBytes)})
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-st-green/30 rounded-[10px] p-5 mb-6">
        <h2 className="text-sm font-semibold text-st-green mb-1">1. Пережать существующие фото (рекомендуется)</h2>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          Уменьшает размер уже сохранённых фото (как новые — до 1600 px, JPEG 75%). Ничего не удаляется,
          все фото остаются доступными. Обычно освобождает 80–95% места. Безопасно запускать повторно —
          уже пережатые файлы пропускаются.
        </p>
        <button
          onClick={runCompression}
          disabled={compressing}
          className="text-xs font-semibold bg-st-green text-white rounded-md px-4 py-2 disabled:opacity-50"
        >
          {compressing ? "Пережимаю…" : "Пережать все крупные фото"}
        </button>
        {progress && (
          <p className="text-[12px] text-neutral-600 mt-3">
            Обработано: {progress.processed} фото · Освобождено: {fmtMB(progress.freedBytes)}
          </p>
        )}
      </div>

      <div className="bg-white border border-st-red/30 rounded-[10px] p-5">
        <h2 className="text-sm font-semibold text-st-red mb-1">2. Удалить старые фото (крайняя мера)</h2>
        <p className="text-[12.5px] text-neutral-500 mb-3">
          Безвозвратно удаляет файлы фото старше указанного числа дней. Записи отчётов останутся в системе,
          но фото открыть будет нельзя. Используйте, только если пережатия (пункт 1) не хватило.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12.5px]">Удалить фото старше</span>
          <input
            type="number"
            value={deleteDays}
            onChange={(e) => {
              setDeleteDays(e.target.value);
              setConfirmDelete(false);
            }}
            min={30}
            className="input !w-20"
          />
          <span className="text-[12.5px]">дней</span>
        </div>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs font-semibold border border-st-red text-st-red rounded-md px-4 py-2"
          >
            Удалить старые фото
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={runDelete}
              disabled={deleting}
              className="text-xs font-semibold bg-st-red text-white rounded-md px-4 py-2 disabled:opacity-50"
            >
              {deleting ? "Удаляю…" : `Точно удалить фото старше ${deleteDays} дней?`}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-[12px] text-neutral-500">
              Отмена
            </button>
          </div>
        )}
        {deleteResult && <p className="text-[12px] text-neutral-600 mt-3">{deleteResult}</p>}
      </div>
    </div>
  );
}
