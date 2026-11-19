import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolvePhotoPath } from "@/lib/photo-storage";
import { fetchTelegramFileBuffer } from "@/lib/telegram";
import { isInspectorReportMediaUrl } from "@/lib/inspector-reports";
import { isAdminApiRequest } from "@/lib/admin-api-auth";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const mediaUrl = `/api/photos/${params.filename}`;
  if (isInspectorReportMediaUrl(mediaUrl) && !(await isAdminApiRequest(req))) {
    return NextResponse.json({ error: "Доступ к инспекторским материалам запрещён" }, { status: process.env.ADMIN_PASSWORD ? 401 : 503 });
  }

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
  if (filename.startsWith("tgvideo_") || filename.startsWith("tg_")) {
    const isVideo = filename.startsWith("tgvideo_");
    const fileId = filename.slice(isVideo ? 8 : 3);
    const buffer = await fetchTelegramFileBuffer(fileId);
    if (!buffer) {
      return NextResponse.json({ error: "Не удалось получить медиа из Telegram" }, { status: 502 });
    }
    if (isVideo) {
      const range = req.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${buffer.length}` } });
        const start = match[1] ? Number(match[1]) : Math.max(0, buffer.length - Number(match[2] || 0));
        const end = match[2] && match[1] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= buffer.length) {
          return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${buffer.length}` } });
        }
        const chunk = buffer.subarray(start, end + 1);
        return new NextResponse(new Uint8Array(chunk), { status: 206, headers: {
          "Content-Type": "video/mp4", "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`, "Content-Length": String(chunk.length),
          "Cache-Control": "private, max-age=3600", "Content-Disposition": "inline",
        }});
      }
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": isVideo ? "video/mp4" : "image/jpeg",
        ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const filePath = resolvePhotoPath(filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
  }

  const ext = path.extname(filename).replace(".", "").toLowerCase();
  const stat = fs.statSync(filePath);
  const isVideo = ["mp4", "webm", "mov"].includes(ext);
  const range = isVideo ? req.headers.get("range") : null;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2] || 0));
    const end = match[2] && match[1] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= stat.size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const chunk = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(filePath, "r");
    try { fs.readSync(fd, chunk, 0, chunk.length, start); } finally { fs.closeSync(fd); }
    return new NextResponse(new Uint8Array(chunk), { status: 206, headers: {
      "Content-Type": MIME[ext] || "application/octet-stream", "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(chunk.length),
      "Cache-Control": "private, max-age=31536000, immutable", "Content-Disposition": "inline",
    }});
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": String(buffer.length),
      ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}
