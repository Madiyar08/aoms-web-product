import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { listAtms } from "./atms";
import { listCategories } from "./categories";
import { listStatuses } from "./statuses";
import { getScheduleById } from "./schedule";
import { isYandexRoutingConfigured, optimizeRouteOrder } from "./yandex-routing";
import { getSettingValue } from "./settings";
import { findDistrictMismatches } from "./district-check";
import { listDistrictBoundaries, pointInPolygon } from "./district-boundaries";
import { clusterNearbyPoints, nearestNeighborOrder, twoOptImprove, GeoPoint } from "./geo";

const TABLE = "routes";

/** Банкоматы ближе этого расстояния друг к другу считаются одной остановкой на карте. */
const CLUSTER_THRESHOLD_M = 30;

/** Публичная ссылка yandex.ru/maps?rtext=... перестаёт открываться в приложении,
 * если точек больше этого числа — поэтому длинные маршруты режем на отрезки. */
const MAX_POINTS_PER_YANDEX_LINK = 20;

export interface RouteEntry extends BaseEntity {
  scheduleId: string;
  date: string;
  machineId: string;
  atmIds: string[];
  excludedCount: number;
  excludedByCategory: number;
  excludedByStatus: number;
  excludedNoCoords: number;
  excludedDistrictMismatch: number;
  /** Одна или несколько ссылок — маршрут режется на отрезки по MAX_POINTS_PER_YANDEX_LINK точек,
   * т.к. Яндекс.Карты не открывают построение маршрута по ссылке, если точек больше лимита. */
  yandexUrls: string[];
  /** Сколько всего остановок на карте после объединения близких банкоматов (см. CLUSTER_THRESHOLD_M) */
  stopsCount: number;
  status: string; // Построен | Отправлен
  lastSendResult: string;
  optimized: boolean; // true — порядок посчитан (Яндекс.Маршрутизацией или локальным алгоритмом)
  optimizationNote: string; // как именно оптимизирован маршрут / метрики, если есть
}

/**
 * Старые записи маршрутов (построенные до появления разбивки на отрезки/
 * кластеризации) хранятся в базе без полей yandexUrls/stopsCount — только
 * старое одиночное yandexUrl. Без этой нормализации страница `/routes`
 * падает с "Cannot read properties of undefined (reading 'map')" на любой
 * записи, построенной до обновления кода. Приводим к новой форме на лету,
 * не трогая сами данные в базе (миграция не нужна).
 */
function normalizeRoute(route: RouteEntry): RouteEntry {
  const legacy = route as RouteEntry & { yandexUrl?: string };
  const yandexUrls = Array.isArray(route.yandexUrls) ? route.yandexUrls : legacy.yandexUrl ? [legacy.yandexUrl] : [];
  return {
    ...route,
    yandexUrls,
    stopsCount: typeof route.stopsCount === "number" ? route.stopsCount : route.atmIds?.length ?? 0,
    optimized: typeof route.optimized === "boolean" ? route.optimized : false,
    optimizationNote: route.optimizationNote ?? "",
  };
}

export function listRoutes(): RouteEntry[] {
  return readAll<RouteEntry>(TABLE).map(normalizeRoute);
}

export function getRouteById(id: string): RouteEntry | null {
  const route = findById<RouteEntry>(TABLE, id);
  return route ? normalizeRoute(route) : null;
}

export function getRouteByScheduleId(scheduleId: string): RouteEntry | null {
  return listRoutes().find((r) => r.scheduleId === scheduleId) ?? null;
}

/**
 * Строит ссылку на маршрут в Яндекс Картах через публичный
 * URL-протокол (rtext=lat,lon~lat,lon...) — не требует API-ключа.
 * Точки идут в том порядке, в котором переданы в points.
 */
export function buildYandexRouteUrl(points: Array<{ lat: number; lon: number }>): string {
  const rtext = points.map((p) => `${p.lat},${p.lon}`).join("~");
  return `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=auto`;
}

