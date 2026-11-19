import { deleteRow, findById, insertRow, readAll, updateRow, withTransaction } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { listAtms } from "./atms";
import { listCategories } from "./categories";
import { createStatusExclusionChecker } from "./routing-rules";
import { getScheduleById } from "./schedule";
import { isYandexRoutingConfigured, optimizeRouteOrder } from "./yandex-routing";
import { getSettingValue } from "./settings";
import { clusterNearbyPoints, flattenClusterMemberIndexes, nearestNeighborOrder, twoOptImprove, GeoPoint } from "./geo";
import { todayTashkent } from "./tz";
import { isValidRouteCoordinate } from "./route-coordinate";
import { findAlreadyAssignedAtmIds } from "./route-assignment";
import { normalizeRouteExcludedAtms, RouteExcludedAtmDetail } from "./route-exclusion-details";

const TABLE = "routes";

/** Банкоматы ближе этого расстояния друг к другу считаются одной остановкой на карте. */
const CLUSTER_THRESHOLD_M = 30;

/** Публичная ссылка yandex.ru/maps?rtext=... перестаёт открываться в приложении,
 * если точек больше этого числа — поэтому длинные маршруты режем на отрезки. */
const MAX_POINTS_PER_YANDEX_LINK = 20;

export type RouteExcludedAtm = RouteExcludedAtmDetail;

export interface RouteEntry extends BaseEntity {
  scheduleId: string;
  date: string;
  machineId: string;
  atmIds: string[];
  excludedCount: number;
  excludedByCategory: number;
  excludedByStatus: number;
  excludedByCategoryDetail: Record<string, number>;
  excludedByStatusDetail: Record<string, number>;
  excludedNoCoords: number;
  excludedDistrictMismatch: number;
  /** ATM already assigned to another crew on the same date. */
  excludedAlreadyAssigned?: number;
  /** Детализация исключённых ATM для разбора руководителем. */
  excludedAtms?: RouteExcludedAtm[];
  remainingForTomorrow: number;
  /** Одна или несколько ссылок — маршрут режется на отрезки по MAX_POINTS_PER_YANDEX_LINK точек,
   * т.к. Яндекс.Карты не открывают построение маршрута по ссылке, если точек больше лимита. */
  yandexUrls: string[];
  /** Сколько всего остановок на карте после объединения близких банкоматов (см. CLUSTER_THRESHOLD_M) */
  stopsCount: number;
  status: string; // Построен | Отправлен
  lastSendResult: string;
  /** Точное время последней попытки отправки маршрута; отсутствует у старых записей. */
  lastSentAt?: string;
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
    excludedByCategoryDetail: route.excludedByCategoryDetail ?? {},
    excludedByStatusDetail: route.excludedByStatusDetail ?? {},
    excludedAlreadyAssigned: route.excludedAlreadyAssigned ?? 0,
    excludedAtms: normalizeRouteExcludedAtms(route.excludedAtms),
  };
}

export function listRoutes(): RouteEntry[] {
  return readAll<RouteEntry>(TABLE).map(normalizeRoute);
}

/**
 * Вызывать после того, как категория или статус банкомата сменились на
 * ИСКЛЮЧАЮЩИЕ (Внутри здания, Проблемный и т.п.) — находит уже
 * построенные маршруты на СЕГОДНЯ и будущие даты, где этот банкомат
 * есть, и перестраивает их. Раньше список у сотрудника оставался
 * устаревшим до тех пор, пока руководитель вручную не зайдёт на
 * страницу "Маршруты" и не нажмёт "Построить заново" — теперь
 * происходит само, сразу при смене категории/статуса. Прошлые даты не
 * трогаем — это уже история, её незачем перестраивать.
 */
