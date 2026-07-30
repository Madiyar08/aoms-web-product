import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "employees";

export interface Employee extends BaseEntity {
  fullName: string;
  phone: string;
  status: string; // Активен | Уволен | На больничном ...
  role: string; // Водитель | Уборщик | "" (не указана — считаем, что доступен обоим сценариям)
  comments: string;
  telegramChatId: string; // заполняется автоматически, когда сотрудник открывает регистрационную ссылку бота
}

export function listEmployees(): Employee[] {
  return readAll<Employee>(TABLE);
}

export function getEmployeeById(id: string): Employee | null {
  return findById<Employee>(TABLE, id);
}

export function createEmployee(data: Omit<Employee, keyof BaseEntity>): Employee {
  const row: Employee = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateEmployee(id: string, patch: Partial<Omit<Employee, keyof BaseEntity>>): boolean {
  return updateRow<Employee>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteEmployee(id: string): boolean {
  return deleteRow(TABLE, id);
}
