import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { getAtmById } from "@/lib/atms";
import { notifyManagerReport } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";

/** Сообщение о проблеме при выездной проверке — уходит лично
 * руководителю (TELEGRAM_MANAGER_CHAT_ID), не в общие группы. */
export async function POST(req: NextRequest) {
  const { initData, atmId, message } = await req.json();

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee || employee.role !== "Проверяющий") {
    return NextResponse.json({ ok: false, error: "Доступно только с ролью «Проверяющий»" }, { status: 403 });
  }
  if (!message || !String(message).trim()) {
    return NextResponse.json({ ok: false, error: "Напишите сообщение" }, { status: 400 });
  }

  const atm = atmId ? getAtmById(String(atmId)) : null;

  const result = await notifyManagerReport(
    [
      `🔎 <b>Замечание от проверяющего на месте</b>`,
      atm ? `Банкомат: ${atm.code} — ${atm.name}` : "",
      atm ? `Адрес: ${atm.address}` : "",
      `От: ${employee.fullName}`,
      `Сообщение: ${String(message).trim()}`,
      `Время: ${formatTashkentDateTime(new Date())}`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return NextResponse.json({ ok: result.ok, error: result.ok ? undefined : result.error });
}