/**
 * Режет точки маршрута на отрезки так, чтобы КАЖДАЯ ссылка не превышала
 * MAX_POINTS_PER_YANDEX_LINK точек. Без этого при большом числе точек
 * (например, 69 банкоматов в одном районе) ссылка технически формируется,
 * но кнопка "Построить маршрут" в приложении Яндекс.Карт не появляется —
 * сервис ограничивает публичный rtext-маршрут 20 точками.
 *
 * Чтобы отрезки не рвали логику объезда, последняя точка предыдущего
 * отрезка повторяется первой точкой следующего — так каждая ссылка
 * ведёт "оттуда, где закончили". Важно: с учётом этой добавленной точки
 * ссылка ВСЁ РАВНО не должна превышать лимит — поэтому каждый отрезок,
 * кроме первого, режем на 1 точку короче, оставляя место под "мостик".
 * (Раньше отрезок резался ровно по лимиту, а мостик добавлялся сверху —
 * получалось 21 точка, и Яндекс.Карты отказывались строить маршрут.)
 */
export function buildYandexRouteUrls(points: GeoPoint[]): string[] {
  if (points.length === 0) return [];
  if (points.length <= MAX_POINTS_PER_YANDEX_LINK) return [buildYandexRouteUrl(points)];

  const urls: string[] = [];
  urls.push(buildYandexRouteUrl(points.slice(0, MAX_POINTS_PER_YANDEX_LINK)));

  const STEP = MAX_POINTS_PER_YANDEX_LINK - 1; // -1 точка отдана под "мостик"
  let bridgePoint = points[MAX_POINTS_PER_YANDEX_LINK - 1];
  let cursor = MAX_POINTS_PER_YANDEX_LINK;

  while (cursor < points.length) {
    const chunk = points.slice(cursor, cursor + STEP);
    urls.push(buildYandexRouteUrl([bridgePoint, ...chunk]));
    bridgePoint = chunk[chunk.length - 1];
    cursor += STEP;
  }

  return urls;
}

/**
 * Строит (или пересчитывает) маршрут для записи расписания.
 *
 * Исключает банкоматы: категорий с excludedFromRouting=true, статусов
 * с includeInRouting=false, без валидных координат.
 *
 * Порядок объезда считается всегда: если настроен YANDEX_ROUTING_API_KEY
 * и остановок не больше лимита бесплатного тарифа — через API «Яндекс
 * Маршрутизация»; иначе (ключа нет, API вернул ошибку, либо остановок
 * больше лимита) — локальным алгоритмом (ближайший сосед + 2-opt), чтобы
 * маршрут не оставался "как есть в базе" молча. Причина/метод всегда
 * видны в optimizationNote.
 *
 * Банкоматы ближе CLUSTER_THRESHOLD_M метров друг к другу объединяются в
 * одну точку на карте, а итоговый маршрут режется на несколько ссылок по
 * MAX_POINTS_PER_YANDEX_LINK точек — иначе на телефоне не появляется
 * кнопка "Построить маршрут" в приложении Яндекс.Карт.
 */
