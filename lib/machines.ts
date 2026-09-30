import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "machines";

export interface Machine extends BaseEntity {
  number: string;
  employee1Id: string;
  employee2Id: string;
  status: string; // На маршруте | Свободна | Завершила день | На ремонте
  comments: string;
  // Необязательно — если у экипажа своя отдельная Telegram-группа
  // (например, сотрудники Ташкентской области получили отдельный чат),
  // отчёты этого экипажа идут туда вместо общей группы
  // TELEGRAM_GROUP_CHAT_ID. Пусто — используется общая группа как раньше.
  telegramGroupChatId?: string;
}

export function listMachines(): Machine[] {
  return readAll<Machine>(TABLE);
}

export function getMachineById(id: string): Machine | null {
  return findById<Machine>(TABLE, id);
}

export function createMachine(data: Omit<Machine, keyof BaseEntity>): Machine {
  const row: Machine = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateMachine(id: string, patch: Partial<Omit<Machine, keyof BaseEntity>>): boolean {
  return updateRow<Machine>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteMachine(id: string): boolean {
  return deleteRow(TABLE, id);
}
