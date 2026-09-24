import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolvePhotoPath } from "@/lib/photo-storage";
import { fetchTelegramFileBuffer } from "@/lib/telegram";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  // filename всегда генерируется нами (newId + расширение, либо "tg_"
  // + file_id для фото в архивном Telegram-канале) — но на всякий
  // случай не даём выйти за пределы папки с фото через "..".
  const filename = params.filename;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Некорректное имя файла" }, { status: 400 });
  }

  // Фото в архивном Telegram-канале, не на диске — скачиваем через Bot
  // API по file_id при каждом открытии (Telegram отдаёт временную
  // прямую ссылку на файл, поэтому просто сохранить постоянный URL
  // нельзя — только запрашивать заново).
  if (filename.startsWith("tg_")) {
    const fileId = filename.slice(3);
    const buffer = await fetchTelegramFileBuffer(fileId);
    if (!buffer) {
      return NextResponse.json({ error: "Не удалось получить фото из Telegram" }, { status: 502 });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        // Короче кэш, чем для файлов на диске — file_id иногда истекает,
        // и лучше перезапросить, чем показывать битую картинку долго.
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const filePath = resolvePhotoPath(filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
  }

  const ext = path.extname(filename).replace(".", "").toLowerCase();
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
