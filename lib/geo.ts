/**
 * Гео-утилиты для построения маршрутов:
 *  - расстояние между точками (формула гаверсинуса);
 *  - объединение точек, находящихся ближе заданного порога (например,
 *    несколько банкоматов в одном здании/ТЦ — это одна остановка на карте);
 *  - бесплатная локальная оптимизация порядка объезда (ближайший сосед +
 *    2-opt), которая работает всегда, без внешнего платного API.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Cluster {
  /** Центроид кластера (обновляется по мере добавления точек) */
  point: GeoPoint;
  /** Индексы исходного массива points, попавшие в этот кластер */
  memberIndexes: number[];
}

/**
 * Группирует точки, находящиеся не дальше thresholdM друг от друга, в
 * один "стоп" на карте (жадный алгоритм по порядку появления точек —
 * для десятков/сотен точек в районе этого достаточно и быстро, O(n·k),
 * где k — число уже созданных кластеров).
 */
export function clusterNearbyPoints(points: GeoPoint[], thresholdM: number): Cluster[] {
  if (!Number.isFinite(thresholdM) || thresholdM < 0) return points.map((point, idx) => ({ point: { ...point }, memberIndexes: [idx] }));
  const clusters: Cluster[] = [];
  points.forEach((point, idx) => {
    let target: Cluster | null = null;
    for (const cluster of clusters) {
      // Complete-link rule: a new ATM must be within the threshold of
      // EVERY member, not merely the moving centroid. This prevents chain
      // merging (A—B—C) where A and C are actually far apart.
      const isCloseToEveryMember = cluster.memberIndexes.every((memberIndex) =>
        haversineMeters(points[memberIndex], point) <= thresholdM
      );
      if (isCloseToEveryMember) {
        target = cluster;
        break;
      }
    }
    if (target) {
      const count = target.memberIndexes.length;
      target.point = {
        lat: (target.point.lat * count + point.lat) / (count + 1),
        lon: (target.point.lon * count + point.lon) / (count + 1),
      };
      target.memberIndexes.push(idx);
    } else {
      clusters.push({ point: { ...point }, memberIndexes: [idx] });
    }
  });
  return clusters;
}

/**
 * Expands optimized cluster order back to ATM indexes. Members of each
 * physical stop remain adjacent, so Smart ATM groups / terminals sharing
 * one location are always visited in one consecutive block.
 */
export function flattenClusterMemberIndexes(clusters: Cluster[], clusterOrder: number[]): number[] {
  const flattened: number[] = [];
  const seen = new Set<number>();
  for (const clusterIndex of clusterOrder) {
    const cluster = clusters[clusterIndex];
    if (!cluster) continue;
    for (const memberIndex of cluster.memberIndexes) {
      if (seen.has(memberIndex)) continue;
      seen.add(memberIndex);
      flattened.push(memberIndex);
    }
  }
  return flattened;
}

/** Жадный алгоритм "ближайший сосед", начиная от депо. */
export function nearestNeighborOrder(depot: GeoPoint, points: GeoPoint[]): number[] {
  const remaining = points.map((_, i) => i);
  const order: number[] = [];
  let current = depot;
  while (remaining.length > 0) {
    let bestPos = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(current, points[remaining[i]]);
      if (d < bestDist) {
        bestDist = d;
        bestPos = i;
      }
    }
    const chosen = remaining.splice(bestPos, 1)[0];
    order.push(chosen);
    current = points[chosen];
  }
  return order;
}

/**
 * Локальное улучшение маршрута (2-opt) поверх порядка "ближайшего
 * соседа" — устраняет типичные "самопересечения" маршрута. Работает
 * без внешнего API, поэтому маршрут оптимизируется даже когда платная
 * Яндекс.Маршрутизация не подключена.
 */
export function twoOptImprove(depot: GeoPoint, points: GeoPoint[], initialOrder: number[], maxPasses = 8): number[] {
  const order = [...initialOrder];
  const n = order.length;
  if (n < 4) return order;

  const nodeAt = (posInOrder: number): GeoPoint => (posInOrder === -1 ? depot : points[order[posInOrder]]);

  for (let pass = 0; pass < maxPasses; pass++) {
    let improvedAny = false;
    for (let i = 0; i < n - 1; i++) {
      let improvedHere = true;
      while (improvedHere) {
        improvedHere = false;
        const a = nodeAt(i - 1);
        const b = nodeAt(i);
        for (let j = i + 1; j < n; j++) {
          const c = nodeAt(j);
          const hasNext = j + 1 < n;
          const d = hasNext ? nodeAt(j + 1) : null;
          const before = haversineMeters(a, b) + (d ? haversineMeters(c, d) : 0);
          const after = haversineMeters(a, c) + (d ? haversineMeters(b, d) : 0);
          if (after + 0.5 < before) {
            const segment = order.slice(i, j + 1).reverse();
            order.splice(i, segment.length, ...segment);
            improvedHere = true;
            improvedAny = true;
            break;
          }
        }
      }
    }
    if (!improvedAny) break;
  }
  return order;
}

/** Разбивает массив на подмассивы не длиннее chunkSize (сохраняя порядок). */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
