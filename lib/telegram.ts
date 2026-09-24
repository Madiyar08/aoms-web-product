/**
 * Интеграция с Telegram Bot API.
 *
 * ВАЖНО (честно): отправка сообщений здесь реализована через обычные
 * HTTP-запросы к api.telegram.org — библиотека не нужна, это просто
 * REST API. Но по-настоящему протестировать отправку можно только с
 * реальным токеном бота (получить у @BotFather) и в среде, у которой
 * есть доступ к api.telegram.org. Код написан и логически проверен
 * (парсинг payload, формирование сообщений), но живую доставку
 * сообщений я не проверял — не было ни токена, ни доступа к домену.
 *
 * Настройка (см. README):
 * 1. Получить токен у @BotFather → положить в .env как TELEGRAM_BOT_TOKEN
 * 2. Указать username бота в .env как TELEGRAM_BOT_USERNAME (без @)
 * 3. Настроить webhook: POST https://api.telegram.org/bot<token>/setWebhook
 *    с body {"url": "https://ваш-домен/api/telegram/webhook"}
 * 4. На странице «Сотрудники» у каждого сотрудника появится персональная
 *    регистрационная ссылка — сотрудник переходит по ней в Telegram,
 *    жмёт Start, и его chat_id автоматически привязывается.
 */

import fs from "node:fs";
import { resolvePhotoPath, isPhotoFileUrl } from "./photo-storage";

const TELEGRAM_API = "https://api.telegram.org";

export function getBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME || "";
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function buildRegistrationLink(employeeId: string): string | null {
  const username = getBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${employeeId}`;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN не задан в .env — сообщение не отправлено" };
  }
  if (!chatId) {
    return { ok: false, error: "У сотрудника не привязан Telegram (нет chat_id)" };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description || "Telegram API вернул ошибку без описания" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Не удалось обратиться к Telegram API: ${(e as Error).message}` };
  }
}

/**
 * Отправляет сообщение с кнопкой запуска Mini App. URL приложения берётся
 * из APP_PUBLIC_URL (публичный адрес на Railway) + /miniapp. Telegram
 * требует, чтобы у бота был настроен домен и URL был https.
 */
