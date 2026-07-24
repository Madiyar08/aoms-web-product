import { insertRow, readAll, updateRow, findById } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "no_id_reports";

/**
 * Отчёт о нештатной ситуации на месте (п.3 ТЗ): у банкомата нет
 * наклейки с ID, он не работает, или не удаётся получить чек. Хранится
 * ОТДЕЛЬНО от обычных отчётов об очистке, чтобы руководитель мог быстро
 * разобрать все такие исключения одним списком.
 */
export interface NoIdReport extends BaseEntity {
  employeeId: string;
  employeeName: string;
  address: string;
  latitude: string;
  longitude: string;
  noSticker: boolean;
  notWorking: boolean;
  cantGetReceipt: boolean;
  gotReceipt: boolean;
  comment: string;
  photosJson?: string; // JSON-массив ссылок на фото
  status: string; // "Новый" | "Разобран"
}

export function createNoIdReport(data: Omit<NoIdReport, keyof BaseEntity>): NoIdReport {
  const row: NoIdReport = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function listNoIdReports(): NoIdReport[] {
  return readAll<NoIdReport>(TABLE).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getNoIdReportById(id: string): NoIdReport | null {
  return findById<NoIdReport>(TABLE, id);
}

export function updateNoIdReport(id: string, patch: Partial<Omit<NoIdReport, keyof BaseEntity>>): boolean {
  return updateRow<NoIdReport>(TABLE, id, patch);
}
