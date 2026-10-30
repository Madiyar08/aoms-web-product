import { listStatuses } from "./statuses";
import { listChangeRequests } from "./atm-change-history";

/**
 * ЕДИНОЕ место, где записано, какие статусы исключают банкомат из
 * маршрута. Раньше четыре места в коде (построение маршрута, проверка
 * устаревания, страница анализа, автоперестройка) независимо читали
 * флаг includeInRouting из справочника статусов — и вместе с ним
 * исключали ВСЕ статусы кроме "Работает". Это было ошибкой: статус
 * "Проблемный" система ставит автоматически на любую заявку ("нет
 * наклейки", "не получен чек"...), и сотни банкоматов, которые экипаж
 * спокойно чистит, выпали из маршрутов. Руководитель: "даже если
 * банкомат не работает, сотрудники его чистят".
 *
 * Правило теперь такое:
 *  - ВСЕГДА исключаются только те, куда экипаж физически не может или не
 *    должен ехать: демонтирован, закрытая территория, обслуживается
 *    сотрудниками филиала;
 *  - "Проблемный" исключается ТОЛЬКО если по банкомату висит
 *    неподтверждённая заявка на смену ID — тогда старый ID в списке уже
 *    не соответствует тому, что написано на корпусе, и сотрудник не
 *    найдёт банкомат. Как только заявка подтвердится (3 дня или вручную)
 *    и ID в базе обновится, банкомат возвращается в маршрут;
 *  - остальные статусы ("Не работает", "На ремонте", "Новый банкомат",
 *    "Без ID" и т.д.) в маршрут допускаются.
 *
 * Флаг includeInRouting в справочнике больше не используется для отбора.
 */
export const ALWAYS_EXCLUDED_STATUS_NAMES: ReadonlySet<string> = new Set([
  "Демонтирован",
  "Закрытая территория",
  "Обслуживается сотрудниками филиала",
]);

export const PROBLEM_STATUS_NAME = "Проблемный";
export const PENDING_ID_CHANGE_LABEL = "Проблемный: смена ID не подтверждена";

/** Банкоматы, по которым сейчас висит неподтверждённая заявка на смену ID. */
export function atmIdsWithPendingIdChange(): Set<string> {
  return new Set(
    listChangeRequests()
      .filter((r) => r.status === "pending" && r.changeType === "id_change" && r.atmId)
      .map((r) => r.atmId)
  );
}

/**
 * Возвращает функцию проверки: для банкомата отдаёт подпись причины
 * исключения (для разбивки на экране) или null, если по статусу он
 * допускается в маршрут. Данные справочника и очереди читаются один раз
 * при создании проверки, а не на каждый банкомат.
 */
export function createStatusExclusionChecker(): (atm: { id: string; workStatusId: string }) => string | null {
  const nameById = new Map(listStatuses().map((s) => [s.id, s.name]));
  const pendingIdChange = atmIdsWithPendingIdChange();

  return (atm) => {
    if (!atm.workStatusId) return null;
    const name = nameById.get(atm.workStatusId);
    if (!name) return null;
    if (ALWAYS_EXCLUDED_STATUS_NAMES.has(name)) return name;
    if (name === PROBLEM_STATUS_NAME && pendingIdChange.has(atm.id)) return PENDING_ID_CHANGE_LABEL;
    return null;
  };
}
