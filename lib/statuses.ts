import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "atm_work_statuses";

export interface AtmWorkStatus extends BaseEntity {
  name: string;
  description: string;
  includeInRouting: boolean;
}

// ВАЖНО: реальное правило исключения из маршрута по статусу живёт в
// lib/routing-rules.ts, а не в этом флаге. Флаг includeInRouting оставлен
// только для совместимости со старыми записями; значения ниже приведены
// в соответствие с правилом.
const DEFAULT_STATUSES: Array<Omit<AtmWorkStatus, keyof BaseEntity>> = [
  { name: "Работает", description: "", includeInRouting: true },
  { name: "Не работает", description: "", includeInRouting: true },
  { name: "Временно отключен", description: "", includeInRouting: true },
  { name: "Без ID", description: "", includeInRouting: true },
  { name: "Демонтирован", description: "", includeInRouting: false },
  { name: "На ремонте", description: "", includeInRouting: true },
  { name: "Закрытая территория", description: "", includeInRouting: false },
  { name: "Обслуживается сотрудниками филиала", description: "", includeInRouting: false },
  { name: "Новый банкомат", description: "", includeInRouting: true },
  { name: "Проблемный", description: "", includeInRouting: true },
  { name: "Неизвестный статус", description: "", includeInRouting: true },
];

export function listStatuses(): AtmWorkStatus[] {
  return readAll<AtmWorkStatus>(TABLE);
}

export function getStatusById(id: string): AtmWorkStatus | null {
  return findById<AtmWorkStatus>(TABLE, id);
}

export function createStatus(data: Omit<AtmWorkStatus, keyof BaseEntity>): AtmWorkStatus {
  const row: AtmWorkStatus = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateStatus(id: string, patch: Partial<Omit<AtmWorkStatus, keyof BaseEntity>>): boolean {
  return updateRow<AtmWorkStatus>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteStatus(id: string): boolean {
  return deleteRow(TABLE, id);
}

export function ensureDefaultStatuses(): void {
  const existingNames = new Set(listStatuses().map((s) => s.name));
  for (const status of DEFAULT_STATUSES) {
    if (!existingNames.has(status.name)) {
      createStatus(status);
    }
  }
}
