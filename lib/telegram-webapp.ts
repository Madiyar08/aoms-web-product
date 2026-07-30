import crypto from "node:crypto";
import { haversineMeters } from "./coordinate-analysis";
import { getSettingValue } from "./settings";

/**
 * Проверяет подпись initData из Telegram Mini App — это то, что позволяет
 * серверу доверять, какой сотрудник открыл приложение, без отдельного
 * логина. Telegram подписывает данные секретным ключом, производным от
 * токена бота. Если подпись не сходится — данные подделаны.
 *
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): { valid: boolean; userId?: string } {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { valid: false };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { valid: false };

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return { valid: false };

  // Достаём user.id из подтверждённых данных
  try {
    const userJson = params.get("user");
    if (userJson) {
      const user = JSON.parse(userJson) as { id: number };
      return { valid: true, userId: String(user.id) };
    }
  } catch {
    // ignore
  }
  return { valid: true };
}

export interface AntifraudInput {
  atmLat: number;
  atmLon: number;
  gpsLat: number;
  gpsLon: number;
  hasPhoto: boolean;
  photoFromCamera: boolean; // клиент сообщает, что фото сделано камерой, а не выбрано из галереи
  inRoute: boolean;
}

export interface AntifraudResult {
  distanceMeters: number;
  flags: string[]; // человекочитаемые причины срабатывания
  passed: boolean;
}

/**
 * Прогоняет антифрод-проверки для отчёта об очистке. НЕ блокирует
 * отправку (сотрудник мог законно чистить банкомат вне очереди —
 * система не должна отказывать), но помечает подозрительные случаи
 * флагами, которые видит руководитель.
 */
export function runAntifraudChecks(input: AntifraudInput): AntifraudResult {
  const radiusThreshold = getSettingValue("antifraud_gps_radius_meters", 20) as number;
  const flags: string[] = [];

  const distanceMeters = Math.round(
    haversineMeters(input.atmLat, input.atmLon, input.gpsLat, input.gpsLon)
  );

  if (!input.hasPhoto) flags.push("Нет фотографии");
  if (!input.photoFromCamera) flags.push("Фото не с камеры (возможно, из галереи)");
  if (Number.isNaN(distanceMeters)) {
    flags.push("Нет координат банкомата — расстояние не проверено");
  } else if (distanceMeters > radiusThreshold) {
    flags.push(`Слишком далеко от банкомата: ${distanceMeters} м (порог ${radiusThreshold} м)`);
  }
  if (!input.inRoute) flags.push("Банкомат вне сегодняшнего маршрута экипажа");

  return {
    distanceMeters,
    flags,
    // "passed" — только индикатор чистоты. Отчёт принимается в любом случае.
    passed: flags.length === 0,
  };
}
