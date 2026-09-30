import { readAll, insertRow, updateRow } from "./db";
import { newId, nowIso, BaseEntity } from "./entity";

const TABLE = "driver_logs";

export interface DriverLog extends BaseEntity {
  employeeId: string;
  employeeName: string;
  machineId: string;
  machineNumber: string;
  date: string; // YYYY-MM-DD — один лог на машину в день, поля заполняются постепенно
  odometerStart: number | null;
  odometerEnd: number | null;
  fuelLiters: number | null;
  fuelCost: number | null;
  comment: string;
  odometerStartPhotoUrl: string;
  odometerEndPhotoUrl: string;
  receiptPhotoUrl: string;
}

export function listDriverLogs(): DriverLog[] {
  return readAll<DriverLog>(TABLE);
}

export function getDriverLogByMachineAndDate(machineId: string, date: string): DriverLog | null {
  return listDriverLogs().find((l) => l.machineId === machineId && l.date === date) ?? null;
}

/**
 * Создаёт запись за день (если её ещё нет) либо обновляет уже начатую —
 * утром водитель вносит только odometerStart, вечером возвращается и
 * дозаполняет odometerEnd/расход топлива в ту же запись.
 */
export function upsertDriverLog(params: {
  machineId: string;
  date: string;
  employeeId: string;
  employeeName: string;
  machineNumber: string;
  patch: Partial<
    Pick<
      DriverLog,
      | "odometerStart"
      | "odometerEnd"
      | "fuelLiters"
      | "fuelCost"
      | "comment"
      | "odometerStartPhotoUrl"
      | "odometerEndPhotoUrl"
      | "receiptPhotoUrl"
    >
  >;
}): DriverLog {
  const existing = getDriverLogByMachineAndDate(params.machineId, params.date);
  if (existing) {
    updateRow<DriverLog>(TABLE, existing.id, { ...params.patch, updatedAt: nowIso() });
    return { ...existing, ...params.patch, updatedAt: nowIso() };
  }
  const row: DriverLog = {
    id: newId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    machineId: params.machineId,
    machineNumber: params.machineNumber,
    date: params.date,
    odometerStart: null,
    odometerEnd: null,
    fuelLiters: null,
    fuelCost: null,
    comment: "",
    odometerStartPhotoUrl: "",
    odometerEndPhotoUrl: "",
    receiptPhotoUrl: "",
    ...params.patch,
  };
  insertRow(TABLE, row);
  return row;
}

/** Пробег за день — null, пока не заполнены обе одометрии, или если конечная меньше начальной (ошибка ввода). */
export function distanceKm(log: DriverLog): number | null {
  if (log.odometerStart == null || log.odometerEnd == null) return null;
  const d = log.odometerEnd - log.odometerStart;
  return d >= 0 ? d : null;
}
