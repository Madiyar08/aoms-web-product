import { insertRow, readAll, updateRow, findById } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";
import { getAtmById, updateAtm, createAtm, listAtms } from "./atms";
import { haversineMeters } from "./coordinate-analysis";
import { todayTashkent } from "./tz";

const TABLE = "atm_change_history";

/**
 * Единая очередь заявок на изменение банкомата — заменяет три
 * разрозненных механизма, которые раньше сигналили об одном и том же
 * (addressVerified/coordsVerified флаги, страница "Уточнить
 * адрес/координаты", причины в форме "Банкомат с проблемой").
 *
 * Ничего не применяется автоматически с первого сигнала — только после
 * того, как ОДНО И ТО ЖЕ наблюдение подтвердится в 3 РАЗНЫХ ДНЯ (не 3
 * разных сотрудника — для районов с одним экипажем это было бы
 * недостижимо). Новое значение координат берётся из GPS сотрудника в
 * момент заявки — не вводится вручную, чтобы не плодить опечатки.
 */
export type ChangeType = "location" | "district" | "new_atm";

export interface AtmChangeRequest extends BaseEntity {
  atmId: string; // пусто для new_atm, пока банкомат реально не создан
  atmCode: string;
  changeType: ChangeType;
  oldAddress?: string;
  oldDistrict?: string;
  oldLat?: string;
  oldLon?: string;
  newLat?: string;
  newLon?: string;
  newDistrict?: string;
  newAddressText?: string; // для new_atm — адрес, вписанный сотрудником
  newAtmName?: string;
  comment: string;
  photosJson?: string;
  employeeId: string;
  employeeName: string;
  status: "pending" | "applied" | "rejected";
  reportDate: string; // YYYY-MM-DD по Ташкенту — основа подсчёта "разных дней"
}

