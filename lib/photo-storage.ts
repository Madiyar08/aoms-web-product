import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DB_DIR } from "./db";
import { newId } from "./entity";

export const PHOTOS_DIR = path.join(DB_DIR, "photos");

function ensurePhotosDir(): void {
  if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

/**
 * Сохраняет фото (base64 data URL с телефона) файлом на диске — на том же
 * Volume, что и база данных, — и возвращает короткую ссылку вида
 * "/api/photos/xxxx.jpg" для хранения в БД вместо самого base64.
 *
 * Перед записью на диск фото СЖИМАЕТСЯ (sharp): уменьшается до максимум
 * 1600 px по длинной стороне и перекодируется в JPEG качеством 75%. Фото
 * с современных телефонов весят 3–8 МБ каждое; при 5 фото на отчёт и
 * многих отчётах в день Volume (постоянный диск Railway) быстро
 * заполняется — на практике это привело к 96% занятого места при
 * лимите 5 ГБ. Сжатие обычно уменьшает файл в 10–20 раз (до 150–400 КБ)
 * без заметной потери качества для целей проверки отчёта, и не меняет
 * ничего в остальной системе — на выходе всё равно JPEG-файл по той же
 * ссылке.
 */
export async function savePhotoFile(dataUrl: string): Promise<string | null> {
  // Терпимый разбор: разные телефоны/браузеры формируют data URL
  // немного по-разному (регистр, лишние параметры вроде ;charset).
  // Берём тип изображения и base64-часть максимально гибко.
  const match = /^data:image\/([a-zA-Z0-9.+-]+)[^,]*;base64,(.+)$/is.exec(dataUrl || "");
  if (!match) return null;
  const [, , base64] = match;

  const buffer = Buffer.from(base64, "base64");
  // Пустой или явно битый буфер не сохраняем — иначе Telegram потом
  // отвергнет его с IMAGE_PROCESS_FAILED.
  if (buffer.length < 100) return null;

  let outBuffer: Buffer;
  try {
    outBuffer = await sharp(buffer)
      .rotate() // учитывает EXIF-ориентацию с телефона перед изменением размера
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch (sharpError) {
    // Если sharp не смог обработать файл (повреждён/неподдерживаемый
    // формат) — сохраняем как есть, несжатым, лишь бы не терять фото.
    console.error("[photo-storage] Сжатие не удалось, сохраняем оригинал:", sharpError);
    outBuffer = buffer;
  }

  // ВАЖНО: здесь фото сохраняется ТОЛЬКО на диск (без сети) — это
  // осознанно. Раньше эта функция сама сразу пыталась загрузить фото в
  // архивный Telegram-канал внутри себя — но этот сетевой запрос
  // выполнялся ДО ответа сотруднику (все вызовы savePhotoFile в роутах —
  // await, до NextResponse.json), то есть при 5 фото на отчёт сотрудник
  // снова ждал бы несколько секунд, ровно ту проблему, которую мы уже
  // чинили (было 1-2 минуты, стало мгновенно через фоновую отправку).
  // Перенос в архив теперь отдельный шаг — archivePhotoToTelegram — и
  // вызывается только ПОСЛЕ ответа сотруднику, в фоне, вместе с
  // отправкой уведомления в группу.
  try {
    ensurePhotosDir();
    const filename = `${newId()}.jpg`;
    fs.writeFileSync(path.join(PHOTOS_DIR, filename), outBuffer);
    return `/api/photos/${filename}`;
  } catch (e) {
    console.error("[photo-storage] Не удалось сохранить фото на диск:", e);
    return null;
  }
}

/**
 * Фоновый шаг (вызывать ПОСЛЕ ответа сотруднику, не блокируя его):
 * переносит уже сохранённое на диске фото в архивный Telegram-канал
 * (TELEGRAM_ARCHIVE_CHANNEL_ID) и удаляет локальный файл, освобождая
 * место на диске Volume. Если канал не настроен или Telegram недоступен
 * в моменте — возвращает null, а файл остаётся на диске как есть (не
 * ошибка, а нормальный запасной вариант).
 *
 * Вызывающий код должен обновить ссылку в своей записи (отчёт, заявка и
 * т.д.), если возвращён не null — иначе после удаления локального файла
 * старая ссылка перестанет открываться.
 */
export async function archivePhotoToTelegram(diskUrl: string, caption = "Фото AOMS"): Promise<string | null> {
  if (!isPhotoFileUrl(diskUrl) || diskUrl.includes("/tg_")) return null;
  const filename = diskUrl.split("/").pop()!;
  const filePath = resolvePhotoPath(filename);
  try {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const { sendPhotoToArchive } = await import("./telegram");
    const archived = await sendPhotoToArchive(buffer, "image/jpeg", caption);
    if (!archived) return null;
    fs.unlinkSync(filePath);
    return `/api/photos/tg_${archived.fileId}`;
  } catch (e) {
    console.error("[photo-storage] Фоновая архивация в Telegram не удалась:", e);
    return null;
  }
}

/** Абсолютный путь к файлу по имени — используется API-роутом отдачи фото и отправкой в Telegram. */
export function resolvePhotoPath(filename: string): string {
  return path.join(PHOTOS_DIR, filename);
}

/** true, если строка — это уже наша короткая ссылка (а не legacy base64 data URL). */
export function isPhotoFileUrl(value: string): boolean {
  return /^\/api\/photos\/[^/]+$/.test(value || "");
}

/**
 * Статистика по уже сохранённым фото на диске — сколько файлов, сколько
 * места занимают, сколько уже "маленьких" (пережатых) и сколько ещё
 * крупных (кандидаты на пережатие). Используется страницей /admin/storage,
 * чтобы показать честную картину до и после, не только "сделано ✓".
 */
export function getPhotoStorageStats() {
  ensurePhotosDir();
  const SMALL_THRESHOLD = 350 * 1024; // 350 КБ — примерный потолок для уже пережатого фото
  let totalBytes = 0;
  let totalCount = 0;
  let largeCount = 0;
  let largeBytes = 0;
  for (const filename of fs.readdirSync(PHOTOS_DIR)) {
    const full = path.join(PHOTOS_DIR, filename);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    totalBytes += stat.size;
    totalCount += 1;
    if (stat.size > SMALL_THRESHOLD) {
      largeCount += 1;
      largeBytes += stat.size;
    }
  }
  return { totalBytes, totalCount, largeCount, largeBytes, smallThreshold: SMALL_THRESHOLD };
}

/**
 * Пережимает УЖЕ СОХРАНЁННЫЕ файлы на диске теми же параметрами, что и
 * новые фото (см. savePhotoFile) — 1600 px, JPEG 75%. Файл заменяется
 * ПО ТОМУ ЖЕ ИМЕНИ, поэтому ссылки в базе (/api/photos/<имя>) не
 * ломаются — ничего в остальной системе менять не нужно. Ничего не
 * удаляется, только уменьшается вес файла.
 *
 * Обрабатывает не более `limit` файлов за один вызов (по умолчанию 30) —
 * чтобы один HTTP-запрос не завис надолго при тысячах файлов; страница
 * вызывает эту функцию в цикле, пока не останется необработанных.
 * Файлы, которые уже маленькие (< SMALL_THRESHOLD), пропускаются — это
 * делает функцию безопасной для повторного запуска (идемпотентной): не
 * нужно помнить, что уже обработано.
 */
export async function recompressExistingPhotos(limit = 30): Promise<{
  processed: number;
  bytesBefore: number;
  bytesAfter: number;
  remaining: number;
  errors: number;
}> {
  ensurePhotosDir();
  const { smallThreshold } = getPhotoStorageStats();
  const files = fs.readdirSync(PHOTOS_DIR).filter((f) => {
    const full = path.join(PHOTOS_DIR, f);
    try {
      return fs.statSync(full).isFile() && fs.statSync(full).size > smallThreshold;
    } catch {
      return false;
    }
  });

  const batch = files.slice(0, limit);
  let bytesBefore = 0;
  let bytesAfter = 0;
  let errors = 0;

  for (const filename of batch) {
    const full = path.join(PHOTOS_DIR, filename);
    try {
      const original = fs.readFileSync(full);
      bytesBefore += original.length;
      const compressed = await sharp(original)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      // Не перезаписываем, если "сжатая" версия почему-то оказалась
      // больше оригинала (бывает на уже маленьких/простых картинках) —
      // тогда оставляем как есть.
      if (compressed.length < original.length) {
        fs.writeFileSync(full, compressed);
        bytesAfter += compressed.length;
      } else {
        bytesAfter += original.length;
      }
    } catch (e) {
      console.error(`[photo-storage] Не удалось пережать ${filename}:`, e);
      errors += 1;
      bytesAfter += 0;
    }
  }

  return {
    processed: batch.length,
    bytesBefore,
    bytesAfter,
    remaining: Math.max(0, files.length - batch.length),
    errors,
  };
}

/**
 * Удаляет фото старше указанного числа дней — освобождает больше всего
 * места, но БЕЗВОЗВРАТНО (нельзя будет посмотреть эти фото позже, если
 * понадобится). Используется только если пережатия недостаточно. Ссылки
 * на удалённые файлы в БД останутся, но перестанут открываться — при
 * желании можно расширить, чтобы вызывающий код одновременно чистил и
 * ссылки в отчётах (не делаем здесь намеренно, чтобы функция оставалась
 * простой и предсказуемой: "удалить файлы старше N дней", не более).
 */
export function deleteOldPhotos(olderThanDays: number): { deleted: number; freedBytes: number } {
  ensurePhotosDir();
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let freedBytes = 0;
  for (const filename of fs.readdirSync(PHOTOS_DIR)) {
    const full = path.join(PHOTOS_DIR, filename);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    if (stat.mtimeMs < cutoff) {
      freedBytes += stat.size;
      fs.unlinkSync(full);
      deleted += 1;
    }
  }
  return { deleted, freedBytes };
}
