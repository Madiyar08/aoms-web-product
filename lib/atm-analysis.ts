import { listAtms, Atm } from "./atms";
import { listCategories } from "./categories";
import { listStatuses } from "./statuses";
import { listSchedule } from "./schedule";
import { listCleaningReports } from "./cleaning-reports";
import { listAtmIssues } from "./atm-issues";

/**
 * Полный анализ базы банкоматов — сколько есть, сколько актуальны,
 * сколько никогда не очищалось и ПОЧЕМУ (5 разных причин, а не просто
 * общая цифра), сколько проблемных. Строится каждый раз заново из
 * текущего состояния базы — не кешируется, потому что запрашивается
 * нечасто (не на каждой загрузке страницы, только вручную).
 */
export interface AtmAnalysis {
  total: number;
  byCategory: { name: string; count: number; excludedFromRouting: boolean }[];
  byStatus: { name: string; count: number; excludedFromRouting: boolean }[];
  active: number; // не в исключающей категории И не в исключающем статусе (реально может попасть в маршрут)

  neverCleaned: {
    total: number;
    excludedByCategory: number; // "Внутри здания" и т.п. — не должны очищаться, это нормально
    noCoordinates: number; // технически нельзя построить маршрут
    districtNeverScheduled: number; // район вообще ни разу не назначался ни одному экипажу
    scheduledButNotReached: number; // район назначался, но конкретно этот банкомат ещё не дошла очередь
  };

  problem: {
    byStatusProblem: number; // статус "Проблемный"
    pendingIssues: number; // открытые заявки "Банкомат с проблемой" (не разобрано)
  };

  // ЕДИНЫЙ показатель "не обслуживается прямо сейчас, по любой причине" —
  // раньше приходилось вручную открывать оба отчёта (никогда не очищено
  // + проблемные) и складывать самостоятельно. Считаем ОБЪЕДИНЕНИЕ, не
  // простую сумму — банкомат может одновременно быть и "никогда не
  // очищен", и "проблемный", простое сложение задвоило бы его.
  notServiceableNow: {
    total: number;
    neverCleanedCount: number;
    problemStatusCount: number;
    overlapCount: number; // сколько банкоматов попали в оба списка сразу
  };
}

export function buildAtmAnalysis(): AtmAnalysis {
  const atms = listAtms();
  const categories = listCategories();
  const statuses = listStatuses();
  const schedule = listSchedule();
  const reports = listCleaningReports();
  const issues = listAtmIssues();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const excludedCategoryIds = new Set(categories.filter((c) => c.excludedFromRouting).map((c) => c.id));
  const excludedStatusIds = new Set(statuses.filter((s) => !s.includeInRouting).map((s) => s.id));

  // ── По категориям и статусам ──────────────────────────────
  const byCategoryMap = new Map<string, number>();
  for (const a of atms) {
    const name = a.categoryId ? categoryById.get(a.categoryId)?.name || "(неизвестная категория)" : "— без категории —";
    byCategoryMap.set(name, (byCategoryMap.get(name) || 0) + 1);
  }
  const byCategory = Array.from(byCategoryMap.entries()).map(([name, count]) => ({
    name,
    count,
    excludedFromRouting: categories.find((c) => c.name === name)?.excludedFromRouting || false,
  }));

  const byStatusMap = new Map<string, number>();
  for (const a of atms) {
    const name = a.workStatusId ? statusById.get(a.workStatusId)?.name || "(неизвестный статус)" : "— без статуса —";
    byStatusMap.set(name, (byStatusMap.get(name) || 0) + 1);
  }
  const byStatus = Array.from(byStatusMap.entries()).map(([name, count]) => ({
    name,
    count,
    excludedFromRouting: statuses.find((s) => s.name === name)?.includeInRouting === false,
  }));

  // "Актуальные" теперь учитывает и категорию, И статус — раньше статус
  // не проверялся здесь (та же забытая проверка, что чинили в routes.ts).
  const active = atms.filter(
    (a) =>
      (!a.categoryId || !excludedCategoryIds.has(a.categoryId)) &&
      (!a.workStatusId || !excludedStatusIds.has(a.workStatusId))
  ).length;

  // ── Никогда не очищенные — с разбивкой по причине ─────────────
  const neverCleanedAtms = atms.filter((a) => !a.lastCleanedDate);

  const scheduledDistricts = new Set(schedule.flatMap((s) => s.districts));

  let excludedByCategory = 0;
  let noCoordinates = 0;
  let districtNeverScheduled = 0;
  let scheduledButNotReached = 0;

  for (const a of neverCleanedAtms) {
    if (a.categoryId && excludedCategoryIds.has(a.categoryId)) {
      excludedByCategory += 1;
      continue;
    }
    const lat = parseFloat(a.latitude);
    const lon = parseFloat(a.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      noCoordinates += 1;
      continue;
    }
    if (!scheduledDistricts.has(a.district)) {
      districtNeverScheduled += 1;
      continue;
    }
    // Координаты есть, категория обычная, район хоть раз назначался
    // экипажу — но отчёта так и не было. Либо ещё не дошла очередь
    // (KPI-ограничение оставляет часть точек "на потом"), либо был
    // реальный сбой (опечатка в коде и т.д. — тут уже нужно смотреть
    // конкретные банкоматы вручную).
    scheduledButNotReached += 1;
  }

  // ── Проблемные ──────────────────────────────────────────────
  const problemStatus = statuses.find((s) => s.name === "Проблемный");
  const problemAtmIds = new Set(problemStatus ? atms.filter((a) => a.workStatusId === problemStatus.id).map((a) => a.id) : []);
  const byStatusProblem = problemAtmIds.size;
  const pendingIssues = issues.filter((i) => i.status !== "Разобран").length;

  // ── Единый показатель "не обслуживается сейчас" ───────────────
  const neverCleanedIds = new Set(neverCleanedAtms.map((a) => a.id));
  const overlapCount = atms.filter((a) => neverCleanedIds.has(a.id) && problemAtmIds.has(a.id)).length;
  const notServiceableTotal = neverCleanedIds.size + problemAtmIds.size - overlapCount;

  return {
    total: atms.length,
    byCategory,
    byStatus,
    active,
    neverCleaned: {
      total: neverCleanedAtms.length,
      excludedByCategory,
      noCoordinates,
      districtNeverScheduled,
      scheduledButNotReached,
    },
    problem: {
      byStatusProblem,
      pendingIssues,
    },
    notServiceableNow: {
      total: notServiceableTotal,
      neverCleanedCount: neverCleanedIds.size,
      problemStatusCount: problemAtmIds.size,
      overlapCount,
    },
  };
}
