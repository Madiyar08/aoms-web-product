/**
 * Импорт банкоматов из Excel.
 *
 * Разбирает файл вида "Список_банкоматов.xlsx": строка заголовков, затем
 * вперемешку строки-разделители района (название района + счётчик) и
 * строки с данными банкомата. У координат перепутаны местами заголовки
 * "Долгота"/"Широта" — значения распознаются по диапазону Узбекистана,
 * а не по названию столбца. ID банкомата задвоен на два столбца
 * "TerminalID " — берётся тот, где значение есть.
 *
 * ДОПОЛНИТЕЛЬНО: если в файле есть колонки "Категория", "Статус работы",
 * "Адрес проверен", "Координаты проверены" — они распознаются по
 * заголовку (в любом месте файла) и заполняются автоматически. Категория
 * и статус сопоставляются с существующими справочниками по названию
 * (без учёта регистра). Проверки понимают: да/yes/1/true/+/✓/v.
 */

import ExcelJS from "exceljs";
import { createAtm, listAtms, updateAtm } from "./atms";
import { ensureDefaultStatuses, listStatuses } from "./statuses";
import { ensureDefaultCategories, listCategories } from "./categories";

const UZ_LAT_RANGE: [number, number] = [37.0, 45.6];
const UZ_LON_RANGE: [number, number] = [55.9, 73.2];

