import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listAtms } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { listStatuses } from "@/lib/statuses";

/**
 * Экспорт всей базы банкоматов (п.9 ТЗ) — Excel по умолчанию, CSV по
 * ?format=csv. Заодно служит резервной копией: полная выгрузка всех
 * полей позволяет восстановить базу через импорт при необходимости.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const atms = listAtms();
  const categoryById = new Map(listCategories().map((c) => [c.id, c.name]));
  const statusById = new Map(listStatuses().map((s) => [s.id, s.name]));

  const rows = atms.map((a) => ({
    id: a.code || "",
    name: a.name,
    address: a.address,
    region: a.region || "",
    district: a.district,
    latitude: a.latitude,
    longitude: a.longitude,
    category: categoryById.get(a.categoryId) || "",
    status: statusById.get(a.workStatusId) || "",
    addressVerified: a.addressVerified ? "да" : "нет",
    coordsVerified: a.coordsVerified ? "да" : "нет",
    lastCleanedDate: a.lastCleanedDate || "",
    comments: a.comments || "",
  }));

  if (format === "csv") {
    const header = "ID,Название,Адрес,Регион,Район,Широта,Долгота,Категория,Статус,Адрес подтверждён,Координаты подтверждены,Последняя очистка,Комментарий";
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csvLines = [header, ...rows.map((r) => Object.values(r).map(escape).join(","))];
    const csv = "\uFEFF" + csvLines.join("\r\n"); // BOM для корректной кодировки в Excel
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="atms_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Все ATM");
  sheet.columns = [
    { header: "ID", key: "id", width: 12 },
    { header: "Название", key: "name", width: 28 },
    { header: "Адрес", key: "address", width: 36 },
    { header: "Регион", key: "region", width: 24 },
    { header: "Район", key: "district", width: 20 },
    { header: "Широта", key: "latitude", width: 12 },
    { header: "Долгота", key: "longitude", width: 12 },
    { header: "Категория", key: "category", width: 16 },
    { header: "Статус", key: "status", width: 16 },
    { header: "Адрес подтверждён", key: "addressVerified", width: 16 },
    { header: "Координаты подтверждены", key: "coordsVerified", width: 18 },
    { header: "Последняя очистка", key: "lastCleanedDate", width: 16 },
    { header: "Комментарий", key: "comments", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));

  const regionCounts = new Map<string, number>();
  const districtCounts = new Map<string, number>();
  for (const atm of atms) {
    const region = atm.region || "Не указан";
    const district = atm.district || "Не указан";
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    const key = `${region} — ${district}`;
    districtCounts.set(key, (districtCounts.get(key) || 0) + 1);
  }
  const addSummarySheet = (name: string, header1: string, header2: string, entries: Map<string, number>) => {
    const summary = workbook.addWorksheet(name);
    summary.columns = [{ header: header1, key: "name", width: 36 }, { header: header2, key: "count", width: 16 }];
    summary.getRow(1).font = { bold: true };
    [...entries.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru")).forEach(([name, count]) => summary.addRow({ name, count }));
  };
  addSummarySheet("По регионам", "Регион", "Количество ATM", regionCounts);
  addSummarySheet("По районам", "Регион — район", "Количество ATM", districtCounts);
  const addExceptionSheet = (name: string, values: typeof atms) => {
    const target = workbook.addWorksheet(name);
    target.columns = [
      { header: "ID", key: "code", width: 16 }, { header: "Название", key: "name", width: 30 },
      { header: "Регион", key: "region", width: 24 }, { header: "Район", key: "district", width: 22 },
      { header: "Адрес", key: "address", width: 40 }, { header: "Latitude", key: "latitude", width: 14 },
      { header: "Longitude", key: "longitude", width: 14 },
    ];
    target.getRow(1).font = { bold: true };
    values.forEach((a) => target.addRow({ code: a.code, name: a.name, region: a.region || "", district: a.district, address: a.address, latitude: a.latitude, longitude: a.longitude }));
  };
  addExceptionSheet("Без координат", atms.filter((a) => !Number.isFinite(Number(a.latitude)) || !Number.isFinite(Number(a.longitude)) || !a.latitude || !a.longitude));
  addExceptionSheet("Без района", atms.filter((a) => !a.district));
  const codeCounts = new Map<string, number>();
  for (const atm of atms) if (atm.code) codeCounts.set(atm.code.trim(), (codeCounts.get(atm.code.trim()) || 0) + 1);
  const duplicateCodes = new Set([...codeCounts.entries()].filter(([, count]) => count > 1).map(([code]) => code));
  addExceptionSheet("Дубли ID", atms.filter((a) => a.code && duplicateCodes.has(a.code.trim())));

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="atms_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
