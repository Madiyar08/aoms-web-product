import { haversineMeters } from "./coordinate-analysis";
import { getSettingValue } from "./settings";
export { validateTelegramInitData, validateTelegramWebhookSecret, TELEGRAM_INIT_DATA_MAX_AGE_SECONDS, TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS } from "./telegram-auth-core";

/**
 * Проверяет подпись initData из Telegram Mini App — это то, что позволяет
 * серверу доверять, какой сотрудник открыл приложение, без отдельного
 * логина. Telegram подписывает данные секретным ключом, производным от
 * токена бота. Если подпись не сходится — данные подделаны.
 *
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export interface AntifraudInput {
  atmLat: number;
  atmLon: number;
  gpsLat: number;
  gpsLon: number;
  hasPhoto: boolean;
  photoFromCamera: boolean; // клиент сообщает, что фото сделано камерой, а не выбрано из галереи
  inRoute: boolean;
  gpsAccuracy?: number;
}

export interface AntifraudResult {
  distanceMeters: number;
  flags: string[]; // человекочитаемые причины срабатывания
  passed: boolean;
}

/**
 * Читаемый формат расстояния — метры до 999, дальше километры с одним
 * знаком после запятой ("6.2 км" вместо "6174 м"). Раньше показывалось
 * сырое число метров без разделителей — по жалобе руководителя это
 * тяжело читать с одного взгляда, особенно при больших расстояниях.
 */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} м`;
  return `${(meters / 1000).toFixed(1)} км`;
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

  if (Number.isFinite(input.gpsAccuracy) && Number(input.gpsAccuracy) > 50) {
    flags.push(`Низкая точность GPS: ${Math.round(Number(input.gpsAccuracy))} м (измерение требует проверки)`);
  }
  if (!input.hasPhoto) flags.push("Нет фотографии");
  if (!input.photoFromCamera) flags.push("Фото не с камеры (возможно, из галереи)");
  if (Number.isNaN(distanceMeters)) {
    flags.push("Нет координат банкомата — расстояние не проверено");
  } else if (distanceMeters > radiusThreshold) {
    // При очень большом расстоянии (>2 км) это чаще объясняется
    // неточными координатами самого банкомата в базе, а не нарушением
    // сотрудника — добавляем эту пометку прямо в сообщение, чтобы
    // руководитель не тратил время на разбор каждого такого случая как
    // подозрение на сотрудника.
    const readable = formatDistance(distanceMeters);
    const note =
      distanceMeters > 2000
        ? ` — вероятно, неточные координаты банкомата в базе, а не нарушение сотрудника`
        : "";
    flags.push(`Слишком далеко от банкомата: ${readable} (порог ${radiusThreshold} м)${note}`);
  }
  if (!input.inRoute) flags.push("Банкомат вне сегодняшнего маршрута экипажа");

  return {
    distanceMeters,
    flags,
    // "passed" — только индикатор чистоты. Отчёт принимается в любом случае.
    passed: flags.length === 0,
  };
}
