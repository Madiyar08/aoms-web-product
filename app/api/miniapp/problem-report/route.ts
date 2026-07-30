import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram-webapp";
import { findEmployeeByChatId } from "@/lib/miniapp";
import { getAtmById, findAtmByCode, updateAtm } from "@/lib/atms";
import { listStatuses } from "@/lib/statuses";
import { createProblemReport, updateProblemReport } from "@/lib/problem-atms";
import { notifyProblemAtmToGroup } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";
import { savePhotoFile } from "@/lib/photo-storage";

/**
 * Жалоба на неисправный банкомат прямо из Mini App — раньше зарегистрировать
 * проблему мог только руководитель через веб-панель, у сотрудников такой
 * возможности не было вообще.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { initData, atmId, atmCode, reason, comment, photoData } = body;

  const auth = validateTelegramInitData(initData || "");
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ ok: false, error: "Не удалось подтвердить личность" }, { status: 401 });
  }
  const employee = findEmployeeByChatId(auth.userId);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Сотрудник не найден" }, { status: 403 });
  }
  if (!reason) {
    return NextResponse.json({ ok: false, error: "Не указана причина" }, { status: 400 });
  }

  const atm = atmId ? getAtmById(atmId) : atmCode ? findAtmByCode(String(atmCode).trim()) : null;
  if (!atm) {
    return NextResponse.json({ ok: false, error: "Банкомат не найден — проверьте ID" }, { status: 404 });
  }

  const photoUrl = (await savePhotoFile(photoData || "")) || "";

  const report = createProblemReport({
    atmId: atm.id,
    reason: String(reason),
    comment: String(comment || ""),
    reportedBy: employee.fullName,
    status: "Новый",
    lastNotifyResult: "",
    photoUrl,
  });

  // Синхронизация статуса банкомата, как и в веб-панели
  const problemStatus = listStatuses().find((s) => s.name === "Проблемный");
  if (problemStatus) updateAtm(atm.id, { workStatusId: problemStatus.id });

  const groupResult = await notifyProblemAtmToGroup({
    atmCode: atm.code,
    atmName: atm.name,
    address: atm.address,
    coordinates: `${atm.latitude}, ${atm.longitude}`,
    reason: String(reason),
    comment: String(comment || ""),
    reportedBy: employee.fullName,
    dateTime: formatTashkentDateTime(report.createdAt),
    photoDataUrl: photoUrl || undefined,
  });
  updateProblemReport(report.id, {
    lastNotifyResult: groupResult.ok ? "В группу отправлено" : `Группа: ${groupResult.error}`,
  });

  // Отчёт всегда сохраняется (это главное — данные не теряются), но
  // сотрудник должен ЗНАТЬ, если сообщение реально не дошло до группы —
  // раньше здесь всегда стоял один и тот же текст "руководитель
  // уведомлён", даже когда отправка провалилась (например, переменная
  // группы не задана или бот не добавлен в неё). Это скрывало проблему:
  // отчёт в базе есть, а специалист о нём не узнаёт, пока кто-то не
  // откроет веб-панель и не заметит.
  return NextResponse.json({
    ok: true,
    message: groupResult.ok
      ? "Заявка сохранена и отправлена в группу."
      : "Заявка сохранена, НО в группу не отправилась — сообщите руководителю напрямую.",
    groupNotified: groupResult.ok,
  });
}
