import { NextRequest, NextResponse } from "next/server";
import { getEmployeeById, updateEmployee } from "@/lib/employees";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { recordLocationPing } from "@/lib/location-pings";
import {
  parseStartPayload,
  sendTelegramMessage,
  sendMiniAppButton,
  TelegramUpdate,
} from "@/lib/telegram";

export async function POST(req: NextRequest) {
  const update = (await req.json()) as TelegramUpdate;

  // Live-геопозиция (Этап 1 трекинга экипажей): первое сообщение с
  // геопозицией приходит в message, а последующие обновления координат,
  // пока трансляция активна, приходят как edited_message — Telegram
  // правит то же самое сообщение, а не шлёт новое.
  const liveLocation = update.message?.location ?? update.edited_message?.location;
  const liveChatId = update.message?.chat?.id ?? update.edited_message?.chat?.id;
  if (liveLocation && liveChatId !== undefined) {
    const employee = findEmployeeByChatId(String(liveChatId));
    if (employee) {
      recordLocationPing(employee.id, liveLocation.latitude, liveLocation.longitude);
    }
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;

  // /myid — узнать chat_id
  if (text === "/myid" && chatId !== undefined) {
    await sendTelegramMessage(String(chatId), `Chat ID этого чата: <code>${chatId}</code>`);
    return NextResponse.json({ ok: true });
  }

  // /app — открыть приложение (для уже привязанных сотрудников)
  if (text === "/app" && chatId !== undefined) {
    const employee = findEmployeeByChatId(String(chatId));
    if (employee) {
      await sendMiniAppButton(String(chatId), `Ваш маршрут на сегодня, ${employee.fullName}:`);
    } else {
      await sendTelegramMessage(String(chatId), "Вы не привязаны к системе. Обратитесь к руководителю за ссылкой регистрации.");
    }
    return NextResponse.json({ ok: true });
  }

  // /start <employeeId> — привязка сотрудника
  const parsed = parseStartPayload(update);
  if (parsed) {
    const employee = getEmployeeById(parsed.employeeId);
    if (employee) {
      updateEmployee(employee.id, { telegramChatId: parsed.chatId });
      await sendMiniAppButton(
        parsed.chatId,
        `Здравствуйте, ${employee.fullName}! Вы подключены к AOMS. Нажмите кнопку, чтобы открыть приложение и увидеть маршрут.`
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
