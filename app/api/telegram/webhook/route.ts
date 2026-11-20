
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

  // 2. Чтение обновления Telegram
  let update: TelegramUpdate;

  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // 3. Обработка геолокации
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

  // 4. Получение команды
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;

  if (!text || chatId === undefined) {
    return NextResponse.json({ ok: true });
  }

  const chatIdString = String(chatId);
  const command = normalizeCommand(text);

  // 5. /myid — показать Telegram Chat ID
  if (command === "/myid") {
    const result = await sendTelegramMessage(
      chatIdString,
      [
        "Ваш Telegram Chat ID:",
        `<code>${chatIdString}</code>`,
        "",
        "Отправьте этот номер руководителю для привязки к AOMS."
      ].join("\n")
    );

    if (!result.ok) {
      console.error("[telegram-webhook] /myid:", result.error);
    }

    return NextResponse.json({ ok: true });
  }

  // 6. /help — список команд
  if (command === "/help") {
    const result = await sendTelegramMessage(
      chatIdString,
      [
        "🤖 <b>ATM Cleaning Service</b>",
        "",
        "/start — начать работу",
        "/myid — узнать Telegram Chat ID",
        "/app — открыть Mini App",
        "/help — помощь",
        "",
        "Для подключения к системе обратитесь к руководителю за персональной ссылкой."
      ].join("\n")
    );

    if (!result.ok) {
      console.error("[telegram-webhook] /help:", result.error);
    }

    return NextResponse.json({ ok: true });
  }

  // 7. /app — открыть Mini App
  if (command === "/app") {
    const employee = findEmployeeByChatId(chatIdString);

    if (!employee) {
      const result = await sendTelegramMessage(
        chatIdString,
        "Вы пока не привязаны к AOMS.\n\nОтправьте руководителю свой Telegram Chat ID командой /myid и получите персональную ссылку регистрации."
      );

      if (!result.ok) {
        console.error("[telegram-webhook] /app:", result.error);
      }

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

  // 8. /start — регистрация или приветствие
  if (command === "/start") {
    const parsed = parseStartPayload(update);

    // Персональная регистрационная ссылка
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

      const result = await sendMiniAppButton(
        parsed.chatId,
        `Здравствуйте, ${employee.fullName}! Вы подключены к AOMS. Нажмите кнопку, чтобы открыть приложение и увидеть маршрут.`
      );

      if (!result.ok) {
        console.error("[telegram-webhook] Registration:", result.error);
      }

      return NextResponse.json({ ok: true });
    }

    // Обычный /start без параметра
    const result = await sendTelegramMessage(
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

    if (!result.ok) {
      console.error("[telegram-webhook] /start:", result.error);
    }

    return NextResponse.json({ ok: true });
  }

  // 9. Неизвестная команда
  if (text.startsWith("/")) {
    await sendTelegramMessage(
      chatIdString,
      "Неизвестная команда. Используйте /help."
    );
  }

  return NextResponse.json({ ok: true });
}
