export type MediaItem = { kind: "photo" | "video"; sourceUrl: string; archivedUrl?: string; completedAt?: string };

export function buildInspectorMediaItems(photos: string[], videoUrl: string): MediaItem[] {
  return [
    ...photos.filter((url) => /^\/api\/photos\/[^/]+$/.test(url) && !url.includes("/tg_")).map((sourceUrl) => ({ kind: "photo" as const, sourceUrl })),
    ...(videoUrl && /^\/api\/photos\/[^/]+$/.test(videoUrl) && !videoUrl.includes("/tgvideo_") && !videoUrl.includes("/tg_") ? [{ kind: "video" as const, sourceUrl: videoUrl }] : []),
  ];
}

export function inspectorMediaRetryDelay(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(Number.isFinite(attempt) ? attempt : 1));
  return Math.min(30 * 60_000, 10_000 * 2 ** Math.min(safeAttempt - 1, 12));
}


/** Build the report + queue state that must be committed atomically after Telegram confirms an item. */
export function buildPersistedInspectorMediaState<T extends { photosJson: string; videoUrl: string }, J extends { items: MediaItem[] }>(
  report: T,
  job: J,
  index: number,
  archivedUrl: string,
  completedAt: string,
): { reportPatch: Partial<T>; items: MediaItem[] } {
  const item = job.items[index];
  if (!item) throw new Error("Элемент очереди медиа не найден");
  if (!archivedUrl || !/^\/api\/photos\/(?:tg_|tgvideo_)[^/]+$/.test(archivedUrl)) {
    throw new Error("Telegram вернул некорректную ссылку архива");
  }

  let reportPatch: Partial<T>;
  if (item.kind === "photo") {
    let photos: unknown;
    try { photos = JSON.parse(report.photosJson || "[]"); }
    catch { throw new Error("Некорректный список фотографий отчёта"); }
    if (!Array.isArray(photos) || !photos.every((value) => typeof value === "string")) {
      throw new Error("Некорректный список фотографий отчёта");
    }
    const photoIndex = photos.indexOf(item.sourceUrl);
    if (photoIndex < 0 && !photos.includes(archivedUrl)) {
      throw new Error("Исходная фотография больше не связана с отчётом");
    }
    if (photoIndex >= 0) photos[photoIndex] = archivedUrl;
    reportPatch = { photosJson: JSON.stringify(photos) } as Partial<T>;
  } else {
    if (report.videoUrl !== item.sourceUrl && report.videoUrl !== archivedUrl) {
      throw new Error("Исходное видео больше не связано с отчётом");
    }
    reportPatch = { videoUrl: archivedUrl } as Partial<T>;
  }

  const items = job.items.map((entry, itemIndex) => itemIndex === index
    ? { ...entry, archivedUrl, completedAt }
    : entry);
  return { reportPatch, items };
}
