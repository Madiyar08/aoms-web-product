import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { findAtmByCode, updateAtm } from "@/lib/atms";
import { listStatuses } from "@/lib/statuses";
import { createAtmIssue, updateAtmIssue } from "@/lib/atm-issues";
import { submitChangeRequest } from "@/lib/atm-change-history";
import { savePhotoFile, archivePhotoToTelegram } from "@/lib/photo-storage";
import { notifyProblemAtmToGroup } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";

/**
 * Единая точка приёма "ATMs with problem" — объединяет то, что раньше
 * было двумя разными формами (problem-report и no-id-report), по
 * запросу руководителя: сотрудник не должен выбирать между похожими
 * формами и тем более сначала оформлять отчёт об очистке, чтобы просто
 * сообщить о проблеме. Доступна прямо с главного экрана Mini App.
 *
 * Банкомат искать необязательно: можно ввести ID (если есть), либо
 * просто указать адрес и причину, если ID нет вообще (например,
 * банкомат совсем без наклейки).
 *
 * Причины "Неправильный адрес/координаты/район" ДОПОЛНИТЕЛЬНО создают
 * заявку в единую очередь подтверждения (lib/atm-change-history.ts) —
 * ничего не меняется в самом банкомате сразу, только после 3
 * независимых наблюдений в разные дни (или ручного решения
 * руководителя).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { initData, atmCode, address, latitude, longitude, reasons, otherText, comment, photos, correctDistrict } =
    body;

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return NextResponse.json({ ok: false, error: "Отметьте хотя бы одну причину" }, { status: 400 });
  }

  const codeTrimmed = String(atmCode || "").trim();
  const atm = codeTrimmed ? findAtmByCode(codeTrimmed) : null;

  const photoUrls = (
    await Promise.all((Array.isArray(photos) ? photos : []).map((p: string) => savePhotoFile(p)))
  ).filter((u): u is string => Boolean(u));

  const reasonText = reasons.join(", ") + (otherText ? ` — ${otherText}` : "");

  const issue = createAtmIssue({
    atmId: atm?.id || "",
    atmCode: atm?.code || codeTrimmed,
    address: atm?.address || String(address || ""),
    latitude: atm?.latitude || String(latitude ?? ""),
    longitude: atm?.longitude || String(longitude ?? ""),
    reasons,
    otherText: String(otherText || ""),
    comment: String(comment || ""),
    employeeId: employee.id,
    employeeName: employee.fullName,
    photosJson: photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined,
    status: "Новый",
    lastNotifyResult: "",
  });

  // Если банкомат найден в базе — сразу переводим в статус "Проблемный",
  // чтобы он не попал в завтрашний маршрут, пока не разберутся.
  if (atm) {
    const problemStatus = listStatuses().find((s) => s.name === "Проблемный");
    if (problemStatus) updateAtm(atm.id, { workStatusId: problemStatus.id });
  }

  // Причины про адрес/координаты/район — дополнительно заводят заявку в
  // очередь подтверждения. Новое значение координат/адреса = GPS
  // сотрудника в момент заявки (не вручную, чтобы не было опечаток).
  if (atm && latitude != null && longitude != null) {
    if (reasons.includes("Неправильный адрес") || reasons.includes("Неправильные координаты")) {
      submitChangeRequest({
        atmId: atm.id,
        atmCode: atm.code,
        changeType: "location",
        oldAddress: atm.address,
        oldLat: atm.latitude,
        oldLon: atm.longitude,
        newLat: String(latitude),
        newLon: String(longitude),
        comment: String(comment || ""),
        photosJson: photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined,
        employeeId: employee.id,
        employeeName: employee.fullName,
      });
    }
    if (reasons.includes("Неправильный район") && correctDistrict) {
      submitChangeRequest({
        atmId: atm.id,
        atmCode: atm.code,
        changeType: "district",
        oldDistrict: atm.district,
        newDistrict: String(correctDistrict),
        comment: String(comment || ""),
        photosJson: photoUrls.length > 0 ? JSON.stringify(photoUrls) : undefined,
        employeeId: employee.id,
        employeeName: employee.fullName,
      });
    }
  }

  // Уведомление — в фоне, не блокирует ответ сотруднику. Архивация фото
  // в Telegram (перенос с диска) — тоже здесь, а не до ответа: иначе
  // сотрудник снова ждал бы сеть при каждой заявке.
  const backgroundNotify = async () => {
    let finalPhotoUrls = photoUrls;
    if (photoUrls.length > 0) {
      const archivedUrls = await Promise.all(
        photoUrls.map((u) => archivePhotoToTelegram(u, `Проблема: ${issue.atmCode || "без ID"}`))
      );
      finalPhotoUrls = archivedUrls.map((archived, i) => archived || photoUrls[i]);
      if (finalPhotoUrls.some((u, i) => u !== photoUrls[i])) {
        updateAtmIssue(issue.id, { photosJson: JSON.stringify(finalPhotoUrls) });
      }
    }

    const result = await notifyProblemAtmToGroup({
      atmCode: issue.atmCode || "(без ID)",
      atmName: atm?.name || "",
      address: issue.address || "не указан",
      coordinates: issue.latitude && issue.longitude ? `${issue.latitude}, ${issue.longitude}` : "не указаны",
      reason: reasonText,
      comment: String(comment || ""),
      reportedBy: employee.fullName,
      dateTime: formatTashkentDateTime(new Date()),
      photoDataUrl: finalPhotoUrls[0],
    });
    updateAtmIssue(issue.id, {
      lastNotifyResult: result.ok ? "В группу отправлено" : `Группа: ${result.error}`,
    });
  };
  void backgroundNotify();

  return NextResponse.json({ ok: true, message: "Заявка сохранена и отправлена руководству." });
}
