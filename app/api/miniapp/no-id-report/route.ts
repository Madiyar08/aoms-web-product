import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { createNoIdReport } from "@/lib/no-id-reports";
import { savePhotoFile, archivePhotoToTelegram } from "@/lib/photo-storage";
import { notifyTechnician } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";
import { updateNoIdReport } from "@/lib/no-id-reports";

/**
 * Приём отчёта "Банкомат без ID" (п.3 ТЗ): наклейки нет / не работает /
 * не удалось получить чек / чек получен. Сохраняется отдельно от обычных
 * отчётов об очистке, чтобы руководитель разбирал такие случаи одним
 * списком, а не искал их среди обычных отчётов.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    initData,
    address,
    latitude,
    longitude,
    noSticker,
    notWorking,
    cantGetReceipt,
    gotReceipt,
    comment,
    photos,
  } = body;

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  if (!noSticker && !notWorking && !cantGetReceipt && !gotReceipt) {
    return NextResponse.json({ ok: false, error: "Отметьте хотя бы один пункт." }, { status: 400 });
  }

  const photoUrls = (
    await Promise.all((Array.isArray(photos) ? photos : []).map((p: string) => savePhotoFile(p)))
  ).filter((u): u is string => Boolean(u));

  const report = createNoIdReport({
    employeeId: employee.id,
    employeeName: employee.fullName,
    address: String(address || ""),
    latitude: String(latitude ?? ""),
    longitude: String(longitude ?? ""),
    noSticker: Boolean(noSticker),
    notWorking: Boolean(notWorking),
    cantGetReceipt: Boolean(cantGetReceipt),
    gotReceipt: Boolean(gotReceipt),
    comment: String(comment || ""),
    photosJson: photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined,
    status: "Новый",
  });

  // Уведомление в фоне — не заставляем сотрудника ждать (тот же принцип,
  // что и для обычных отчётов). Архивация фото в Telegram — тоже здесь,
  // а не до ответа, иначе savePhotoFile снова заставлял бы ждать сеть.
  void (async () => {
    let finalUrls = photoUrls;
    if (photoUrls.length > 0) {
      const archived = await Promise.all(photoUrls.map((u) => archivePhotoToTelegram(u, "Банкомат без ID")));
      finalUrls = archived.map((a, i) => a || photoUrls[i]);
      if (finalUrls.some((u, i) => u !== photoUrls[i])) {
        updateNoIdReport(report.id, { photosJson: JSON.stringify(finalUrls) });
      }
    }
    await notifyTechnician({
      atmCode: "(без ID)",
      address: report.address,
      coordinates: `${report.latitude}, ${report.longitude}`,
      reason: [
        noSticker && "нет наклейки",
        notWorking && "не работает",
        cantGetReceipt && "не удалось получить чек",
        gotReceipt && "чек получен",
      ]
        .filter(Boolean)
        .join(", ") + (comment ? ` — ${comment}` : ""),
      reportedBy: employee.fullName,
      dateTime: formatTashkentDateTime(new Date()),
    }).catch(() => {});
  })();

  return NextResponse.json({ ok: true, reportId: report.id, message: "Отчёт сохранён." });
}
