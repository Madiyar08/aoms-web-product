/**
 * Узбекистан — фиксированный UTC+5, без перехода на летнее время. Сервер
 * обычно работает в UTC (Railway), поэтому `new Date().toISOString().slice(0,10)`
 * даёт "сегодня" по UTC — с полуночи до 5 утра по Ташкенту это ещё
 * ВЧЕРАШНЯЯ дата по UTC, и маршрут/учёт за уже начавшийся местный день не
 * находится. Везде, где нужна "сегодняшняя дата" для сотрудника, нужно
 * использовать эти функции, а не toISOString() напрямую.
 */

const TASHKENT_OFFSET_MINUTES = 5 * 60;

export function tashkentDateString(d: Date): string {
  const shifted = new Date(d.getTime() + TASHKENT_OFFSET_MINUTES * 60000);
  return shifted.toISOString().slice(0, 10);
}

export function todayTashkent(): string {
  return tashkentDateString(new Date());
}

/** "08.07.2026, 14:23" — время по Ташкенту независимо от таймзоны сервера. */
export function formatTashkentDateTime(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "08.07.2026" — дата по Ташкенту независимо от таймзоны сервера. */
export function formatTashkentDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}
