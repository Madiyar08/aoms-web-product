import { insertRow, readAll, updateRow, withTransaction } from "./db";
import { nowIso } from "./entity";
import { getCleaningReportById, updateCleaningReport } from "./cleaning-reports";
import { getAtmById } from "./atms";
import { archivePhotoToTelegram, deleteLocalPhotoFile, isPhotoFileUrl } from "./photo-storage";
import { notifyCleaningReportToGroup, notifyManagerReport } from "./notifications";
import { formatTashkentDateTime } from "./tz";

const TABLE = "delivery_queue";
const MAX_ATTEMPTS = 12;
const LEASE_MS = 2 *  60 * 1000;

export interface DeliveryJob {
  id: string;
  type: "cleaning_report";
  reportId: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lockedAt?: string;
  groupNotified: boolean;
  managerNotified: boolean;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function enqueueCleaningReportDelivery(reportId: string): DeliveryJob {
  return withTransaction(() => {
    const id = `cleaning_${reportId}`;
    const existing = readAll<DeliveryJob>(TABLE).find((job) => job.id === id);
    if (existing) return existing;
    const now = nowIso();
    const job: DeliveryJob = {
      id, type: "cleaning_report", reportId, status: "pending", attempts: 0,
      nextAttemptAt: now, groupNotified: false, managerNotified: false,
      createdAt: now, updatedAt: now,
    };
    insertRow(TABLE, job);
    return job;
  });
}

function claimNextJob(): DeliveryJob | null {
  // BEGIN IMMEDIATE serializes claims between multiple Railway replicas
  // sharing the same SQLite Volume; only one worker can lease a job.
  return withTransaction(() => {
    const now = Date.now();
    const jobs = readAll<DeliveryJob>(TABLE).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const job of jobs) {
      const staleProcessing = job.status === "processing" && job.lockedAt && now - Date.parse(job.lockedAt) > LEASE_MS;
      const due = job.status === "pending" && Date.parse(job.nextAttemptAt) <= now;
      if (!due && !staleProcessing) continue;
      const claimed: DeliveryJob = { ...job, status: "processing", lockedAt: nowIso(), updatedAt: nowIso() };
      if (updateRow<DeliveryJob>(TABLE, job.id, claimed)) return claimed;
    }
    return null;
  });
}

function saveJob(job: DeliveryJob, patch: Partial<DeliveryJob>): DeliveryJob {
  const latest = readAll<DeliveryJob>(TABLE).find((item) => item.id === job.id) || job;
  const updated = { ...latest, ...patch, updatedAt: nowIso() };
  updateRow<DeliveryJob>(TABLE, job.id, updated);
  return updated;
}

function getReportPhotoUrls(report: { photosJson?: string; photoData?: string }): string[] {
  if (report.photosJson) {
    try {
      const parsed = JSON.parse(report.photosJson);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string" && !!v);
    } catch { /* legacy fallback */ }
  }
  return report.photoData ? [report.photoData] : [];
}