export function listChangeRequests(): AtmChangeRequest[] {
  return readAll<AtmChangeRequest>(TABLE).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getChangeRequestById(id: string): AtmChangeRequest | null {
  return findById<AtmChangeRequest>(TABLE, id);
}

export function updateChangeRequest(id: string, patch: Partial<Omit<AtmChangeRequest, keyof BaseEntity>>): boolean {
  return updateRow<AtmChangeRequest>(TABLE, id, patch);
}

const AUTO_APPLY_DAYS_THRESHOLD = 3;
const LOCATION_CLUSTER_RADIUS_M = 150; // сигналы дальше друг от друга не считаем "тем же самым" наблюдением

/**
 * Создаёт заявку и сразу пробует автоприменить, если порог уже набран
 * (включая только что созданную заявку). Возвращает созданную заявку —
 * её status уже будет "applied", если применение произошло сейчас же.
 */
export function submitChangeRequest(
  data: Omit<AtmChangeRequest, keyof BaseEntity | "status" | "reportDate">
): AtmChangeRequest {
  const row: AtmChangeRequest = {
    id: newId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: "pending",
    reportDate: todayTashkent(),
    ...data,
  };
  insertRow(TABLE, row);
  tryAutoApply(row);
  return getChangeRequestById(row.id)!;
}

function distinctDays(requests: AtmChangeRequest[]): number {
  return new Set(requests.map((r) => r.reportDate)).size;
}

/**
 * Пробует автоприменить изменение, если для этого же банкомата/кода и
 * того же типа изменения накопилось совпадающих наблюдений в 3+ разных
 * дня. "Совпадающих" — для координат это близость (в пределах
 * LOCATION_CLUSTER_RADIUS_M), для района — совпадение предложенного
 * района, для нового банкомата — совпадение кода И близость координат.
 */
function tryAutoApply(justCreated: AtmChangeRequest): void {
  const pending = listChangeRequests().filter(
    (r) => r.status === "pending" && r.changeType === justCreated.changeType
  );

  if (justCreated.changeType === "location" && justCreated.atmId) {
    const cluster = pending.filter(
      (r) =>
        r.atmId === justCreated.atmId &&
        r.newLat &&
        r.newLon &&
        haversineMeters(
          parseFloat(r.newLat),
          parseFloat(r.newLon),
          parseFloat(justCreated.newLat || "0"),
          parseFloat(justCreated.newLon || "0")
        ) <= LOCATION_CLUSTER_RADIUS_M
    );
    if (distinctDays(cluster) >= AUTO_APPLY_DAYS_THRESHOLD) {
      const avgLat = cluster.reduce((s, r) => s + parseFloat(r.newLat!), 0) / cluster.length;
      const avgLon = cluster.reduce((s, r) => s + parseFloat(r.newLon!), 0) / cluster.length;
      updateAtm(justCreated.atmId, {
        latitude: String(avgLat),
        longitude: String(avgLon),
        coordsVerified: true,
      });
      for (const r of cluster) updateChangeRequest(r.id, { status: "applied" });
    }
    return;
  }

  if (justCreated.changeType === "district" && justCreated.atmId) {
    const cluster = pending.filter(
      (r) => r.atmId === justCreated.atmId && r.newDistrict === justCreated.newDistrict
    );
    if (distinctDays(cluster) >= AUTO_APPLY_DAYS_THRESHOLD) {
      updateAtm(justCreated.atmId, { district: justCreated.newDistrict });
      for (const r of cluster) updateChangeRequest(r.id, { status: "applied" });
    }
    return;
  }

  if (justCreated.changeType === "new_atm" && justCreated.atmCode) {
    const cluster = pending.filter(
      (r) =>
        r.changeType === "new_atm" &&
        r.atmCode === justCreated.atmCode &&
        r.newLat &&
        r.newLon &&
        haversineMeters(
          parseFloat(r.newLat),
          parseFloat(r.newLon),
          parseFloat(justCreated.newLat || "0"),
          parseFloat(justCreated.newLon || "0")
        ) <= LOCATION_CLUSTER_RADIUS_M
    );
    if (distinctDays(cluster) >= AUTO_APPLY_DAYS_THRESHOLD) {
      autoCreateNewAtm(justCreated.atmCode, cluster);
    }
  }
}

/**
 * Создаёт реальную запись банкомата после набора порога подтверждений и
 * привязывает ЗАДНИМ ЧИСЛОМ уже поданные ранее отчёты об очистке по
 * этому же коду (которые принимались сразу, ещё когда банкомата
 * формально не существовало — отчёт никогда не блокируется).
 */
function autoCreateNewAtm(atmCode: string, cluster: AtmChangeRequest[]): void {
  const avgLat = cluster.reduce((s, r) => s + parseFloat(r.newLat!), 0) / cluster.length;
  const avgLon = cluster.reduce((s, r) => s + parseFloat(r.newLon!), 0) / cluster.length;
  const latest = cluster[0];

  const atm = createAtm({
    code: atmCode,
    name: latest.newAtmName || `Новый банкомат ${atmCode}`,
    address: latest.newAddressText || "",
    district: "",
    latitude: String(avgLat),
    longitude: String(avgLon),
    categoryId: "",
    workStatusId: "",
    addressVerified: false,
    coordsVerified: true,
    comments: "Создан автоматически по 3 независимым заявкам сотрудников",
    source: "auto-created",
  });

  for (const r of cluster) updateChangeRequest(r.id, { status: "applied", atmId: atm.id });

  // Задняя привязка отчётов, которые уже были поданы по этому коду, пока
  // банкомата формально ещё не существовало.
  backfillReportsForNewAtm(atmCode, atm.id);
}

function backfillReportsForNewAtm(atmCode: string, atmId: string): void {
  // Ленивый импорт — избегаем циклической зависимости на уровне модулей
  // (cleaning-reports.ts не импортирует этот файл, но порядок загрузки
  // не гарантирован при прямом импорте наверху).
  const { listCleaningReports, updateCleaningReport } = require("./cleaning-reports");
  const normalize = (c: string) => (c || "").trim().toLowerCase();
  const target = normalize(atmCode);
  const reports = listCleaningReports().filter((r: any) => !r.atmId && normalize(r.atmCode) === target);
  for (const r of reports) {
    updateCleaningReport(r.id, { atmId });
  }
}

/** Ручное подтверждение руководителем — минуя порог 3 дней. */
export function manuallyApplyChangeRequest(id: string): boolean {
  const req = getChangeRequestById(id);
  if (!req) return false;

  if (req.changeType === "new_atm") {
    if (!req.newLat || !req.newLon) return false;
    const atm = createAtm({
      code: req.atmCode,
      name: req.newAtmName || `Новый банкомат ${req.atmCode}`,
      address: req.newAddressText || "",
      district: req.newDistrict || "",
      latitude: req.newLat,
      longitude: req.newLon,
      categoryId: "",
      workStatusId: "",
      addressVerified: false,
      coordsVerified: true,
      comments: "Создан вручную руководителем",
      source: "manual-approved",
    });
    updateChangeRequest(id, { status: "applied", atmId: atm.id });
    backfillReportsForNewAtm(req.atmCode, atm.id);
    return true;
  }

  if (!req.atmId) return false;
  if (req.changeType === "location" && req.newLat && req.newLon) {
    updateAtm(req.atmId, { latitude: req.newLat, longitude: req.newLon, coordsVerified: true });
  }
  if (req.changeType === "district" && req.newDistrict) {
    updateAtm(req.atmId, { district: req.newDistrict });
  }
  updateChangeRequest(id, { status: "applied" });
  return true;
}

export function rejectChangeRequest(id: string): boolean {
  return updateChangeRequest(id, { status: "rejected" });
}
