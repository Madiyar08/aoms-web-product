import { listAtms, Atm } from "./atms";
import { haversineMeters } from "./coordinate-analysis";
import { districtByPolygon, districtByNearestCenter, getDistrictBoundary, listDistrictBoundaries } from "./district-boundaries";

/**
 * Район определяется по координатам, а не по тексту из Excel.
 *
 * ИСТОРИЯ: первая версия вычисляла центр района как среднее координат
 * его банкоматов ("центроид") и сравнивала расстояния до центров. Это
 * оказалось слишком грубо: у границы вытянутого или соседствующего с
 * компактным районом банкомата легко оказывался географически ближе к
 * ЧУЖОМУ центроиду, чем к своему — из-за этого система (а) ошибочно
 * исключала из маршрута совершенно нормальные банкоматы и (б) не могла
 * надёжно поймать банкоматы из реально чужого района.
 *
 * Текущая версия: используются РЕАЛЬНЫЕ полигоны границ районов,
 * нарисованные руководителем один раз (см. lib/district-boundaries.ts,
 * страница /district-boundaries). Пока полигон для района не нарисован —
 * система НЕ помечает его банкоматы подозрительными (лучше не проверять,
 * чем ошибочно исключать нормальные банкоматы).
 */

export interface DistrictCenter {
  district: string;
  lat: number;
  lon: number;
  count: number;
}

function parseLatLon(a: Atm): { lat: number; lon: number } | null {
  const lat = parseFloat(a.latitude);
  const lon = parseFloat(a.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

/** Оставлено для обратной совместимости и страницы анализа координат. */
export function computeDistrictCenters(): DistrictCenter[] {
  const acc = new Map<string, { sumLat: number; sumLon: number; count: number }>();
  for (const atm of listAtms()) {
    if (!atm.district) continue;
    const p = parseLatLon(atm);
    if (!p) continue;
    const cur = acc.get(atm.district) || { sumLat: 0, sumLon: 0, count: 0 };
    cur.sumLat += p.lat;
    cur.sumLon += p.lon;
    cur.count += 1;
    acc.set(atm.district, cur);
  }
  return Array.from(acc.entries()).map(([district, v]) => ({
    district,
    lat: v.sumLat / v.count,
    lon: v.sumLon / v.count,
    count: v.count,
  }));
}

export function nearestDistrict(
  lat: number,
  lon: number,
  centers: DistrictCenter[]
): { district: string; distanceM: number } | null {
  let best: { district: string; distanceM: number } | null = null;
  for (const c of centers) {
    if (c.count < 3) continue;
    const d = haversineMeters(lat, lon, c.lat, c.lon);
    if (!best || d < best.distanceM) best = { district: c.district, distanceM: Math.round(d) };
  }
  return best;
}

export interface DistrictMismatch {
  atmId: string;
  code: string;
  address: string;
  recordedDistrict: string;
  suggestedDistrict: string;
  latitude: string;
  longitude: string;
  distanceToSuggestedM: number;
  confidence: "polygon" | "polygon-partial" | "center";
}

/**
 * Находит банкоматы, чей район по факту (полигону) расходится с
 * записанным. Работает ТОЛЬКО там, где полигоны нарисованы — это
 * осознанное решение: лучше не проверять район, чем ошибочно исключать
 * нормальный банкомат из-за грубого приближения (см. историю выше).
 */
export function findDistrictMismatches(): DistrictMismatch[] {
  const out: DistrictMismatch[] = [];
  // Считаем "известным" район, если для него нарисован полигон ИЛИ задан
  // хотя бы центр вручную — иначе банкоматы этого района не проверяем
  // вовсе (безопаснее промолчать, чем ошибочно исключить нормальный
  // банкомат из-за отсутствия данных).
  const knownDistricts = new Set(listDistrictBoundaries().map((b) => b.district));

  for (const atm of listAtms()) {
    if (!atm.district) continue;
    const p = parseLatLon(atm);
    if (!p) continue;

    const polygonMatch = districtByPolygon(p.lat, p.lon);

    if (polygonMatch && polygonMatch !== atm.district) {
      out.push({
        atmId: atm.id,
        code: atm.code || "(без ID)",
        address: atm.address,
        recordedDistrict: atm.district,
        suggestedDistrict: polygonMatch,
        latitude: atm.latitude,
        longitude: atm.longitude,
        distanceToSuggestedM: 0,
        confidence: "polygon",
      });
      continue;
    }

    if (!polygonMatch) {
      const ownBoundary = getDistrictBoundary(atm.district);
      if (ownBoundary && ownBoundary.points.length >= 3) {
        out.push({
          atmId: atm.id,
          code: atm.code || "(без ID)",
          address: atm.address,
          recordedDistrict: atm.district,
          suggestedDistrict: "неизвестно — вне всех нарисованных границ",
          latitude: atm.latitude,
          longitude: atm.longitude,
          distanceToSuggestedM: 0,
          confidence: "polygon-partial",
        });
        continue;
      }

      // Полигон для района не нарисован — пробуем быстрый способ (центр
      // вручную, одна точка на район). Проверяем только если известен
      // хотя бы центр ЗАПИСАННОГО района — иначе не с чем сравнивать.
      //
      // ВАЖНО (защита от ложных исключений нормальных банкоматов):
      // просто "ближайший центр" опасен для банкоматов у границы между
      // двумя районами — небольшая погрешность GPS может сделать чужой
      // центр чуть ближе, чем свой. Флагуем несоответствие ТОЛЬКО если
      // чужой центр заметно ближе (минимум на MARGIN_M), чем свой
      // собственный записанный район. Обычные банкоматы возле границы
      // при этом не трогаем — лучше пропустить редкую ошибку в данных,
      // чем массово исключать нормальные банкоматы из маршрута.
      if (knownDistricts.has(atm.district)) {
        const centerMatch = districtByNearestCenter(p.lat, p.lon);
        const ownCenter = getDistrictBoundary(atm.district);
        if (centerMatch && centerMatch.district !== atm.district && ownCenter?.points.length === 1) {
          const distToOwn = Math.round(
            haversineMeters(p.lat, p.lon, ownCenter.points[0].lat, ownCenter.points[0].lon)
          );
          const MARGIN_M = 300;
          if (distToOwn - centerMatch.distanceM >= MARGIN_M) {
            out.push({
              atmId: atm.id,
              code: atm.code || "(без ID)",
              address: atm.address,
              recordedDistrict: atm.district,
              suggestedDistrict: centerMatch.district,
              latitude: atm.latitude,
              longitude: atm.longitude,
              distanceToSuggestedM: centerMatch.distanceM,
              confidence: "center",
            });
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.recordedDistrict.localeCompare(b.recordedDistrict));
}

/** true, если банкомат подтверждён по координатам ИЛИ вообще не найден в списке несоответствий. */
export function isDistrictConfirmed(atmId: string, mismatches: DistrictMismatch[]): boolean {
  return !mismatches.some((m) => m.atmId === atmId);
}