async function processJob(initial: DeliveryJob): Promise<void> {
  let job = initial;
  const report = getCleaningReportById(job.reportId);
  if (!report) {
    saveJob(job, { status: "failed", lastError: `Cleaning report ${job.reportId} not found`, lockedAt: undefined });
    return;
  }
  const atm = report.atmId ? getAtmById(report.atmId) : null;

  if (!job.groupNotified) {
    const result = await notifyCleaningReportToGroup(report, atm);
    if (!result.ok) throw new Error(`Рабочая Telegram-группа: ${result.error || "неизвестная ошибка"}`);
    job = saveJob(job, { groupNotified: true });
  }

  if (!job.managerNotified && report.antifraudFlags?.length) {
    const accNote = report.gpsAccuracy ? ` (точность GPS: ${Math.round(Number(report.gpsAccuracy))} м)` : "";
    const result = await notifyManagerReport([
      "⚠️ <b>Антифрод: отчёт об очистке требует проверки</b>",
      `Банкомат: ${report.atmCode || "без кода"}${atm ? ` — ${atm.name}` : " (не найден в базе)"}`,
      `Сотрудник: ${report.employeeName}`,
      `Причины: ${report.antifraudFlags.join("; ")}${accNote}`,
      `Время: ${formatTashkentDateTime(new Date())}`,
    ].join("\n"));
    if (!result.ok) throw new Error(`Уведомление руководителю: ${result.error || "неизвестная ошибка"}`);
    job = saveJob(job, { managerNotified: true });
  } else if (!job.managerNotified) {
    job = saveJob(job, { managerNotified: true });
  }

  // Архивация идёт после доставки в рабочую группу. Локальные файлы
  // удаляются только после того, как Telegram file_id сохранён в SQLite.
  const urls = getReportPhotoUrls(report);
  const finalUrls = [...urls];
  for (let i = 0; i < finalUrls.length; i++) {
    const url = finalUrls[i];
    if (!isPhotoFileUrl(url) || url.includes("/tg_")) continue;
    const archivedUrl = await archivePhotoToTelegram(url, `Отчёт: ${report.atmCode || atm?.name || "банкомат"}`, false);
    if (!archivedUrl) throw new Error(`Не удалось архивировать фотографию ${i + 1}/${finalUrls.length}`);
    finalUrls[i] = archivedUrl;
    updateCleaningReport(report.id, {
      photoData: finalUrls[0] || "",
      photosJson: finalUrls.length ? JSON.stringify(finalUrls) : undefined,
    });
    deleteLocalPhotoFile(url);
  }

  saveJob(job, { status: "completed", lockedAt: undefined, lastError: undefined });
}

let running = false;
export async function processDeliveryQueueBatch(limit = 3): Promise<{ processed: number; failed: number }> {
  if (running) return { processed: 0, failed: 0 };
  running = true;
  let processed = 0;
  let failed = 0;
  try {
    for (let i = 0; i < limit; i++) {
      const job = claimNextJob();
      if (!job) break;
      const heartbeat = setInterval(() => {
        const current = readAll<DeliveryJob>(TABLE).find((item) => item.id === job.id);
        if (current?.status === "processing") {
          updateRow<DeliveryJob>(TABLE, job.id, { lockedAt: nowIso(), updatedAt: nowIso() });
        }
      }, 30_000);
      try {
        await processJob(job);
        processed++;
      } catch (error) {
        failed++;
        // processJob may already have persisted successful sub-steps. Reload
        // before recording retry metadata so we never reset those flags.
        const latest = readAll<DeliveryJob>(TABLE).find((item) => item.id === job.id) || job;
        const attempts = latest.attempts + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        const delayMs = Math.min(15 * 60_000, 5_000 * 2 ** Math.min(attempts - 1, 8));
        const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
        saveJob(latest, {
          status: terminal ? "failed" : "pending",
          attempts,
          nextAttemptAt,
          lockedAt: undefined,
          lastError: error instanceof Error ? error.message : String(error),
        });
        console.error(`[delivery-queue] job=${job.id} attempt=${attempts}/${MAX_ATTEMPTS}`, error);
      } finally {
        clearInterval(heartbeat);
      }
    }
  } finally {
    running = false;
  }
  return { processed, failed };
}

export function getDeliveryQueueStats() {
  const jobs = readAll<DeliveryJob>(TABLE);
  return {
    pending: jobs.filter((j) => j.status === "pending").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    total: jobs.length,
  };
}

export function listDeliveryJobs(): DeliveryJob[] {
  return readAll<DeliveryJob>(TABLE).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function retryFailedDeliveryJob(id: string): boolean {
  const job = readAll<DeliveryJob>(TABLE).find((item) => item.id === id);
  if (!job || job.status !== "failed") return false;
  return updateRow<DeliveryJob>(TABLE, id, {
    status: "pending", attempts: 0, nextAttemptAt: nowIso(), lockedAt: undefined, lastError: undefined, updatedAt: nowIso(),
  });
}
