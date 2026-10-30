import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "schedule_entries";

export interface ScheduleEntry extends BaseEntity {
  date: string; // YYYY-MM-DD
  machineId: string;
  districts: string[]; // несколько районов на один день — прямое требование ТЗ
  kpiTarget: number; // задаётся руководителем на каждый экипаж отдельно, не глобально
  comments: string;
}

export function listSchedule(): ScheduleEntry[] {
  return readAll<ScheduleEntry>(TABLE);
}

export function getScheduleById(id: string): ScheduleEntry | null {
  return findById<ScheduleEntry>(TABLE, id);
}

export function listScheduleByDate(date: string): ScheduleEntry[] {
  return listSchedule().filter((s) => s.date === date);
}

export function createScheduleEntry(data: Omit<ScheduleEntry, keyof BaseEntity>): ScheduleEntry {
  const row: ScheduleEntry = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateScheduleEntry(
  id: string,
  patch: Partial<Omit<ScheduleEntry, keyof BaseEntity>>
): boolean {
  return updateRow<ScheduleEntry>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteScheduleEntry(id: string): boolean {
  return deleteRow(TABLE, id);
}

/** Дни, когда по BR-001 обязательно должен обслуживаться город Ташкент — подсказка в UI, не жёсткое ограничение (назначение остаётся ручным, как и требовалось для MVP). */
export const TASHKENT_CITY_DAYS = ["Monday", "Friday"];

export function isTashkentCityDay(dateIso: string): boolean {
  const day = new Date(dateIso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
  return TASHKENT_CITY_DAYS.includes(day);
}
