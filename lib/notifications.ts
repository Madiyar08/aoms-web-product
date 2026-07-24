import { getEmployeeById } from "./employees";
import { listMachines, getMachineById } from "./machines";
import { RouteEntry } from "./routes";
import { CleaningReport } from "./cleaning-reports";
import { Atm } from "./atms";
import { sendTelegramMessage, sendTelegramPhoto, SendResult } from "./telegram";
import { formatTashkentDateTime } from "./tz";

/**
 * Отправляет каждый принятый отчёт об очистке в общую Telegram-группу —
 * раньше это никуда не уходило: сообщение руководителю (notifyManagerReport)
 * отправлялось только при сработавшем антифроде, а в группу вообще ничего
 * не шло. Идёт с фото, если оно есть.
 */
export async function notifyCleaningReportToGroup(report: CleaningReport, atm: Atm | null): Promise<SendResult> {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || "";
  if (!chatId) return { ok: false, error: "TELEGRAM_GROUP_CHAT_ID не задан — отчёт не отправлен в группу" };

  // Машина и экипаж сотрудника (п.7 ТЗ: в сообщении должны быть машина,
  // экипаж, район) — ищем машину, где сотрудник числится в экипаже.
  const machine = listMachines().find(
    (m) => m.employee1Id === report.employeeId || m.employee2Id === report.employeeId
  );
  const crewNames = machine
    ? [machine.employee1Id, machine.employee2Id]
        .filter(Boolean)
        .map((id) => getEmployeeById(id as string)?.fullName)
        .filter(Boolean)
        .join(" + ")
    : "";

  const lines = [
    `🧾 <b>Отчёт об очистке</b>`,
    `Банкомат: ${report.atmCode || "без ID"}${atm ? ` — ${atm.name}` : ""}`,
    atm?.address ? `Адрес: ${atm.address}` : "",
    atm?.district ? `Район: ${atm.district}` : "",
    machine ? `Машина: ${machine.number}` : "",
    crewNames ? `Экипаж: ${crewNames}` : "",
    `Сотрудник: ${report.employeeName}`,
    `Статус на месте: ${report.reportedWorkStatusName || "не указан"}`,
    `Адрес верный: ${report.addressCorrect ? "да" : "нет"} · Координаты верные: ${report.coordsCorrect ? "да" : "нет"}`,
    report.locationComment ? `Комментарий по адресу/координатам: ${report.locationComment}` : "",
    `В маршруте: ${report.inRoute ? "да" : "нет (внеочередная очистка)"}`,
    `Расстояние GPS↔банкомат: ${Number.isNaN(report.distanceMeters) ? "не проверено" : `${report.distanceMeters} м`}`,
    report.antifraudFlags.length > 0 ? `⚠️ Замечания: ${report.antifraudFlags.join("; ")}` : "",
    `Время: ${formatTashkentDateTime(report.clientTime)}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Собираем все фото отчёта: новый формат — массив ссылок в photosJson,
  // старый — одиночное photoData. Отправляем ПЕРВОЕ фото с полной
  // подписью, остальные — следом без подписи, чтобы в группу попали все
  // снимки, что сделал сотрудник, а не только один.
  let allPhotos: string[] = [];
  if (report.photosJson) {
    try {
      const parsed = JSON.parse(report.photosJson);
      if (Array.isArray(parsed)) allPhotos = parsed.filter(Boolean);
    } catch {
      /* если JSON битый — откатываемся на одиночное фото ниже */
    }
  }
  if (allPhotos.length === 0 && report.photoData) allPhotos = [report.photoData];

  if (allPhotos.length === 0) {
    return sendTelegramMessage(chatId, lines + "\n\n(фото не приложено)");
  }

  // Первое фото — с подписью (в нём вся текстовая информация отчёта)
  const firstResult = await sendTelegramPhoto(chatId, allPhotos[0], lines);
  // Остальные фото — по одному, без подписи (подпись уже в первом)
  for (let i = 1; i < allPhotos.length; i++) {
    await sendTelegramPhoto(chatId, allPhotos[i], `📷 Фото ${i + 1} из ${allPhotos.length}`);
  }
  return firstResult;
}

/**
 * Отправляет маршрут одновременно водителю и уборщику (двум сотрудникам
 * экипажа) — прямое требование ТЗ ("получают одновременно").
 */
export async function notifyRouteToCrew(
  route: RouteEntry
): Promise<{ employee1: SendResult | null; employee2: SendResult | null }> {
  const machine = getMachineById(route.machineId);
  if (!machine) return { employee1: null, employee2: null };

  const linkLines =
    route.yandexUrls.length <= 1
      ? [`Открыть маршрут в Яндекс Картах:`, route.yandexUrls[0] ?? ""]
      : [
          `Маршрут разбит на ${route.yandexUrls.length} отрезка (открывайте по очереди):`,
          ...route.yandexUrls.map((url, i) => `${i + 1}) ${url}`),
        ];

  const text = [
    `📍 <b>Маршрут на ${route.date}</b>`,
    `Машина №${machine.number}`,
    `Банкоматов в маршруте: ${route.atmIds.length} (остановок на карте: ${route.stopsCount})`,
    route.excludedCount > 0
      ? `Исключено правилами (категория/статус): ${route.excludedCount}`
      : "",
    ...linkLines,
  ]
    .filter(Boolean)
    .join("\n");

  const chatId1 = machine.employee1Id ? getEmployeeById(machine.employee1Id)?.telegramChatId || "" : "";
  const chatId2 = machine.employee2Id ? getEmployeeById(machine.employee2Id)?.telegramChatId || "" : "";

  const employee1 = chatId1 ? await sendTelegramMessage(chatId1, text) : null;
  // Если у второго сотрудника тот же chat ID (например, на машине по ошибке
  // дважды указан один и тот же человек, либо два профиля сотрудника
  // привязаны к одному Telegram-аккаунту) — не шлём то же сообщение ещё
  // раз, иначе человек получает два одинаковых уведомления подряд.
  const employee2 = chatId2 && chatId2 !== chatId1 ? await sendTelegramMessage(chatId2, text) : null;

  return { employee1, employee2 };
}

/**
 * Уведомление техническому специалисту о проблемном банкомате.
 * Отдельное направление от общей группы — прямое требование ТЗ.
 * chatId технического специалиста берётся из переменной окружения,
 * т.к. это не сотрудник в штатном справочнике, а фиксированный получатель.
 */
export async function notifyTechnician(details: {
  atmCode: string;
  address: string;
  coordinates: string;
  reason: string;
  reportedBy: string;
  dateTime: string;
}): Promise<SendResult> {
  const chatId = process.env.TELEGRAM_TECHNICIAN_CHAT_ID || "";
  const text = [
    `🔧 <b>Проблемный банкомат</b>`,
    `ID: ${details.atmCode || "без ID"}`,
    `Адрес: ${details.address}`,
    `Координаты: ${details.coordinates}`,
    `Причина: ${details.reason}`,
    `Сотрудник: ${details.reportedBy}`,
    `Дата/время: ${details.dateTime}`,
  ].join("\n");

  return sendTelegramMessage(chatId, text);
}

/**
 * Отдельная группа именно для проблемных банкоматов (не путать с общей
 * группой отчётов об очистке и с личным чатом техника). chatId берётся
 * из TELEGRAM_PROBLEM_ATMS_CHAT_ID. Отправляется автоматически при
 * регистрации проблемы — не нужно отдельно нажимать "передать технику",
 * чтобы группа узнала о проблеме.
 */
export async function notifyProblemAtmToGroup(details: {
  atmCode: string;
  atmName: string;
  address: string;
  coordinates: string;
  reason: string;
  comment: string;
  reportedBy: string;
  dateTime: string;
  photoDataUrl?: string;
}): Promise<SendResult> {
  // Пользователь задаёт эту группу в Railway. Поддерживаем оба имени
  // переменной, т.к. в разных версиях кода они назывались по-разному —
  // TELEGRAM_PROBLEM_GROUP_CHAT_ID (актуальное) и TELEGRAM_PROBLEM_ATMS_CHAT_ID
  // (старое). Иначе отчёт молча не уходит, если имя не совпало.
  const chatId =
    process.env.TELEGRAM_PROBLEM_GROUP_CHAT_ID ||
    process.env.TELEGRAM_PROBLEM_ATMS_CHAT_ID ||
    "";
  if (!chatId)
    return { ok: false, error: "TELEGRAM_PROBLEM_GROUP_CHAT_ID не задан" };

  const text = [
    `⚠️ <b>Проблемный банкомат</b>`,
    `${details.atmCode || "без ID"}${details.atmName ? ` — ${details.atmName}` : ""}`,
    details.address ? `Адрес: ${details.address}` : "",
    details.coordinates ? `Координаты: ${details.coordinates}` : "",
    `Причина: ${details.reason}`,
    details.comment ? `Комментарий: ${details.comment}` : "",
    `Сообщил: ${details.reportedBy}`,
    `Дата/время: ${details.dateTime}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (details.photoDataUrl) {
    return sendTelegramPhoto(chatId, details.photoDataUrl, text);
  }
  return sendTelegramMessage(chatId, text);
}

/**
 * Ежедневная сводка в общую Telegram-группу.
 * chatId группы — тоже из окружения (это не сотрудник, а групповой чат).
 */
export async function notifyDailySummary(summary: {
  date: string;
  entries: Array<{ machineNumber: string; district: string; kpi: number; done: number }>;
}): Promise<SendResult> {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID || "";
  const lines = summary.entries.map(
    (e) =>
      `Машина №${e.machineNumber} · ${e.district} · KPI ${e.kpi} · выполнено ${e.done}` +
      (e.done >= e.kpi ? " ✅" : " ⚠️")
  );
  const text = [`📊 <b>Сводка за ${summary.date}</b>`, ...lines].join("\n");
  return sendTelegramMessage(chatId, text);
}

/**
 * Личный отчёт руководителю — отдельный канал от общей группы, чтобы
 * можно было слать более подробную/чувствительную сводку не всем, а
 * конкретно руководителю. Заготовка: сам модуль «Отчёты» ещё не
 * реализован, поэтому вызывать пока нечем — но канал доставки готов.
 */
export async function notifyManagerReport(text: string): Promise<SendResult> {
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID || "";
  return sendTelegramMessage(chatId, text);
}
