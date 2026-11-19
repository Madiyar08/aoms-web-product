import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { findAtmByCode } from "@/lib/atms";
import { savePhotoFile, saveInspectorVideoFile } from "@/lib/photo-storage";
import { createInspectorReport, updateInspectorReport } from "@/lib/inspector-reports";
import { validateInspectorReportInput } from "@/lib/inspector-report-validation";
import { notifyManagerReport } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";
import { enqueueInspectorMediaArchive } from "@/lib/inspector-media-queue";

export async function POST(req: NextRequest) {
  let body: any;
  let videoFile: File | null = null;
  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
      body.photos = JSON.parse(String(form.get("photos") || "[]"));
      videoFile = form.get("video") instanceof File ? form.get("video") as File : null;
      body.video = videoFile;
    } else { body = await req.json(); }
  } catch { return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 }); }
  const auth = validateTelegramInitData(body?.initData || "");
  if (!auth.valid || !auth.userId) return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee || employee.role !== "Проверяющий") return NextResponse.json({ ok: false, error: "Доступно только сотрудникам с ролью «Проверяющий»" }, { status: 403 });

  const invalid = validateInspectorReportInput(body);
  if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
  const atmCode = String(body.atmCode || "").trim();
  const atm = atmCode ? findAtmByCode(atmCode) : null;
  const photos: string[] = Array.isArray(body.photos) ? body.photos : [];
  const photoUrls = (await Promise.all(photos.map((photo) => savePhotoFile(photo)))).filter((url): url is string => Boolean(url));
  if (photoUrls.length !== photos.length) {
    return NextResponse.json({ ok: false, error: "Не удалось сохранить все фотографии. Отчёт не создан; повторите отправку." }, { status: 507 });
  }

  const videoUrl = videoFile ? await saveInspectorVideoFile(videoFile) : "";
  if (videoFile && !videoUrl) return NextResponse.json({ ok: false, error: "Не удалось сохранить видео. Проверьте формат и размер (до 50 МБ)." }, { status: 507 });

  const latitude = body.latitude == null ? null : Number(body.latitude);
  const longitude = body.longitude == null ? null : Number(body.longitude);
  const gpsAccuracy = body.gpsAccuracy == null ? null : Number(body.gpsAccuracy);
  const gpsQuality = latitude === null ? "missing" : gpsAccuracy !== null && gpsAccuracy <= 50 ? "good" : "weak";
  const report = createInspectorReport({
    atmId: atm?.id || "", atmCode: atm?.code || atmCode, atmName: atm?.name || "",
    address: atm?.address || String(body.address || ""), comment: String(body.comment).trim(),
    employeeId: employee.id, employeeName: employee.fullName, latitude, longitude, gpsAccuracy,
    gpsCapturedAt: String(body.gpsCapturedAt || ""), gpsQuality, photosJson: JSON.stringify(photoUrls),
    videoUrl: videoUrl || "", status: "Новый", notificationStatus: "Ожидает уведомления",
  });

  // Архивирование медиа ставится в устойчивую SQLite-очередь до ответа.
  // Сам Telegram-вызов выполняет фоновый worker; сотрудник не ждёт загрузки.
  try { enqueueInspectorMediaArchive(report.id); }
  catch (error) { console.error("[inspector-report] не удалось поставить медиа в очередь", error); }

  // Уведомление не блокирует ответ Mini App. Отчёт уже сохранён в отдельной таблице
  // и не участвует в расчётах KPI уборки.
  const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  void notifyManagerReport([
    "🔎 <b>Новый инспекторский отчёт</b>",
    report.atmCode ? `Банкомат: ${escapeHtml(report.atmCode)}${report.atmName ? ` — ${escapeHtml(report.atmName)}` : ""}` : "Банкомат: не указан",
    report.address ? `Адрес: ${escapeHtml(report.address)}` : "",
    `Проверяющий: ${escapeHtml(report.employeeName)}`,
    `GPS: ${report.latitude === null ? "не получен" : `${report.latitude}, ${report.longitude} (точность ${report.gpsAccuracy ?? "не указана"} м; ${report.gpsQuality})`}`,
    `Фото: ${photoUrls.length}`,
    videoUrl ? `Видео: ${videoUrl}` : "Видео: нет",
    `Комментарий: ${escapeHtml(report.comment)}`,
    `Время: ${formatTashkentDateTime(new Date())}`,
  ].filter(Boolean).join("\n")).then((result) => updateInspectorReport(report.id, { notificationStatus: result.ok ? "Уведомление отправлено" : `Ошибка уведомления: ${result.error || "неизвестная ошибка"}` })).catch((error) => { console.error("[inspector-report] notification failed", error); updateInspectorReport(report.id, { notificationStatus: "Ошибка уведомления" }); });

  return NextResponse.json({ ok: true, reportId: report.id, message: "Инспекторский отчёт сохранён" });
}
