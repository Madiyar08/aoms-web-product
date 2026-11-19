import { insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { isInspectorMediaReference } from "./inspector-media-access";

const TABLE = "inspector_reports";

export interface InspectorReport extends BaseEntity {
  atmId: string;
  atmCode: string;
  atmName: string;
  address: string;
  comment: string;
  employeeId: string;
  employeeName: string;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsCapturedAt: string;
  gpsQuality: "good" | "weak" | "missing";
  photosJson: string;
  videoUrl: string;
  status: "Новый" | "На рассмотрении" | "Закрыт";
  notificationStatus: string;
  managerComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}


export function createInspectorReport(data: Omit<InspectorReport, keyof BaseEntity>): InspectorReport {
  const row: InspectorReport = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function listInspectorReports(): InspectorReport[] {
  return readAll<InspectorReport>(TABLE).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getInspectorReportById(id: string): InspectorReport | null {
  return readAll<InspectorReport>(TABLE).find((report) => report.id === id) || null;
}

export function updateInspectorReport(id: string, patch: Partial<Pick<InspectorReport, "notificationStatus" | "status" | "photosJson" | "videoUrl" | "managerComment" | "reviewedAt" | "reviewedBy">>): boolean {
  return updateRow<InspectorReport>(TABLE, id, { ...patch, updatedAt: nowIso() });
}


/** Identifies local or Telegram-backed media currently referenced by an inspector report. */
export function isInspectorReportMediaUrl(url: string): boolean {
  return isInspectorMediaReference(url, readAll<InspectorReport>(TABLE));
}
