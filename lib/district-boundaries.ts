import { insertRow, readAll, updateRow, deleteRow, findById } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "district_boundaries";

/**
 * Реальная граница района, нарисованная руководителем на карте один раз
 * (см. app/district-boundaries). Заменяет прежний способ определения
 * района по среднему координат ("центроид") — тот подход систематически
 * ошибался на обычных банкоматах у границы вытянутых/соседних районов
 * (жалобы: "исключает нормальные банкоматы" и "чужой район всё равно
 * просачивается"). Точный полигон устраняет обе проблемы разом.
 */
export interface DistrictBoundary extends BaseEntity {
  district: string; // должно совпадать с полем district у банкоматов
  points: { lat: number; lon: number }[]; // вершины полигона по порядку обхода
}

export function listDistrictBoundaries(): DistrictBoundary[] {
  return readAll<DistrictBoundary>(TABLE);
}

export function getDistrictBoundary(district: string): DistrictBoundary | null {
  return listDistrictBoundaries().find((b) => b.district === district) || null;
}

export function saveDistrictBoundary(district: string, points: { lat: number; lon: number }[]): DistrictBoundary {
  const existing = getDistrictBoundary(district);
  if (existing) {
    updateRow<DistrictBoundary>(TABLE, existing.id, { points });
    return { ...existing, points };
  }
  const row: DistrictBoundary = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), district, points };
  insertRow(TABLE, row);
  return row;
}

export function deleteDistrictBoundary(district: string): boolean {
  const existing = getDistrictBoundary(district);
  if (!existing) return false;
  return deleteRow(TABLE, existing.id);
}

/**
 * Точная проверка "точка внутри полигона" — алгоритм трассировки луча
 * (ray casting). Стандартный надёжный метод, не зависит от формы района
 * (работает для вытянутых, невыпуклых полигонов — то, с чем не
 * справлялся центроид).
 */
export function pointInPolygon(lat: number, lon: number, points: { lat: number; lon: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].lon, yi = points[i].lat;
    const xj = points[j].lon, yj = points[j].lat;
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Определяет район банкомата по нарисованным полигонам. Если ни один
 * полигон не содержит точку (например, для района ещё не нарисована
 * граница), возвращает null — вызывающий код должен решить, как
 * поступить (обычно — откат на старый центроидный метод, см.
 * district-check.ts, ИЛИ пропуск проверки для этого района).
 */
export function districtByPolygon(lat: number, lon: number): string | null {
  const boundaries = listDistrictBoundaries();
  for (const b of boundaries) {
    if (b.points.length >= 3 && pointInPolygon(lat, lon, b.points)) return b.district;
  }
  return null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Определяет район по вручную заданным ЦЕНТРАМ районов (одна точка на
 * район — быстрый способ вместо рисования полного полигона). Точка
 * считается координатой района только если для него сохранена ровно
 * одна точка (не полигон — тот проверяется отдельно, districtByPolygon).
 * Возвращает ближайший центр — точнее прежнего автоматического среднего,
 * потому что координаты выбраны руководителем осознанно (например, по
 * клику на название района в Яндекс.Картах), а не вычислены по своим же
 * банкоматам, часть которых может быть неточной.
 */
export function districtByNearestCenter(lat: number, lon: number): { district: string; distanceM: number } | null {
  const centers = listDistrictBoundaries().filter((b) => b.points.length === 1);
  let best: { district: string; distanceM: number } | null = null;
  for (const c of centers) {
    const d = haversine(lat, lon, c.points[0].lat, c.points[0].lon);
    if (!best || d < best.distanceM) best = { district: c.district, distanceM: Math.round(d) };
  }
  return best;
}
