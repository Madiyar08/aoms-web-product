import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { findAtmByCode } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { listStatuses } from "@/lib/statuses";
import { listCleaningReports } from "@/lib/cleaning-reports";
import { listAtmIssues } from "@/lib/atm-issues";
import { listChangeRequests } from "@/lib/atm-change-history";
import { formatTashkentDateTime } from "@/lib/tz";

/**
 * Поиск банкомата для ВЫЕЗДНОЙ ПРОВЕРКИ руководителем — в отличие от
 * обычного поиска сотрудника (lookup-atm), здесь НЕТ ограничений по
 * сегодняшнему маршруту или району: проверяющий должен найти ЛЮБОЙ
 * банкомат системы, чтобы сверить данные с тем, что видит на месте.
 * Доступно только сотрудникам с ролью "Проверяющий".
 */
export async function POST(req: NextRequest) {
  const { initData, code } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  if (employee.role !== "Проверяющий") {
    return NextResponse.json({ ok: false, error: "Доступно только с ролью «Проверяющий»" }, { status: 403 });
  }

  const trimmed = String(code || "").trim();
  const atm = findAtmByCode(trimmed);
  if (!atm) {
    return NextResponse.json({ ok: false, error: "Банкомат с таким ID не найден в базе." }, { status: 404 });
  }

  const category = listCategories().find((c) => c.id === atm.categoryId);
  const status = listStatuses().find((s) => s.id === atm.workStatusId);

  // Полная история очистки этого банкомата — не только последняя дата,
  // а все отчёты, самые свежие первыми.
  const history = listCleaningReports()
    .filter((r) => r.atmId === atm.id)
    .sort((a, b) => (a.clientTime < b.clientTime ? 1 : -1))
    .slice(0, 20) // достаточно последних 20 — полная история за всё время не нужна на маленьком экране
    .map((r) => ({
      date: formatTashkentDateTime(r.clientTime),
      employeeName: r.employeeName,
      inRoute: r.inRoute,
      antifraudFlags: r.antifraudFlags,
    }));

  const issues = listAtmIssues()
    .filter((i) => i.atmId === atm.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10)
    .map((i) => ({
      date: formatTashkentDateTime(i.createdAt),
      reasons: i.reasons,
      status: i.status,
      employeeName: i.employeeName,
    }));

  const pendingChanges = listChangeRequests()
    .filter((c) => c.atmId === atm.id && c.status === "pending")
    .map((c) => ({ changeType: c.changeType, reportDate: c.reportDate }));

  return NextResponse.json({
    ok: true,
    atm: {
      id: atm.id,
      code: atm.code,
      name: atm.name,
      address: atm.address,
      district: atm.district,
      latitude: atm.latitude,
      longitude: atm.longitude,
      category: category?.name || "",
      status: status?.name || "",
      lastCleanedDate: atm.lastCleanedDate || "",
      addressVerified: atm.addressVerified,
      coordsVerified: atm.coordsVerified,
    },
    history,
    issues,
    pendingChanges,
  });
}
