import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DB_PATH } from "@/lib/db";

// Без этого Next.js может статически закэшировать GET-роут без
// параметров ещё на этапе сборки (когда файла базы могло не быть) — и
// потом всегда отдавать тот самый устаревший ответ "файл не найден",
// даже если он давно появился. Уже наступали на эту же грабл раньше.
export const dynamic = "force-dynamic";

/**
 * Скачивание полной базы данных SQLite напрямую из веб-интерфейса — без
 * необходимости лезть в терминал Railway. Защищено тем же паролем, что
 * и весь остальной веб-интерфейс (роут НЕ входит в список исключений
 * middleware.ts, значит проверка пароля применяется автоматически).
 *
 * Отдаёт ZIP, а не голый .db файл: если рядом с основным файлом базы
 * лежат файлы -wal/-shm (SQLite WAL-режим, даже если сейчас не включён
 * явно — мог быть у более старой версии), они попадают в архив вместе
 * с основным файлом, чтобы не потерять самые свежие записи, которые
 * ещё не попали в главный файл.
 */
export async function GET() {
  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: `Файл базы не найден: ${DB_PATH}` }, { status: 404 });
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const dbDir = path.dirname(DB_PATH);
  const dbBaseName = path.basename(DB_PATH);
  const relatedFiles = [dbBaseName, `${dbBaseName}-wal`, `${dbBaseName}-shm`, `${dbBaseName}-journal`];

  let addedCount = 0;
  for (const filename of relatedFiles) {
    const filePath = path.join(dbDir, filename);
    if (fs.existsSync(filePath)) {
      zip.file(filename, fs.readFileSync(filePath));
      addedCount += 1;
    }
  }

  if (addedCount === 0) {
    return NextResponse.json({ error: "Не удалось прочитать файл базы" }, { status: 500 });
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="aoms_database_${today}.zip"`,
    },
  });
}
