import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { listSchedule, createScheduleEntry } from "./schedule";
import { todayTashkent } from "./tz";

const TABLE = "recurring_schedules";

/**
 * Регулярное (повторяющееся) расписание — для экипажей с фиксированным
 * графиком (например, группа Ташкентской области: вторник, четверг,
 * суббота), чтобы не создавать запись в «Расписании» вручную каждый раз.
 *
 * daysOfWeek — числа 0-6, воскресенье=0 (стандарт JS Date.getDay()).
 */
export interface RecurringSchedule extends BaseEntity {
  machineId: string;
  daysOfWeek: number[];
  districts: string[];
  kpiTarget: number;
  comments: string;
  active: boolean; // можно приостановить, не удаляя настройку насовсем
}

export function listRecurringSchedules(): RecurringSchedule[] {
  return readAll<RecurringSchedule>(TABLE);
}

export function getRecurringScheduleById(id: string): RecurringSchedule | null {
  return findById<RecurringSchedule>(TABLE, id);
}

export function createRecurringSchedule(data: Omit<RecurringSchedule, keyof BaseEntity>): RecurringSchedule {
  const row: RecurringSchedule = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateRecurringSchedule(id: string, patch: Partial<Omit<RecurringSchedule, keyof BaseEntity>>): boolean {
  return updateRow<RecurringSchedule>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteRecurringSchedule(id: string): boolean {
  return deleteRow(TABLE, id);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ленивая материализация: для каждой активной регулярной настройки, на
 * ближайшие LOOKAHEAD_DAYS дней, если для этой машины на этот день ещё
 * НЕТ записи в обычном расписании — создаёт её из шаблона. Не трогает
 * дни, где расписание уже создано (в том числе вручную поправленное
 * руководителем) — регулярное расписание только ЗАПОЛНЯЕТ пустоты, не
 * перезаписывает существующее.
 *
 * Вызывается при каждом открытии страницы «Расписание» — тот же
 * принцип "ленивое обслуживание при следующем обращении", что уже
 * используется в проекте (см. lib/location-pings.ts), а не отдельный
 * постоянный фоновый процесс (cron), который на Railway менее надёжен
 * из-за перезапусков контейнера при деплое.
 */
const LOOKAHEAD_DAYS = 14;

export function ensureRecurringSchedulesMaterialized(): number {
  const recurring = listRecurringSchedules().filter((r) => r.active);
  if (recurring.length === 0) return 0;

  const existing = listSchedule();
  const existingKey = new Set(existing.map((e) => `${e.machineId}|${e.date}`));

  const today = todayTashkent();
  let created = 0;

  for (const r of recurring) {
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
      const date = addDays(today, i);
      const dayOfWeek = new Date(date + "T00:00:00Z").getUTCDay();
      if (!r.daysOfWeek.includes(dayOfWeek)) continue;

      const key = `${r.machineId}|${date}`;
      if (existingKey.has(key)) continue; // уже есть запись (в том числе ручная) — не трогаем

      createScheduleEntry({
        machineId: r.machineId,
        date,
        districts: r.districts,
        kpiTarget: r.kpiTarget,
        comments: r.comments ? `${r.comments} (авто из регулярного расписания)` : "Авто из регулярного расписания",
      });
      existingKey.add(key); // не создать дважды за один проход, если вдруг совпадут даты
      created += 1;
    }
  }
  return created;
}
