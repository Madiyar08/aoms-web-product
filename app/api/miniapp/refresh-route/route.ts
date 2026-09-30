import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId, getTodayRouteForEmployee } from "@/lib/miniapp";
import { buildRouteForSchedule } from "@/lib/routes";

/**
 * Сотрудник нажимает "Обновить" на предупреждении "список мог
 * устареть" — реально перестраивает маршрут (не просто перезапрашивает
 * старые данные). Раньше перестроить маршрут можно было только с
 * веб-страницы "Маршруты" — сотрудник в поле должен был звонить
 * руководителю и просить перестроить.
 */
export async function POST(req: NextRequest) {
  const { initData } = await req.json();
  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }

  const { scheduleId } = getTodayRouteForEmployee(employee.id);
  if (!scheduleId) {
    return NextResponse.json({ ok: false, error: "На сегодня нет назначенного расписания" }, { status: 404 });
  }

  const result = await buildRouteForSchedule(scheduleId);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
