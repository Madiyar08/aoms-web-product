import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "cleaning_reports";

export interface CleaningReport extends BaseEntity {
  atmId: string;
  atmCode: string;
  employeeId: string;
  employeeName: string;
  // Машина/экипаж, зафиксированная В МОМЕНТ отправки отчёта (не
  // вычисляется заново при каждом чтении через employeeId → сотрудник →
  // его текущая машина). Раньше связка шла только через имя/поиск на
  // лету, и была той же хрупкой конструкцией, что дала расхождение в
  // подсчёте "36 vs 44": если сотрудника завтра пересадят на другую
  // машину, старые отчёты не должны "переехать" вслед за ним задним
  // числом — они должны остаться привязаны к машине, на которой человек
  // реально был в момент очистки.
  machineId: string;
  photoData: string; // ссылка на первое фото (путь /api/photos/...) — для обратной совместимости
  photosJson?: string; // JSON-массив ссылок на все фото очистки
  gpsLat: string;
  gpsLon: string;
  clientTime: string; // время съёмки по данным клиента
  // Антифрод-проверки
  inRoute: boolean; // банкомат входил в сегодняшний маршрут экипажа
  distanceMeters: number; // расстояние между GPS сотрудника и координатами банкомата
  antifraudFlags: string[]; // список сработавших проверок
  // Проверка ID вручную: сотрудник вводит код с самого устройства (не
  // видит его заранее в приложении) — так система убеждается, что он
  // физически стоит у нужного банкомата, а не просто нажал кнопку.
  enteredCode: string;
  codeMismatch: boolean;
  // Что сотрудник увидел на месте — это ФАКТ с точки, а не то, что
  // хранится в справочнике банкоматов у администратора.
  reportedWorkStatusId: string;
  reportedWorkStatusName: string;
  addressCorrect: boolean;
  coordsCorrect: boolean;
  locationComment: string; // комментарий, если адрес/координаты не совпали
}

export function listReportsByAtm(atmId: string): CleaningReport[] {
  return listCleaningReports()
    .filter((r) => r.atmId === atmId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listCleaningReports(): CleaningReport[] {
  return readAll<CleaningReport>(TABLE);
}

export function getCleaningReportById(id: string): CleaningReport | null {
  return findById<CleaningReport>(TABLE, id);
}

export function listReportsByEmployee(employeeId: string): CleaningReport[] {
  return listCleaningReports().filter((r) => r.employeeId === employeeId);
}

export function listReportsByDate(dateIso: string): CleaningReport[] {
  return listCleaningReports().filter((r) => r.createdAt.slice(0, 10) === dateIso);
}

export function createCleaningReport(data: Omit<CleaningReport, keyof BaseEntity>): CleaningReport {
  const row: CleaningReport = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function deleteCleaningReport(id: string): boolean {
  return deleteRow(TABLE, id);
}

/** Обновление отчёта — используется фоновой архивацией фото (см.
 * lib/photo-storage.ts::archivePhotoToTelegram), чтобы заменить ссылку
 * на диск ссылкой на Telegram-архив уже ПОСЛЕ того, как отчёт создан и
 * сотрудник получил ответ. */
export function updateCleaningReport(id: string, patch: Partial<Omit<CleaningReport, keyof BaseEntity>>): boolean {
  return updateRow<CleaningReport>(TABLE, id, patch);
}
