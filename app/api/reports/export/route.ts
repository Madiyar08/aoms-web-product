import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { buildReportRows } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const machineId = searchParams.get("machineId") || undefined;

  const rows = buildReportRows({ dateFrom, dateTo, machineId });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Отчёт");
  sheet.columns = [
    { header: "Дата", key: "date", width: 12 },
    { header: "Машина", key: "machineNumber", width: 12 },
    { header: "Районы", key: "districts", width: 30 },
    { header: "KPI", key: "kpiTarget", width: 8 },
    { header: "Банкоматов в маршруте (план)", key: "plannedAtms", width: 26 },
    { header: "Выполнено в маршруте", key: "doneInRoute", width: 18 },
    { header: "Выполнено вне маршрута", key: "doneOutOfRoute", width: 20 },
    { header: "Итого выполнено (банкоматов)", key: "doneTotal", width: 20 },
    { header: "Точек (для KPI)", key: "doneStops", width: 16 },
    { header: "% от KPI", key: "donePct", width: 14 },
    { header: "Исключено правилами", key: "excludedCount", width: 20 },
    { header: "Статус маршрута", key: "routeStatus", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="otchet_${dateFrom || "all"}_${dateTo || "all"}.xlsx"`,
    },
  });
}
