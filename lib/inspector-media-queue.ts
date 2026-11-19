import { insertRow, readAll, updateRow, withTransaction } from "./db";
import { nowIso } from "./entity";
import { getInspectorReportById, updateInspectorReport } from "./inspector-reports";
import { archivePhotoToTelegram, archiveInspectorVideoToTelegram, deleteLocalPhotoFile, isPhotoFileUrl } from "./photo-storage";
import { buildInspectorMediaItems, buildPersistedInspectorMediaState, inspectorMediaRetryDelay, type MediaItem } from "./inspector-media-queue-core";
export { buildInspectorMediaItems, inspectorMediaRetryDelay } from "./inspector-media-queue-core";


const TABLE = "inspector_media_queue";
const MAX_ATTEMPTS = 12;
const LEASE_MS = 3 * 60_000;


export interface InspectorMediaJob {
  id: string;
  reportId: string;
  items: MediaItem[];
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lockedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function enqueueInspectorMediaArchive(reportId: string): InspectorMediaJob | null {
  const report = getInspectorReportById(reportId);
  if (!report) return null;
  const photos = (() => { try { const value = JSON.parse(report.photosJson || "[]"); return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; } catch { return []; } })();
  const items = buildInspectorMediaItems(photos, report.videoUrl || "");
  if (!items.length) return null;
  return withTransaction(() => {
    const id = `inspector_media_${reportId}`;
    const existing = readAll<InspectorMediaJob>(TABLE).find((job) => job.id === id);
    if (existing) return existing;
    const now = nowIso();
    const job: InspectorMediaJob = { id, reportId, items, status: "pending", attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now };
    insertRow(TABLE, job);
    return job;
  });
}

function claimNext(): InspectorMediaJob | null {
  return withTransaction(() => {
    const now = Date.now();
    for (const job of readAll<InspectorMediaJob>(TABLE).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const expired = job.status === "processing" && !!job.lockedAt && now - Date.parse(job.lockedAt) > LEASE_MS;
      const due = job.status === "pending" && Date.parse(job.nextAttemptAt) <= now;
      if (!expired && !due) continue;
      const claimed = { ...job, status: "processing" as const, lockedAt: nowIso(), updatedAt: nowIso() };
      if (updateRow(TABLE, job.id, claimed)) return claimed;
    }
    return null;
  });
}

function persistItem(job: InspectorMediaJob, index: number, archivedUrl: string): InspectorMediaJob {
  let sourceUrl = "";
  const updated = withTransaction(() => {
    const report = getInspectorReportById(job.reportId);
    if (!report) throw new Error(`Инспекторский отчёт ${job.reportId} не найден`);
    const latestJob = readAll<InspectorMediaJob>(TABLE).find((entry) => entry.id === job.id);
    if (!latestJob) throw new Error(`Задание архивации ${job.id} не найдено`);
    const item = latestJob.items[index];
    if (!item) throw new Error("Элемент очереди медиа не найден");
    if (item.completedAt || item.archivedUrl) return latestJob;

    sourceUrl = item.sourceUrl;
    const state = buildPersistedInspectorMediaState(report, latestJob, index, archivedUrl, nowIso());
    if (!updateInspectorReport(report.id, state.reportPatch)) {
      throw new Error("Не удалось сохранить ссылку на архив в инспекторском отчёте");
    }
    const nextJob = { ...latestJob, items: state.items, updatedAt: nowIso() };
    if (!updateRow<InspectorMediaJob>(TABLE, job.id, nextJob)) {
      throw new Error("Не удалось сохранить состояние очереди архивации");
    }
    return nextJob;
  });

  // The report and queue now point to the Telegram archive in one committed
  // transaction. Local media can be removed only after that commit succeeds.
  if (sourceUrl) deleteLocalPhotoFile(sourceUrl);
  return updated;
}

async function processJob(initial: InspectorMediaJob): Promise<void> {
  let job = initial;
  const report = getInspectorReportById(job.reportId);
  if (!report) throw new Error(`Инспекторский отчёт ${job.reportId} не найден`);
  for (let i = 0; i < job.items.length; i++) {
    const item = job.items[i];
    if (item.completedAt || item.archivedUrl) continue;
    const caption = `Инспекторский отчёт ${report.atmCode || report.atmName || report.id} · ${item.kind === "photo" ? "фото" : "видео"}`;
    const archivedUrl = item.kind === "photo"
      ? await archivePhotoToTelegram(item.sourceUrl, caption, false)
      : await archiveInspectorVideoToTelegram(item.sourceUrl, caption);
    if (!archivedUrl) throw new Error(`Telegram не подтвердил архивирование ${item.kind === "photo" ? "фото" : "видео"} ${i + 1}`);
    job = persistItem(job, i, archivedUrl);
  }
  updateRow<InspectorMediaJob>(TABLE, job.id, { ...job, status: "completed", lockedAt: undefined, lastError: undefined, updatedAt: nowIso() });
}

let running = false;
export async function processInspectorMediaQueueBatch(limit = 2): Promise<{ processed: number; failed: number }> {
  if (running) return { processed: 0, failed: 0 };
  running = true;
  let processed = 0;
  let failed = 0;
  try {
    for (let i = 0; i < limit; i++) {
      const job = claimNext();
      if (!job) break;
      const heartbeat = setInterval(() => {
        const current = readAll<InspectorMediaJob>(TABLE).find((entry) => entry.id === job.id);
        if (current?.status === "processing") updateRow<InspectorMediaJob>(TABLE, job.id, { ...current, lockedAt: nowIso(), updatedAt: nowIso() });
      }, 30_000);
      try {
        await processJob(job);
        processed++;
      } catch (error) {
        failed++;
        const latest = readAll<InspectorMediaJob>(TABLE).find((entry) => entry.id === job.id) || job;
        const attempts = latest.attempts + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        const delay = inspectorMediaRetryDelay(attempts);
        updateRow<InspectorMediaJob>(TABLE, job.id, {
          ...latest, status: terminal ? "failed" : "pending", attempts,
          nextAttemptAt: new Date(Date.now() + delay).toISOString(), lockedAt: undefined,
          lastError: error instanceof Error ? error.message : String(error), updatedAt: nowIso(),
        });
        console.error(`[inspector-media-queue] job=${job.id} attempt=${attempts}/${MAX_ATTEMPTS}`, error);
      } finally {
        clearInterval(heartbeat);
      }
    }
  } finally { running = false; }
  return { processed, failed };
}

export function getInspectorMediaQueueStats() {
  const jobs = readAll<InspectorMediaJob>(TABLE);
  return { pending: jobs.filter((j) => j.status === "pending").length, processing: jobs.filter((j) => j.status === "processing").length, completed: jobs.filter((j) => j.status === "completed").length, failed: jobs.filter((j) => j.status === "failed").length, total: jobs.length };
}
