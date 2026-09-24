import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "problem_reports";

export interface ProblemReport extends BaseEntity {
  atmId: string;
  reason: string; // Сломана дверь | Оборван кабель | Сломан корпус | Сломан экран | Другое
  comment: string;
  reportedBy: string;
  status: string; // Новый | Передан технику | Решён
  lastNotifyResult: string;
  photoUrl: string; // ссылка на фото неисправности (/api/photos/xxx.jpg), необязательно
}

export const PROBLEM_REASONS = [
  "Сломана дверь",
  "Оборван кабель",
  "Сломан корпус",
  "Сломан экран",
  "Другая неисправность",
];

export function listProblemReports(): ProblemReport[] {
  return readAll<ProblemReport>(TABLE);
}

export function getProblemReportById(id: string): ProblemReport | null {
  return findById<ProblemReport>(TABLE, id);
}

export function createProblemReport(data: Omit<ProblemReport, keyof BaseEntity>): ProblemReport {
  const row: ProblemReport = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateProblemReport(id: string, patch: Partial<Omit<ProblemReport, keyof BaseEntity>>): boolean {
  return updateRow<ProblemReport>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteProblemReport(id: string): boolean {
  return deleteRow(TABLE, id);
}