export async function rebuildRoutesContainingAtm(atmId: string): Promise<number> {
  const today = todayTashkent();
  const routes = listRoutes().filter((r) => r.atmIds.includes(atmId));
  let rebuilt = 0;
  for (const route of routes) {
    const schedule = getScheduleById(route.scheduleId);
    if (!schedule || schedule.date < today) continue;
    await buildRouteForSchedule(route.scheduleId);
    rebuilt += 1;
  }
  return rebuilt;
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
 * Исключает ТОЛЬКО банкоматы категории "Внутри здания" (или любой другой
 * с excludedFromRouting=true) — по прямому решению руководителя все
 * остальные банкоматы территории должны попадать в маршрут, включая
 * банкоматы с неподтверждённым статусом. Единственное техническое
 * ограничение — банкомат должен иметь координаты (иначе физически
 * нечего наносить на карту).
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
 *
 * Если точек (остановок) больше, чем KPI-цель на день — экипаж физически
 * не успеет объехать все за один день (например, территория в 80–100
 * банкоматов, а экипаж успевает 50–60). Берём только kpiTarget САМЫХ
 * ДАВНО НЕОБСЛУЖЕННЫХ остановок; остальные не теряются — они останутся
 * "давно не обслуженными" и автоматически окажутся в начале очереди при
 * следующей постройке маршрута (см. сортировку по lastCleanedDate ниже).
 */
/**
 * Общая логика отбора банкоматов территории — используется и при
 * построении маршрута, и при проверке "не устарел ли уже построенный
 * маршрут" (isRouteStale), чтобы обе проверки не могли разойтись между
 * собой. См. подробное описание принципа отбора по полигону территории
 * выше, в комментарии к buildRouteForSchedule.
 */
function computeEligibleAtms(schedule: { districts: string[] }): {
  eligible: ReturnType<typeof listAtms>;
  excludedByCategory: number;
  excludedByStatus: number;
  excludedNoCoords: number;
  excludedByCategoryDetail: Record<string, number>;
  excludedByStatusDetail: Record<string, number>;
  excludedAtms: RouteExcludedAtm[];
} {
  const categories = listCategories();
  const excludedCategoryIds = new Set(categories.filter((c) => c.excludedFromRouting).map((c) => c.id));
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  // Правило по статусам — в одном месте (lib/routing-rules.ts), чтобы
  // построение маршрута, проверка устаревания и страница анализа не
  // могли разойтись.
  const statusExclusionLabel = createStatusExclusionChecker();

  const allAtms = listAtms();

  // ОТКЛЮЧЕНО ПО РЕШЕНИЮ РУКОВОДИТЕЛЯ: отбор по нарисованному полигону
  // территории оказался на практике ненадёжным (граница часто рисуется
  // неточно/непредсказуемо — вспомним случай "137 исключены" из-за
  // одного кривого полигона). Возвращаемся к простому и предсказуемому
  // способу — точное текстовое совпадение поля "район" у банкомата с
  // именем в расписании. Модуль district-boundaries.ts и вся собранная
  // там разметка НЕ удалены — только не участвуют в отборе банкоматов
  // для маршрута. Если полигоны понадобятся снова (например, для другой
  // задачи), лежат готовые.
  const candidateIds = new Set<string>();
  for (const districtName of schedule.districts) {
    for (const a of allAtms) {
      if (a.district === districtName) candidateIds.add(a.id);
    }
  }
  const candidateAtms = allAtms.filter((a) => candidateIds.has(a.id));

  // Исключение по статусу — узкое (см. lib/routing-rules.ts): только
  // "Демонтирован", "Закрытая территория", "Обслуживается сотрудниками
  // филиала" и "Проблемный" с неподтверждённой заявкой на смену ID.
  // Раньше исключались ВСЕ статусы кроме "Работает", и в том числе сотни
  // банкоматов с автоматически поставленным "Проблемный", которые экипаж
  // спокойно чистит.
  //
  // Помимо общего числа считаем разбивку по КОНКРЕТНОЙ причине — чтобы
  // на экране было видно, что именно исключено, а не одна цифра.
  let excludedByCategory = 0;
  let excludedByStatus = 0;
  let excludedNoCoords = 0;
  const excludedByCategoryDetail: Record<string, number> = {};
  const excludedByStatusDetail: Record<string, number> = {};
  const excludedAtms: RouteExcludedAtm[] = [];
  const eligible = candidateAtms.filter((a) => {
    if (a.categoryId && excludedCategoryIds.has(a.categoryId)) {
      excludedByCategory += 1;
      const name = categoryNameById.get(a.categoryId) || "(неизвестная категория)";
      excludedByCategoryDetail[name] = (excludedByCategoryDetail[name] || 0) + 1;
      excludedAtms.push({ atmId: a.id, code: a.code || "", name: a.name || "", district: a.district || "", reason: `Категория: ${name}` });
      return false;
    }
    const statusLabel = statusExclusionLabel(a);
    if (statusLabel) {
      excludedByStatus += 1;
      excludedByStatusDetail[statusLabel] = (excludedByStatusDetail[statusLabel] || 0) + 1;
      excludedAtms.push({ atmId: a.id, code: a.code || "", name: a.name || "", district: a.district || "", reason: `Статус: ${statusLabel}` });
      return false;
    }
    // A coordinate pair must be finite and inside Uzbekistan. parseFloat alone
    // accepts malformed values such as "41.3oops" and Infinity/0,0 can leak
    // into routing links and send crews to an unrelated location.
    if (!isValidRouteCoordinate(a.latitude, a.longitude)) {
      excludedNoCoords += 1;
      excludedAtms.push({ atmId: a.id, code: a.code || "", name: a.name || "", district: a.district || "", reason: "Нет координат или координаты некорректны" });
      return false;
    }
    return true;
  });

  return { eligible, excludedByCategory, excludedByStatus, excludedNoCoords, excludedByCategoryDetail, excludedByStatusDetail, excludedAtms };
}

export async function buildRouteForSchedule(scheduleId: string): Promise<RouteEntry | { error: string }> {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) return { error: "Запись расписания не найдена" };

  const {
    eligible: eligibleAtms,
    excludedByCategory,
    excludedByStatus,
    excludedNoCoords,
    excludedByCategoryDetail,
    excludedByStatusDetail,
    excludedAtms: baseExcludedAtms,
  } = computeEligibleAtms(schedule);
  const excludedDistrictMismatch = 0; // точный отбор по району; полигоны не используются в маршрутизации
  // Один ATM не должен попасть в два экипажа в один день. Уже построенные
  // маршруты других назначений считаются занятыми; свой маршрут при пересчёте
  // не блокирует собственные точки.
  const alreadyAssigned = findAlreadyAssignedAtmIds(
    eligibleAtms.map((a) => a.id), listRoutes(), schedule.date, scheduleId
  );
  let eligible = eligibleAtms.filter((a) => !alreadyAssigned.has(a.id));
  const excludedAlreadyAssigned = alreadyAssigned.size;
  const alreadyAssignedDetails: RouteExcludedAtm[] = eligibleAtms
    .filter((atm) => alreadyAssigned.has(atm.id))
    .map((atm) => ({
      atmId: atm.id,
      code: atm.code || "",
      name: atm.name || "",
      district: atm.district || "",
      reason: "Уже назначен другому экипажу на эту дату",
    }));
  const excludedAtms = [...baseExcludedAtms, ...alreadyAssignedDetails];

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
  let clusters = clusterNearbyPoints(rawPoints, CLUSTER_THRESHOLD_M);
  const mergedCount = rawPoints.length - clusters.length;

  // ОГРАНИЧЕНИЕ ПО KPI: территория может содержать больше точек, чем
  // экипаж физически успевает за день (например, 80–100 банкоматов при
  // норме 50–60 точек в день). rawPoints/eligible уже отсортированы по
  // давности необслуживания ДО кластеризации, поэтому clusters идут в
  // том же приоритетном порядке — берём только первые kpiTarget,
  // остальные НЕ теряются: они останутся "давно не обслуженными" и
  // окажутся в начале очереди при следующей постройке маршрута.
  let remainingForTomorrow = 0;
  if (schedule.kpiTarget > 0 && clusters.length > schedule.kpiTarget) {
    remainingForTomorrow = clusters.length - schedule.kpiTarget;
    clusters = clusters.slice(0, schedule.kpiTarget);
  }

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
  if (remainingForTomorrow > 0) {
    optimizationNote += ` Территория больше дневной нормы (KPI ${schedule.kpiTarget}) — ${remainingForTomorrow} точек перенесено на следующий раз (самые давно необслуженные вошли в этот маршрут).`;
  }

  // Разворачиваем порядок кластеров обратно в порядок банкоматов.
  // Все ATM одной физической остановки (включая Smart ATM рядом друг
  // с другом) остаются подряд и не разрываются оптимизацией.
  eligible = flattenClusterMemberIndexes(clusters, clusterOrder).map((index) => eligible[index]);
  const orderedStopPoints = clusterOrder.map((clusterIdx) => clusters[clusterIdx].point);

  const yandexUrls = buildYandexRouteUrls(orderedStopPoints);
  if (yandexUrls.length > 1) {
    optimizationNote += ` Маршрут разбит на ${yandexUrls.length} ссылки (лимит Яндекс.Карт — ${MAX_POINTS_PER_YANDEX_LINK} точек на ссылку) — открывайте по очереди.`;
  }

  const excludedCount = excludedByCategory + excludedByStatus + excludedNoCoords + excludedDistrictMismatch + excludedAlreadyAssigned;

  const existing = getRouteByScheduleId(scheduleId);
  const commonFields = {
    atmIds: eligible.map((a) => a.id),
    excludedCount,
    excludedByCategory,
    excludedByStatus,
    excludedByCategoryDetail,
    excludedByStatusDetail,
    excludedNoCoords,
    excludedDistrictMismatch,
    excludedAlreadyAssigned,
    excludedAtms,
    remainingForTomorrow,
    yandexUrls,
    stopsCount: clusters.length,
    optimized,
    optimizationNote,
  };

  // Final guard is deliberately synchronous and transactional. Route
  // optimization above may await an external API; another crew can finish
  // building while this request is waiting. Re-check immediately before
  // persistence so the same ATM cannot be committed to two crews.
  return withTransaction(() => {
    const latestRoutes = listRoutes();
    const lateConflicts = findAlreadyAssignedAtmIds(
      commonFields.atmIds, latestRoutes, schedule.date, scheduleId
    );
    if (lateConflicts.size > 0) {
      return {
        error: `Маршрут не сохранён: ${lateConflicts.size} банкомат(ов) уже назначены другому экипажу на ${schedule.date}. Перестройте маршрут повторно.`,
      };
    }

    const latestExisting = latestRoutes.find((r) => r.scheduleId === scheduleId);
    if (latestExisting) {
      updateRow<RouteEntry>(TABLE, latestExisting.id, { ...commonFields, updatedAt: nowIso() });
      return { ...latestExisting, ...commonFields };
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
  });
}

export function markRouteSent(routeId: string, resultText: string): boolean {
  return updateRow<RouteEntry>(TABLE, routeId, {
    status: "Отправлен",
    lastSendResult: resultText,
    lastSentAt: nowIso(),
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

  const { eligible } = computeEligibleAtms(schedule);
  const currentEligibleIds = new Set(eligible.map((a) => a.id));

  // ВАЖНО: маршрут теперь может содержать МЕНЬШЕ банкоматов, чем всего
  // допустимо на территории (ограничение по KPI — берём только
  // kpiTarget самых давно необслуженных, остальные переносятся на
  // завтра, см. buildRouteForSchedule). Поэтому сравнивать размеры
  // множеств нельзя — "меньше, чем могло бы быть" это НЕ признак
  // устаревания. Устаревшим считаем маршрут только если в нём есть
  // банкомат, который СЕЙЧАС уже не подходит вовсе (например, категорию
  // сменили на "Внутри здания" уже после постройки).
  const routeIds = new Set(route.atmIds);
  for (const id of routeIds) {
    if (!currentEligibleIds.has(id)) return true;
  }
  return false;
}
