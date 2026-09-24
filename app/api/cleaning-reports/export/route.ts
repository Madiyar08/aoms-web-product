import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { getAtmById } from "@/lib/atms";
import { listEmployees } from "@/lib/employees";
import { listMachines } from "@/lib/machines";
import { todayTashkent, tashkentDateString, formatTashkentDateTime } from "@/lib/tz";

/**
 * Экспорт отчётов об очистке за конкретную дату (страница "Сегодня
 * очищено" / "Отчёт: очищено за день") в Excel. Раньше на этой странице
 * не было способа скачать данные вообще — только просмотр карточек.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || todayTashkent();

  const reports = listCleaningReports()
    .filter((r) => tashkentDateString(new Date(r.clientTime)) === date)
    .sort((a, b) => (a.clientTime < b.clientTime ? 1 : -1));

  const machines = listMachines();
  const machineNumberById = new Map(machines.map((m) => [m.id, m.number]));
  const machineByEmployee = new Map<string, string>();
  for (const m of machines) {
    if (m.employee1Id) machineByEmployee.set(m.employee1Id, m.number);
    if (m.employee2Id) machineByEmployee.set(m.employee2Id, m.number);
  }
  // Запасной вариант по имени — только для отчётов до введения machineId.
  const employeeIdByName = new Map(listEmployees().map((e) => [e.fullName, e.id]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Очищено ${date}`);
  sheet.columns = [
    { header: "Время", key: "time", width: 18 },
    { header: "ID банкомата", key: "code", width: 14 },
    { header: "Название", key: "name", width: 26 },
    { header: "Адрес", key: "address", width: 34 },
    { header: "Район", key: "district", width: 18 },
    { header: "Сотрудник", key: "employee", width: 20 },
    { header: "Машина", key: "machine", width: 12 },
    { header: "Статус на месте", key: "status", width: 16 },
    { header: "В маршруте", key: "inRoute", width: 12 },
    { header: "GPS, м", key: "distance", width: 10 },
    { header: "Замечания антифрода", key: "flags", width: 34 },
    { header: "Адрес верный", key: "addressCorrect", width: 12 },
    { header: "Координаты верные", key: "coordsCorrect", width: 14 },
    { header: "Комментарий", key: "comment", width: 24 },
    { header: "Кол-во фото", key: "photoCount", width: 10 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const r of reports) {
    const atm = getAtmById(r.atmId);
    const machineNumber = r.machineId
      ? machineNumberById.get(r.machineId)
      : machineByEmployee.get(employeeIdByName.get(r.employeeName) || "");
    let photoCount = 0;
    if (r.photosJson) {
      try {
        photoCount = (JSON.parse(r.photosJson) as string[]).length;
      } catch {
        photoCount = r.photoData ? 1 : 0;
      }
    } else if (r.photoData) {
      photoCount = 1;
    }
    sheet.addRow({
      time: formatTashkentDateTime(r.clientTime),
      code: r.atmCode || "без ID",
      name: atm?.name || "",
      address: atm?.address || "",
      district: atm?.district || "",
      employee: r.employeeName,
      machine: machineNumber || "",
      status: r.reportedWorkStatusName || "",
      inRoute: r.inRoute ? "да" : "нет",
      distance: Number.isNaN(r.distanceMeters) ? "" : r.distanceMeters,
      flags: r.antifraudFlags.join("; "),
      addressCorrect: r.addressCorrect ? "да" : "нет",
      coordsCorrect: r.coordsCorrect ? "да" : "нет",
      comment: r.locationComment || "",
      photoCount,
    });
  }

  // Строка "Итого" внизу
  const totalRow = sheet.addRow({ time: "Итого", code: `${reports.length} отчётов` });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ochishheno_${date}.xlsx"`,
    },
  });
}
