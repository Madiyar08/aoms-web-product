import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

export { verificationStatus } from "./atm-status";

const TABLE = "atms";

export interface Atm extends BaseEntity {
  code: string;
  name: string;
  address: string;
  district: string;
  latitude: string;
  longitude: string;
  categoryId: string;
  workStatusId: string;
  addressVerified: boolean;
  coordsVerified: boolean;
  comments: string;
  source: string;
  lastCleanedDate?: string; // YYYY-MM-DD — для приоритета маршрута и зелёного статуса
}

export function listAtms(): Atm[] {
  return readAll<Atm>(TABLE);
}

export function getAtmById(id: string): Atm | null {
  return findById<Atm>(TABLE, id);
}

/**
 * Приводит код банкомата к сравнимому виду: убирает пробелы по краям,
 * игнорирует регистр, и для ЧИСТО ЦИФРОВЫХ кодов убирает ведущие нули
 * ("0123" и "123" — один и тот же банкомат). Ведущие нули не трогаем у
 * смешанных буквенно-цифровых кодов — там это не опечатка, а часть кода.
 *
 * Без этой нормализации сравнение шло строго посимвольно, и лишний
 * пробел/разный регистр/ведущий ноль при вводе на телефоне создавали
 * "банкомат не найден" — реальная причина расхождений в подсчёте
 * очищенных банкоматов и ложных "ни разу не обслужен" в статистике.
 */
function normalizeAtmCode(code: string): string {
  const trimmed = (code || "").trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+(?=\d)/, "");
  }
  return trimmed;
}

export function findAtmByCode(code: string): Atm | null {
  if (!code) return null;
  const target = normalizeAtmCode(code);
  if (!target) return null;
  return listAtms().find((a) => normalizeAtmCode(a.code) === target) ?? null;
}

export function createAtm(data: Omit<Atm, keyof BaseEntity>): Atm {
  const row: Atm = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateAtm(id: string, patch: Partial<Omit<Atm, keyof BaseEntity>>): boolean {
  return updateRow<Atm>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteAtm(id: string): boolean {
  return deleteRow(TABLE, id);
}

/**
 * Удаляет ВСЕ банкоматы разом. Затрагивает только таблицу банкоматов —
 * сотрудники, машины, расписание, настройки и справочники
 * (категории/статусы) остаются нетронутыми. Возвращает число удалённых.
 */
export function deleteAllAtms(): number {
  const all = listAtms();
  for (const atm of all) {
    deleteRow(TABLE, atm.id);
  }
  return all.length;
}

/**
 * Список районов — не отдельная сущность (пока), а производится из уже
 * введённых банкоматов. Как только появится полноценный справочник
 * «Районы», эта функция станет обращаться к нему вместо агрегации.
 */
export function listDistinctDistricts(): string[] {
  const districts = new Set<string>();
  for (const atm of listAtms()) {
    if (atm.district) districts.add(atm.district);
  }
  return Array.from(districts).sort();
}
