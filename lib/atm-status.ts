/**
 * Вычисление статуса проверки банкомата — чистая функция без обращения
 * к БД. Вынесена из lib/atms.ts в отдельный файл специально, чтобы
 * клиентские компоненты (например AtmTable) могли её импортировать, не
 * утягивая за собой lib/db.ts с node:sqlite/node:fs (это ломает сборку
 * для браузера — Next.js не умеет бандлить node:-модули для клиента).
 */

export interface VerificationInput {
  addressVerified: boolean;
  coordsVerified: boolean;
  lastCleanedDate?: string;
}

export function verificationStatus(atm: VerificationInput): { label: string; dotClass: string } {
  if (atm.lastCleanedDate && atm.lastCleanedDate === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" })) {
    return { label: "Обслужен сегодня", dotClass: "bg-st-green" };
  }
  const { addressVerified, coordsVerified } = atm;
  if (addressVerified && coordsVerified) {
    return { label: "Подтверждён", dotClass: "bg-st-amber" };
  }
  if (!addressVerified && coordsVerified) {
    return { label: "Адрес — повторная проверка", dotClass: "bg-st-green" };
  }
  if (addressVerified && !coordsVerified) {
    return { label: "Координаты требуют проверки", dotClass: "bg-st-yellow" };
  }
  return { label: "Никогда не проверялся", dotClass: "bg-white border-2 border-st-white" };
}

/**
 * Цветовая индикация СВЕЖЕСТИ очистки (отдельно от verificationStatus,
 * который про подтверждение адреса/координат). Используется в таблице
 * банкоматов и определяет тот же приоритет, что и сортировка маршрута
 * в lib/routes.ts — чем краснее, тем давнее не обслужен банкомат.
 *
 * зелёный — сегодня; жёлтый — 1–3 дня; оранжевый — 4–7 дней;
 * красный — больше недели или ни разу не обслуживался.
 */
export function cleaningFreshness(lastCleanedDate?: string): { label: string; dotClass: string; daysAgo: number | null } {
  if (!lastCleanedDate) {
    return { label: "Ни разу не обслужен", dotClass: "bg-st-red", daysAgo: null };
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const daysAgo = Math.round(
    (Date.parse(today) - Date.parse(lastCleanedDate)) / (1000 * 60 * 60 * 24)
  );
  if (daysAgo <= 0) return { label: "Сегодня", dotClass: "bg-st-green", daysAgo };
  if (daysAgo <= 3) return { label: `${daysAgo} дн. назад`, dotClass: "bg-st-yellow", daysAgo };
  if (daysAgo <= 7) return { label: `${daysAgo} дн. назад`, dotClass: "bg-st-orange", daysAgo };
  return { label: `${daysAgo} дн. назад`, dotClass: "bg-st-red", daysAgo };
}
