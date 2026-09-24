import { listAtms } from "./atms";
import type { Atm } from "./atms";

/**
 * Расстояние между двумя точками по формуле гаверсинуса, в метрах.
 * Достаточно точна для внутригородских расстояний (десятки-сотни метров),
 * не требует внешних сервисов/API.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export interface CoordinateCluster {
  atms: Atm[];
  /** Расстояния между последовательными банкоматами группы (как в примере ТЗ: 8м, 15м, 23м) */
  sequentialDistances: number[];
  maxDistance: number;
}

/**
 * Находит группы банкоматов ближе threshold метров друг к другу.
 * Группировка — через Union-Find: банкоматы объединяются в одну группу
 * транзитивно (A близко к B, B близко к C ⇒ A, B, C — одна группа),
 * это соответствует примеру из ТЗ, где расстояния даны последовательно,
 * а не попарно между всеми.
 */
export function findCoordinateClusters(thresholdMeters: number): CoordinateCluster[] {
  const atms = listAtms().filter((a) => {
    const lat = parseFloat(a.latitude);
    const lon = parseFloat(a.longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon);
  });

  const parent = new Map<string, string>();
  function find(id: string): string {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  atms.forEach((a) => parent.set(a.id, a.id));

  for (let i = 0; i < atms.length; i++) {
    const a = atms[i];
    const latA = parseFloat(a.latitude);
    const lonA = parseFloat(a.longitude);
    for (let j = i + 1; j < atms.length; j++) {
      const b = atms[j];
      const latB = parseFloat(b.latitude);
      const lonB = parseFloat(b.longitude);
      // Быстрый отсев по широте перед точным расчётом — экономит вычисления
      // на 996+ банкоматах (разница по широте > ~0.001° это уже больше 100м)
      if (Math.abs(latA - latB) > 0.01) continue;
      const distance = haversineMeters(latA, lonA, latB, lonB);
      if (distance <= thresholdMeters) union(a.id, b.id);
    }
  }

  const groups = new Map<string, Atm[]>();
  for (const a of atms) {
    const root = find(a.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(a);
  }

  const clusters: CoordinateCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sequentialDistances: number[] = [];
    for (let i = 0; i < members.length - 1; i++) {
      const a = members[i];
      const b = members[i + 1];
      sequentialDistances.push(
        Math.round(
          haversineMeters(
            parseFloat(a.latitude),
            parseFloat(a.longitude),
            parseFloat(b.latitude),
            parseFloat(b.longitude)
          )
        )
      );
    }
    clusters.push({
      atms: members,
      sequentialDistances,
      maxDistance: Math.max(...sequentialDistances, 0),
    });
  }

  return clusters.sort((a, b) => b.atms.length - a.atms.length);
}

/** Стабильная сигнатура группы (для хранения решений руководителя между пересчётами) */
export function clusterSignature(atmIds: string[]): string {
  return [...atmIds].sort().join(",");
}

/**
 * Считает число РЕАЛЬНЫХ ТОЧЕК (остановок) среди произвольного списка
 * банкоматов — банкоматы ближе thresholdMeters друг к другу схлопываются
 * в одну точку, тем же способом (union-find), что и при построении
 * маршрута/анализе координат. Используется для KPI: экипаж выполняет
 * норму "50 точек в день", а не "50 банкоматов" — на многих точках
 * стоит по 2-4 банкомата, и без этой поправки KPI считался бы
 * несправедливо строгим.
 */
export function countDistinctPoints(atms: Atm[], thresholdMeters = 30): number {
  const withCoords = atms.filter((a) => {
    const lat = parseFloat(a.latitude);
    const lon = parseFloat(a.longitude);
    return !Number.isNaN(lat) && !Number.isNaN(lon);
  });

  const parent = new Map<string, string>();
  function find(id: string): string {
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  withCoords.forEach((a) => parent.set(a.id, a.id));

  for (let i = 0; i < withCoords.length; i++) {
    const a = withCoords[i];
    const latA = parseFloat(a.latitude);
    const lonA = parseFloat(a.longitude);
    for (let j = i + 1; j < withCoords.length; j++) {
      const b = withCoords[j];
      const latB = parseFloat(b.latitude);
      const lonB = parseFloat(b.longitude);
      if (Math.abs(latA - latB) > 0.01) continue;
      if (haversineMeters(latA, lonA, latB, lonB) <= thresholdMeters) union(a.id, b.id);
    }
  }

  const roots = new Set(withCoords.map((a) => find(a.id)));
  // Банкоматы без координат не участвуют в кластеризации, но каждый
  // всё равно считается отдельной точкой — иначе они выпали бы из KPI.
  const withoutCoords = atms.length - withCoords.length;
  return roots.size + withoutCoords;
}
