import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listAtms } from "@/lib/atms";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { tashkentDateString, todayTashkent } from "@/lib/tz";

/**
 * Матрица очистки: банкоматы по строкам, даты по столбцам, "1" если
 * банкомат был очищен в этот день. Воспроизводит прежний ручной процесс
 * в Excel (искали банкомат по ID среди сообщений в группе за день,
 * ставили 1 в колонку сегодняшней даты) — теперь строится автоматически
 * из реальных отчётов, без поиска по сообщениям вручную.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") || todayTashkent();
  const from = searchParams.get("from") || addDays(to, -29); // по умолчанию последние 30 дней

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    dates.push(d);
    if (dates.length > 366) break; // защита от случайно огромного диапазона
  }

  const atms = listAtms().sort((a, b) => (a.district || "").localeCompare(b.district || ""));
  const reports = listCleaningReports();

  // Быстрый поиск: какие банкоматы очищены в какую дату
  const cleanedSet = new Set<string>();
  for (const r of reports) {
    if (!r.atmId) continue;
    const d = tashkentDateString(new Date(r.clientTime));
    cleanedSet.add(`${r.atmId}|${d}`);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Матрица очистки");

  const columns = [
    { header: "ID", key: "code", width: 12 },
    { header: "Название", key: "name", width: 26 },
    { header: "Район", key: "district", width: 18 },
    ...dates.map((d) => ({ header: d, key: d, width: 11 })),
  ];
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };

  for (const atm of atms) {
    const row: Record<string, string> = { code: atm.code || "(без ID)", name: atm.name, district: atm.district };
    for (const d of dates) {
      row[d] = cleanedSet.has(`${atm.id}|${d}`) ? "1" : "";
    }
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="matrix_${from}_${to}.xlsx"`,
    },
  });
}