export async function buildRouteForSchedule(scheduleId: string): Promise<RouteEntry | { error: string }> {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) return { error: "Запись расписания не найдена" };

  const categories = listCategories();
  const statuses = listStatuses();
  const excludedCategoryIds = new Set(categories.filter((c) => c.excludedFromRouting).map((c) => c.id));
  const excludedStatusIds = new Set(statuses.filter((s) => !s.includeInRouting).map((s) => s.id));

  const candidateAtms = listAtms().filter((a) => schedule.districts.includes(a.district));

  // Район проверяется по координатам, не по тексту из Excel. ПРИОРИТЕТ —
  // точный нарисованный полигон (lib/district-boundaries.ts): если для
  // района руководитель нарисовал границу, банкомат либо внутри нее, либо
  // помечается на проверку — без ложных срабатываний на границах районов.
  // Старый метод "среднее координат" (lib/district-check.ts) СИСТЕМАТИЧЕСКИ
  // ошибался на обычных банкоматах у границы районов (жалобы: "исключает
  // нормальные банкоматы" и одновременно "чужой район просачивается") —
  // используем его ТОЛЬКО как запасной вариант для районов, где полигон
  // ещё не нарисован, а не как основную проверку.
  const boundaries = listDistrictBoundaries();
  const districtsWithBoundary = new Set(boundaries.filter((b) => b.points.length >= 3).map((b) => b.district));
  const centroidMismatches = findDistrictMismatches();
  const centroidMismatchIds = new Set(
    centroidMismatches
      .filter((m) => !districtsWithBoundary.has(m.recordedDistrict)) // только там, где полигона ещё нет
      .map((m) => m.atmId)
  );

  const mismatchedIds = new Set<string>();
  for (const a of candidateAtms) {
    const lat = parseFloat(a.latitude);
    const lon = parseFloat(a.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    if (districtsWithBoundary.has(a.district)) {
      // Точная проверка полигоном — граница для этого района нарисована
      const boundary = boundaries.find((b) => b.district === a.district);
      if (boundary && !pointInPolygon(lat, lon, boundary.points)) {
        mismatchedIds.add(a.id);
      }
    } else if (centroidMismatchIds.has(a.id)) {
      // Запасной грубый метод — только пока границу не нарисовали
      mismatchedIds.add(a.id);
    }
  }

  let excludedByCategory = 0;
  let excludedByStatus = 0;
  let excludedNoCoords = 0;
  let excludedDistrictMismatch = 0;

  let eligible = candidateAtms.filter((a) => {
    if (a.categoryId && excludedCategoryIds.has(a.categoryId)) {
      excludedByCategory += 1;
      return false;
    }
    if (a.workStatusId && excludedStatusIds.has(a.workStatusId)) {
      excludedByStatus += 1;
      return false;
    }
    if (mismatchedIds.has(a.id)) {
      excludedDistrictMismatch += 1;
      return false;
    }
    const lat = parseFloat(a.latitude);
    const lon = parseFloat(a.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      excludedNoCoords += 1;
      return false;
    }
    return true;
  });

  // Приоритет по дате последней очистки (п.10): банкоматы, очищенные
  // недавно, уходят в конец очереди объезда — давно не обслуженные едут
  // первыми. "Никогда не очищен" — наивысший приоритет.
  eligible = eligible.sort((a, b) => {
    const da = a.lastCleanedDate ? Date.parse(a.lastCleanedDate) : -Infinity;
    const db = b.lastCleanedDate ? Date.parse(b.lastCleanedDate) : -Infinity;
    return da - db; // раньше (или никогда) очищенные — первыми
  });

  const depotLat = getSettingValue("depot_latitude", "");
  const depotLon = getSettingValue("depot_longitude", "");
  const rawPoints: GeoPoint[] = eligible.map((a) => ({ lat: parseFloat(a.latitude), lon: parseFloat(a.longitude) }));
  const depot: GeoPoint =
    depotLat && depotLon
      ? { lat: parseFloat(String(depotLat)), lon: parseFloat(String(depotLon)) }
      : rawPoints[0] ?? { lat: 0, lon: 0 };

  // Шаг 1 — объединяем банкоматы ближе CLUSTER_THRESHOLD_M друг к другу
  // в одну остановку на карте (например, несколько устройств в одном ТЦ).
  const clusters = clusterNearbyPoints(rawPoints, CLUSTER_THRESHOLD_M);
  const mergedCount = rawPoints.length - clusters.length;

  let optimized = false;
  let optimizationNote = "";
  let clusterOrder = clusters.map((_, i) => i);

  if (clusters.length >= 2) {
    let usedApi = false;
    if (isYandexRoutingConfigured() && clusters.length <= 50) {
      const result = await optimizeRouteOrder(depot, clusters.map((c) => c.point));
      if (result.ok && result.orderedIndexes) {
        clusterOrder = result.orderedIndexes;
        optimized = true;
        usedApi = true;
        const km = result.totalDistanceM ? (result.totalDistanceM / 1000).toFixed(1) : "?";
        optimizationNote = `Оптимизировано Яндекс.Маршрутизацией, расчётное расстояние ≈ ${km} км.`;
      } else {
        optimizationNote = `Яндекс.Маршрутизация недоступна (${result.error}) — использован локальный расчёт порядка. `;
      }
    }
    if (!usedApi) {
      // Бесплатный запасной вариант: всегда считаем разумный порядок сами
      // (ближайший сосед + 2-opt), а не оставляем "как есть в базе".
      const clusterPoints = clusters.map((c) => c.point);
      const nn = nearestNeighborOrder(depot, clusterPoints);
      clusterOrder = twoOptImprove(depot, clusterPoints, nn);
      optimized = true;
      optimizationNote += "Порядок объезда рассчитан локальным алгоритмом (без Яндекс.Маршрутизации).";
    }
  } else {
    optimizationNote = "Оптимизация не нужна — меньше двух остановок.";
  }

  if (mergedCount > 0) {
    optimizationNote += ` Объединено в одну точку (расстояние ≤ ${CLUSTER_THRESHOLD_M} м): ${mergedCount} банкомат(ов) — итого ${clusters.length} остановок.`;
  }

  // Разворачиваем порядок кластеров обратно в порядок банкоматов
  // (внутри одной остановки — как были найдены).
  eligible = clusterOrder.flatMap((clusterIdx) => clusters[clusterIdx].memberIndexes.map((i) => eligible[i]));
  const orderedStopPoints = clusterOrder.map((clusterIdx) => clusters[clusterIdx].point);

  const yandexUrls = buildYandexRouteUrls(orderedStopPoints);
  if (yandexUrls.length > 1) {
    optimizationNote += ` Маршрут разбит на ${yandexUrls.length} ссылки (лимит Яндекс.Карт — ${MAX_POINTS_PER_YANDEX_LINK} точек на ссылку) — открывайте по очереди.`;
  }

  const excludedCount = excludedByCategory + excludedByStatus + excludedNoCoords + excludedDistrictMismatch;

  const existing = getRouteByScheduleId(scheduleId);
  const commonFields = {
    atmIds: eligible.map((a) => a.id),
    excludedCount,
    excludedByCategory,
    excludedByStatus,
    excludedNoCoords,
    excludedDistrictMismatch,
    yandexUrls,
    stopsCount: clusters.length,
    optimized,
    optimizationNote,
  };

  if (existing) {
    updateRow<RouteEntry>(TABLE, existing.id, { ...commonFields, updatedAt: nowIso() });
    return { ...existing, ...commonFields };
  }

  const row: RouteEntry = {
    id: newId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    scheduleId,
    date: schedule.date,
    machineId: schedule.machineId,
    status: "Построен",
    lastSendResult: "",
    ...commonFields,
  };
  insertRow(TABLE, row);
  return row;
}

