import { insertRow, readAll, updateRow, findById } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "atm_issues";

/**
 * Единая форма "ATMs with problem" (объединяет прежние раздельные формы
 * "Проблемный банкомат" и "Нет наклейки/не работает/нет чека" — по
 * запросу руководителя от 2026-07: сотрудник не должен выбирать между
 * двумя похожими формами и тем более сначала оформлять отчёт об очистке,
 * чтобы просто сообщить о проблеме).
 *
 * Причины — множественный выбор (можно отметить несколько сразу,
 * например "не работает" + "нет наклейки").
 */
export const ISSUE_REASONS = [
  "Не работает",
  "Нет наклейки с ID",
  "Не удалось получить чек",
  "Чек получен",
  "Сломана дверь",
  "Оборван кабель",
  "Неправильный адрес",
  "Неправильные координаты",
  "Неправильный район",
  "Другое",
] as const;

export interface AtmIssue extends BaseEntity {
  atmId: string; // может быть пустым, если банкомат не найден в базе
  atmCode: string;
  address: string;
  latitude: string;
  longitude: string;
  reasons: string[]; // подмножество ISSUE_REASONS
  otherText: string; // пояснение, если выбрано "Другое"
  comment: string;
  employeeId: string;
  employeeName: string;
  photosJson?: string;
  status: string; // "Новый" | "Разобран"
  lastNotifyResult: string;
}

export function createAtmIssue(data: Omit<AtmIssue, keyof BaseEntity>): AtmIssue {
  const row: AtmIssue = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function listAtmIssues(): AtmIssue[] {
  return readAll<AtmIssue>(TABLE).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getAtmIssueById(id: string): AtmIssue | null {
  return findById<AtmIssue>(TABLE, id);
}

export function updateAtmIssue(id: string, patch: Partial<Omit<AtmIssue, keyof BaseEntity>>): boolean {
  return updateRow<AtmIssue>(TABLE, id, patch);
}