export async function sendMiniAppButton(chatId: string, text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.APP_PUBLIC_URL;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN не задан" };
  if (!appUrl) {
    // Фолбэк: обычное сообщение без кнопки, если адрес приложения не задан
    return sendTelegramMessage(chatId, text + "\n\n(URL приложения не настроен — задайте APP_PUBLIC_URL)");
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📲 Открыть приложение", web_app: { url: `${appUrl}/miniapp` } }],
          ],
        },
      }),
    });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description || "Ошибка Telegram API" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Не удалось обратиться к Telegram API: ${(e as Error).message}` };
  }
}

export interface TelegramUpdate {
  message?: {
    chat?: { id: number };
    text?: string;
    location?: { latitude: number; longitude: number; live_period?: number };
  };
  // Telegram присылает обновления координат live-трансляции как правки
  // ранее отправленного сообщения с геопозицией — не как новое сообщение.
  edited_message?: {
    chat?: { id: number };
    location?: { latitude: number; longitude: number; live_period?: number };
  };
}

/**
 * Отправляет фото (пришедшее с телефона сотрудника как base64 data URL)
 * в чат вместе с подписью. Telegram Bot API принимает файлы только как
 * multipart/form-data — конвертируем data URL в Blob и грузим через
 * FormData (глобально доступны в Node 18+, ставить библиотеку не нужно).
 * Если фото по какой-то причине нет или отправка не удалась —
 * откатываемся на обычное текстовое сообщение, чтобы группа/сотрудник
 * всё равно получили отчёт.
 */
export async function sendTelegramPhoto(chatId: string, photoRef: string, caption: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN не задан" };
  if (!chatId) return { ok: false, error: "Не задан chat_id" };

  // photoRef хранится в БД в одном из ТРЁХ форматов (последний сегмент
  // пути, если это ссылка вида "/api/photos/xxx", определяет какой):
  //  1) "/api/photos/tg_<file_id>" — фото в архивном Telegram-канале, не
  //     на диске (см. sendPhotoToArchive). Telegram позволяет переслать
  //     уже загруженное фото по file_id БЕЗ повторной загрузки байтов —
  //     так и делаем, быстрее и не гоняет фото через нашу сеть повторно.
  //  2) legacy base64 data URL, целиком хранившийся в БД (до перехода на
  //     файлы на диске).
  //  3) "/api/photos/xxx.jpg" — фото файлом на диске (Volume), было до
  //     перехода на архив в Telegram.
  const lastSegment = (photoRef || "").split("/").pop() || "";

  if (lastSegment.startsWith("tg_")) {
    const fileId = lastSegment.slice(3);
    try {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("photo", fileId);
      const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: "POST", body: form });
      const data = (await response.json()) as { ok: boolean; description?: string };
      if (data.ok) return { ok: true };
      return sendTelegramMessage(chatId, caption + `\n\n(фото не отправилось: ${data.description})`);
    } catch (e) {
      return sendTelegramMessage(chatId, caption + `\n\n(фото не отправилось: ${(e as Error).message})`);
    }
  }

  let buffer: Buffer;
  let mime: string;
  const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photoRef || "");
  if (dataUrlMatch) {
    mime = dataUrlMatch[1];
    buffer = Buffer.from(dataUrlMatch[2], "base64");
  } else if (isPhotoFileUrl(photoRef || "")) {
    try {
      const filename = photoRef.split("/").pop()!;
      buffer = fs.readFileSync(resolvePhotoPath(filename));
      const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
      mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    } catch (e) {
      return sendTelegramMessage(chatId, caption + `\n\n(файл фото не найден на диске: ${(e as Error).message})`);
    }
  } else {
    // Нет валидного фото — не молчим, шлём хотя бы текст
    return sendTelegramMessage(chatId, caption + "\n\n(фото отсутствует или повреждено)");
  }

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", new Blob([new Uint8Array(buffer)], { type: mime }), "photo.jpg");

    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: "POST", body: form });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (data.ok) return { ok: true };

    // sendPhoto капризен: отвергает большие фото и иногда даёт
    // IMAGE_PROCESS_FAILED на нормальных снимках с телефона. Пробуем
    // отправить то же самое как документ — sendDocument не обрабатывает
    // изображение и принимает файл как есть, поэтому проходит там, где
    // sendPhoto падает. Фото в группе будет как вложение-файл.
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const docForm = new FormData();
    docForm.append("chat_id", chatId);
    docForm.append("caption", caption);
    docForm.append("parse_mode", "HTML");
    docForm.append("document", new Blob([new Uint8Array(buffer)], { type: mime }), `photo.${ext}`);
    const docResp = await fetch(`${TELEGRAM_API}/bot${token}/sendDocument`, { method: "POST", body: docForm });
    const docData = (await docResp.json()) as { ok: boolean; description?: string };
    if (docData.ok) return { ok: true };

    // Оба способа не сработали — не теряем отчёт, шлём текст с причиной.
    return sendTelegramMessage(
      chatId,
      caption + `\n\n(фото не отправилось: ${data.description}; как файл: ${docData.description})`
    );
  } catch (e) {
    const fallback = await sendTelegramMessage(chatId, caption + `\n\n(фото не отправилось: ${(e as Error).message})`);
    return fallback;
  }
}

/**
 * Разбирает входящий Update от Telegram на предмет команды
 * "/start <employeeId>" — так регистрируется chat_id сотрудника.
 * Чистая функция, тестируется без обращения к реальному Telegram.
 */
export function parseStartPayload(update: TelegramUpdate): { chatId: string; employeeId: string } | null {
  const text = update.message?.text;
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined) return null;
  const match = text.match(/^\/start\s+(\S+)/);
  if (!match) return null;
  return { chatId: String(chatId), employeeId: match[1].trim() };
}

/**
 * Загружает фото в архивный Telegram-канал (TELEGRAM_ARCHIVE_CHANNEL_ID)
 * вместо сохранения файлом на диске Railway. Возвращает file_id — по
 * нему фото можно переслать куда угодно ПОВТОРНО без повторной загрузки
 * байтов, и по нему же его можно скачать через Bot API (см.
 * fetchTelegramFileBuffer). Это полностью убирает нагрузку на диск
 * Volume, которая раньше приводила к его переполнению.
 *
 * Возвращает null, если канал не настроен или отправка не удалась —
 * вызывающий код (savePhotoFile) в этом случае откатывается на
 * сохранение файлом на диске, чтобы фото не терялось.
 */
export async function sendPhotoToArchive(
  buffer: Buffer,
  mime: string,
  caption: string
): Promise<{ fileId: string; messageId: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_ARCHIVE_CHANNEL_ID;
  if (!token || !channelId) return null;

  try {
    const form = new FormData();
    form.append("chat_id", channelId);
    form.append("caption", caption);
    form.append("photo", new Blob([new Uint8Array(buffer)], { type: mime }), "photo.jpg");
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: "POST", body: form });
    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id: number; photo?: Array<{ file_id: string }> };
      description?: string;
    };
    if (!data.ok || !data.result?.photo?.length) {
      console.error("[telegram] Загрузка в архив не удалась:", data.description);
      return null;
    }
    // Telegram присылает несколько размеров одного фото — берём самое
    // крупное (последнее в массиве) для максимального качества при
    // последующем просмотре.
    const largest = data.result.photo[data.result.photo.length - 1];
    return { fileId: largest.file_id, messageId: data.result.message_id };
  } catch (e) {
    console.error("[telegram] Ошибка загрузки в архив:", e);
    return null;
  }
}

/**
 * Скачивает содержимое файла из Telegram по file_id — используется при
 * открытии фото из Dashboard (роут /api/photos/[filename], когда имя
 * файла имеет формат "tg_<file_id>"). Два запроса: getFile (получить
 * временный file_path) и сам файл по этому пути.
 */
export async function fetchTelegramFileBuffer(fileId: string): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const infoResp = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const info = (await infoResp.json()) as { ok: boolean; result?: { file_path: string } };
    if (!info.ok || !info.result?.file_path) return null;
    const fileResp = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
    if (!fileResp.ok) return null;
    const arrayBuffer = await fileResp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error("[telegram] Не удалось скачать файл по file_id:", e);
    return null;
  }
}