export function markRouteSent(routeId: string, resultText: string): boolean {
  return updateRow<RouteEntry>(TABLE, routeId, {
    status: "Отправлен",
    lastSendResult: resultText,
    updatedAt: nowIso(),
  });
}

export function deleteRouteEntry(id: string): boolean {
  return deleteRow(TABLE, id);
}

/**
 * Проверяет, актуален ли уже построенный маршрут: сравнивает набор
 * банкоматов, которые вошли бы в маршрут ПРЯМО СЕЙЧАС (с текущими
 * категориями/статусами/районами), с тем, что реально сохранено в
 * маршруте. Маршрут — это статичный снимок на момент постройки, поэтому
 * если категорию банкомата поменяли ПОСЛЕ построения (например, отметили
 * "Внутри здания"), старый маршрут этого не узнает, пока не пересобрать.
 * Отсюда типичная жалоба "банкомат с категорией 'внутри здания' всё
 * равно в маршруте" — на самом деле в маршруте лежит устаревший список.
 */
export function isRouteStale(route: RouteEntry): boolean {
  const schedule = getScheduleById(route.scheduleId);
  if (!schedule) return false;

  const categories = listCategories();
  const statuses = listStatuses();
  const excludedCategoryIds = new Set(categories.filter((c) => c.excludedFromRouting).map((c) => c.id));
  const excludedStatusIds = new Set(statuses.filter((s) => !s.includeInRouting).map((s) => s.id));
  const mismatchedIds = new Set(findDistrictMismatches().map((m) => m.atmId));

  const currentEligibleIds = new Set(
    listAtms()
      .filter((a) => schedule.districts.includes(a.district))
      .filter((a) => {
        if (a.categoryId && excludedCategoryIds.has(a.categoryId)) return false;
        if (a.workStatusId && excludedStatusIds.has(a.workStatusId)) return false;
        if (mismatchedIds.has(a.id)) return false;
        const lat = parseFloat(a.latitude);
        const lon = parseFloat(a.longitude);
        return !Number.isNaN(lat) && !Number.isNaN(lon);
      })
      .map((a) => a.id)
  );

  const routeIds = new Set(route.atmIds);
  if (currentEligibleIds.size !== routeIds.size) return true;
  for (const id of routeIds) {
    if (!currentEligibleIds.has(id)) return true;
  }
  return false;
}
