
import { NextRequest, NextResponse } from "next/server";

import { validateTelegramWebhookSecret } from "@/lib/telegram-webapp";
import { getEmployeeById, updateEmployee } from "@/lib/employees";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { recordLocationPing } from "@/lib/location-pings";

import {
  parseStartPayload,
  sendTelegramMessage,
  sendMiniAppButton,
  TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

function normalizeCommand(text: string): string {
  return text
    .trim()
    .split(/\s+/)[0]
    .replace(/@[\w]+$/, "")
    .toLowerCase();
}

export async function POST(req: NextRequest) {
  // 1. Проверка секрета Webhook
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const suppliedSecret = req.headers.get(
    "x-telegram-bot-api-secret-token"
  );

  if (
    !validateTelegramWebhookSecret(
      configuredSecret,
      suppliedSecret
    )
  ) {
    console.error("[telegram-webhook] Secret validation failed");

    return NextResponse.json(
      {
        ok: false,
        error: configuredSecret
          ? "Unauthorized webhook"
          : "Webhook secret is not configured",
      },
      {
        status: configuredSecret ? 401 : 503,
      }
    );
  }

  let update: TelegramUpdate;

  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // 2. Обработка геолокации
  const liveLocation =
    update.message?.location ??
    update.edited_message?.location;

  const liveChatId =
    update.message?.chat?.id ??
    update.edited_message?.chat?.id;

  if (liveLocation && liveChatId !== undefined) {
    try {
      const employee = findEmployeeByChatId(
        String(liveChatId)
      );

      if (employee) {
        recordLocationPing(
          employee.id,
          liveLocation.latitude,
          liveLocation.longitude
        );
      }
    } catch (error) {
      console.error(
        "[telegram-webhook] Location error:",
        error
      );
    }

    return NextResponse.json({ ok: true });
  }

  // 3. Получение текстовой команды
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;

  if (!text || chatId === undefined) {
    return NextResponse.json({ ok: true });
  }

  const chatIdString = String(chatId);
  const command = normalizeCommand(text);

  // 4. /myid — показать Telegram Chat ID
  if (command === "/myid") {
    const result = await sendTelegramMessage(
      chatIdString,
      `Ваш Telegram Chat ID:\n<code>${chatIdString}</code>\n\nСкопируйте этот номер и отправьте руководителю.`
    );

    if (!result.ok) {
      console.error("[telegram-webhook] /myid:", result.error);
    }

    return NextResponse.json({ ok: true });
  }

  // 5. /help — список команд
  if (command === "/help") {
    await sendTelegramMessage(
      chatIdString,
      [
        "🤖 <b>ATM Cleaning Service</b>",
        "",
        "/start — начать работу",
        "/myid — узнать свой Telegram Chat ID",
        "/app — открыть Mini App",
        "/help — список команд",
        "",
        "Для подключения к системе обратитесь к руководителю за персональной ссылкой."
      ].join("\n")
    );

    return NextResponse.json({ ok: true });
  }

  // 6. /app — открыть Mini App
  if (command === "/app") {
    const employee = findEmployeeByChatId(chatIdString);

    if (!employee) {
      await sendTelegramMessage(
        chatIdString,
        "Вы пока не привязаны к AOMS.\n\nОтправьте руководителю свой Telegram Chat ID командой /myid и получите персональную ссылку регистрации."
      );

      return NextResponse.json({ ok: true });
    }

    const result = await sendMiniAppButton(
      chatIdString,
      `Ваш маршрут на сегодня, ${employee.fullName}:`
    );

    if (!result.ok) {
      console.error("[telegram-webhook] /app:", result.error);
    }

    return NextResponse.json({ ok: true });
  }

  // 7. /start employeeId — персональная регистрация
  if (command === "/start") {
    const parsed = parseStartPayload(update);

    if (parsed) {
      const employee = getEmployeeById(parsed.employeeId);

      if (!employee) {
        await sendTelegramMessage(
          chatIdString,
          "Ссылка регистрации недействительна или сотрудник не найден. Обратитесь к руководителю."
        );

        return NextResponse.json({ ok: true });
      }

      updateEmployee(employee.id, {
        telegramChatId: parsed.chatId,
      });

      await sendMiniAppButton(
        parsed.chatId,
        `Здравствуйте, ${employee.fullName}! Вы подключены к AOMS. Нажмите кнопку, чтобы открыть приложение и увидеть маршрут.`
      );

      return NextResponse.json({ ok: true });
    }

    // Обычный /start без персонального параметра
    await sendTelegramMessage(
      chatIdString,
      [
        "Здравствуйте! 👋",
        "",
        "Это бот ATM Cleaning Service — система управления очисткой банкоматов AOMS.",
        "",
        "Ваш Telegram Chat ID:",
        `<code>${chatIdString}</code>`,
        "",
        "Для подключения к системе отправьте этот ID руководителю и получите персональную ссылку регистрации.",
        "",
        "Доступные команды:",
        "/myid — узнать ID",
        "/app — открыть приложение",
        "/help — помощь"
      ].join("\n")
    );

    return NextResponse.json({ ok: true });
  }

  // 8. Неизвестная команда
  if (text.startsWith("/")) {
    await sendTelegramMessage(
      chatIdString,
      "Неизвестная команда. Используйте /help."
    );
  }

  return NextResponse.json({ ok: true });
}
