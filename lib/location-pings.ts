import { insertRow, readAll, deleteRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { todayTashkent } from "./tz";

const TABLE = "location_pings";

/**
 * Точка геопозиции сотрудника, полученная через Telegram Live Location
 * (см. https://core.telegram.org/bots/api#location — поле live_period).
 * Сотрудник сам включает трансляцию в Telegram; бот получает обновления
 * координат как правки исходного сообщения (edited_message).
 *
 * Храним только сегодняшний день — история за прошлые дни не нужна для
 * оперативного контроля и не должна раздувать базу; чистка выполняется
 * функцией purgeOldPings ниже.
 */
export interface LocationPing extends BaseEntity {
  employeeId: string;
  latitude: number;
  longitude: number;
  capturedAt: string; // ISO — момент получения обновления
}

export function recordLocationPing(employeeId: string, latitude: number, longitude: number): LocationPing {
  const row: LocationPing = {
    id: newId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    employeeId,
    latitude,
    longitude,
    capturedAt: nowIso(),
  };
  insertRow(TABLE, row);
  return row;
}

/** Последняя известная точка каждого сотрудника (для экрана "где экипажи"). */
export function listLatestPingsByEmployee(): Map<string, LocationPing> {
  const all = readAll<LocationPing>(TABLE);
  const latest = new Map<string, LocationPing>();
  for (const ping of all) {
    const cur = latest.get(ping.employeeId);
    if (!cur || ping.capturedAt > cur.capturedAt) latest.set(ping.employeeId, ping);
  }
  return latest;
}

/** История точек конкретного сотрудника за сегодня (для будущего трека на карте). */
export function listTodayPingsForEmployee(employeeId: string): LocationPing[] {
  const today = todayTashkent();
  return readAll<LocationPing>(TABLE)
    .filter((p) => p.employeeId === employeeId && p.capturedAt.slice(0, 10) === today)
    .sort((a, b) => (a.capturedAt < b.capturedAt ? -1 : 1));
}

/**
 * Удаляет точки старше вчерашнего дня. Вызывать periодически (например,
 * при первом обращении к экрану геопозиций за день) — отдельного cron
 * в этом окружении нет, поэтому чистка "ленивая", по факту использования.
 */
export function purgeOldPings(): number {
  const today = todayTashkent();
  const all = readAll<LocationPing>(TABLE);
  let purged = 0;
  for (const p of all) {
    if (p.capturedAt.slice(0, 10) !== today) {
      deleteRow(TABLE, p.id);
      purged += 1;
    }
  }
  return purged;
}