export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skippedNoCoords: number;
  skippedEmptyRow: number;
  districtsFound: string[];
  withoutId: number;
  // Что распозналось из дополнительных колонок
  categoryColumnFound: boolean;
  statusColumnFound: boolean;
  verifiedColumnsFound: boolean;
  categoriesAssigned: number;
  statusesAssigned: number;
  unmatchedCategoryNames: string[]; // значения, которые не совпали ни с одной категорией
  unmatchedStatusNames: string[];
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in (value as Record<string, unknown>)) {
    const rich = value as { richText: Array<{ text: string }> };
    return rich.richText.map((r) => r.text).join("");
  }
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text).trim();
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function cellToFloat(value: unknown): number | null {
  const text = cellToText(value).replace(",", ".");
  if (!text) return null;
  const parsed = parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function inRange(value: number, range: [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

function resolveLatLon(rawA: number, rawB: number): { lat: number; lon: number } | null {
  if (inRange(rawA, UZ_LAT_RANGE) && inRange(rawB, UZ_LON_RANGE)) return { lat: rawA, lon: rawB };
  if (inRange(rawB, UZ_LAT_RANGE) && inRange(rawA, UZ_LON_RANGE)) return { lat: rawB, lon: rawA };
  return null;
}

/** "да", "yes", "1", "true", "+", "✓", "v", "да ✓" → true; всё остальное → false */
function parseVerified(value: unknown): boolean {
  const text = cellToText(value).toLowerCase().trim();
  if (!text) return false;
  return ["да", "yes", "y", "1", "true", "+", "✓", "v", "истина", "провер"].some((t) =>
    text.includes(t)
  );
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Сканирует строку заголовков и находит индексы дополнительных колонок
 * по ключевым словам. Возвращает 0, если колонка не найдена.
 */
function detectOptionalColumns(headerRow: ExcelJS.Row): {
  categoryCol: number;
  statusCol: number;
  addressVerifiedCol: number;
  coordsVerifiedCol: number;
} {
  let categoryCol = 0;
  let statusCol = 0;
  let addressVerifiedCol = 0;
  let coordsVerifiedCol = 0;

  for (let c = 1; c <= 30; c++) {
    const h = norm(cellToText(headerRow.getCell(c).value));
    if (!h) continue;
    if (!categoryCol && h.includes("категор")) categoryCol = c;
    else if (!statusCol && h.includes("статус")) statusCol = c;
    else if (!addressVerifiedCol && h.includes("адрес") && h.includes("провер")) addressVerifiedCol = c;
    else if (
      !coordsVerifiedCol &&
      (h.includes("координат") || h.includes("коорд")) &&
      h.includes("провер")
    )
      coordsVerifiedCol = c;
  }
  return { categoryCol, statusCol, addressVerifiedCol, coordsVerifiedCol };
}

export async function importAtmsFromExcel(buffer: ArrayBuffer): Promise<ImportSummary> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];

  ensureDefaultStatuses();
  ensureDefaultCategories();
  const statuses = listStatuses();
  const categories = listCategories();
  const newAtmStatus = statuses.find((s) => s.name === "Новый банкомат");
  const noIdStatus = statuses.find((s) => s.name === "Без ID");

  // Справочники по нормализованному имени — для сопоставления из Excel
  const categoryByName = new Map(categories.map((c) => [norm(c.name), c]));
  const statusByName = new Map(statuses.map((s) => [norm(s.name), s]));

  const existingByCode = new Map(listAtms().filter((a) => a.code).map((a) => [a.code, a]));

  const cols = detectOptionalColumns(sheet.getRow(1));

  const summary: ImportSummary = {
    totalRows: 0,
    created: 0,
    updated: 0,
    skippedNoCoords: 0,
    skippedEmptyRow: 0,
    districtsFound: [],
    withoutId: 0,
    categoryColumnFound: cols.categoryCol > 0,
    statusColumnFound: cols.statusCol > 0,
    verifiedColumnsFound: cols.addressVerifiedCol > 0 || cols.coordsVerifiedCol > 0,
    categoriesAssigned: 0,
    statusesAssigned: 0,
    unmatchedCategoryNames: [],
    unmatchedStatusNames: [],
  };

  const unmatchedCats = new Set<string>();
  const unmatchedStatuses = new Set<string>();
  let currentDistrict = "";
  const districtsSeen = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const address = cellToText(row.getCell(2).value);
    const landmark = cellToText(row.getCell(3).value);
    const rawA = cellToFloat(row.getCell(4).value);
    const rawB = cellToFloat(row.getCell(5).value);
    const idFromColF = cellToText(row.getCell(6).value);
    const idFromColG = cellToText(row.getCell(7).value);
    const code = idFromColG || idFromColF;

    const hasCoords = rawA !== null && rawB !== null;
    const landmarkIsNumeric = landmark !== "" && !Number.isNaN(Number(landmark));

    if (!hasCoords) {
      if (address && !code && (landmarkIsNumeric || !landmark)) {
        currentDistrict = address;
        districtsSeen.add(currentDistrict);
      } else if (!address && !landmark && !code) {
        summary.skippedEmptyRow += 1;
      } else {
        summary.skippedNoCoords += 1;
      }
      return;
    }

    summary.totalRows += 1;
    const resolved = resolveLatLon(rawA as number, rawB as number);
    if (!resolved) {
      summary.skippedNoCoords += 1;
      return;
    }

    if (!code) summary.withoutId += 1;

    // --- Дополнительные колонки ---
    let categoryId: string | undefined;
    if (cols.categoryCol) {
      const catText = cellToText(row.getCell(cols.categoryCol).value);
      if (catText) {
        const match = categoryByName.get(norm(catText));
        if (match) {
          categoryId = match.id;
        } else {
          unmatchedCats.add(catText);
        }
      }
    }

    let statusId: string | undefined;
    if (cols.statusCol) {
      const statusText = cellToText(row.getCell(cols.statusCol).value);
      if (statusText) {
        const match = statusByName.get(norm(statusText));
        if (match) {
          statusId = match.id;
        } else {
          unmatchedStatuses.add(statusText);
        }
      }
    }

    const addressVerified = cols.addressVerifiedCol
      ? parseVerified(row.getCell(cols.addressVerifiedCol).value)
      : undefined;
    const coordsVerified = cols.coordsVerifiedCol
      ? parseVerified(row.getCell(cols.coordsVerifiedCol).value)
      : undefined;

    const existing = code ? existingByCode.get(code) : undefined;

    if (existing) {
      const patch: Record<string, unknown> = {
        address: address || existing.address,
        name: landmark || existing.name,
        district: currentDistrict || existing.district,
        latitude: resolved.lat.toString(),
        longitude: resolved.lon.toString(),
        source: "Импорт Excel",
      };
      if (categoryId !== undefined) {
        patch.categoryId = categoryId;
        summary.categoriesAssigned += 1;
      }
      if (statusId !== undefined) {
        patch.workStatusId = statusId;
        summary.statusesAssigned += 1;
      }
      if (addressVerified !== undefined) patch.addressVerified = addressVerified;
      if (coordsVerified !== undefined) patch.coordsVerified = coordsVerified;
      updateAtm(existing.id, patch);
      summary.updated += 1;
    } else {
      // Статус: из Excel, иначе значение по умолчанию
      const finalStatusId = statusId ?? (code ? newAtmStatus?.id : noIdStatus?.id) ?? "";
      if (statusId !== undefined) summary.statusesAssigned += 1;
      if (categoryId !== undefined) summary.categoriesAssigned += 1;

      const created = createAtm({
        code,
        name: landmark || address || "(без названия)",
        address,
        district: currentDistrict,
        latitude: resolved.lat.toString(),
        longitude: resolved.lon.toString(),
        categoryId: categoryId ?? "",
        workStatusId: finalStatusId,
        addressVerified: addressVerified ?? false,
        coordsVerified: coordsVerified ?? false,
        comments: "",
        source: "Импорт Excel",
      });
      if (code) existingByCode.set(code, created);
      summary.created += 1;
    }
  });

  summary.districtsFound = Array.from(districtsSeen);
  summary.unmatchedCategoryNames = Array.from(unmatchedCats);
  summary.unmatchedStatusNames = Array.from(unmatchedStatuses);
  return summary;
}
