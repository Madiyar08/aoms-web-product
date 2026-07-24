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
    const header = "ID,Название,Адрес,Район,Широта,Долгота,Категория,Статус,Адрес подтверждён,Координаты подтверждены,Последняя очистка,Комментарий";
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
  const sheet = workbook.addWorksheet("Банкоматы");
  sheet.columns = [
    { header: "ID", key: "id", width: 12 },
    { header: "Название", key: "name", width: 28 },
    { header: "Адрес", key: "address", width: 36 },
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

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="atms_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
