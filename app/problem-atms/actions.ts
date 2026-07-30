"use server";

import { createProblemReport, deleteProblemReport, updateProblemReport } from "@/lib/problem-atms";
import { findAtmByCode, updateAtm } from "@/lib/atms";
import { listStatuses } from "@/lib/statuses";
import { notifyTechnician, notifyProblemAtmToGroup } from "@/lib/notifications";
import { formatTashkentDateTime } from "@/lib/tz";
import { revalidatePath } from "next/cache";

export async function createProblemReportAction(formData: FormData) {
  const atmCode = String(formData.get("atmCode") || "").trim();
  const reason = String(formData.get("reason") || "");
  const comment = String(formData.get("comment") || "");
  const reportedBy = String(formData.get("reportedBy") || "Руководитель");
  if (!atmCode || !reason) return;

  const atm = findAtmByCode(atmCode);
  if (!atm) return;

  const report = createProblemReport({ atmId: atm.id, reason, comment, reportedBy, status: "Новый", lastNotifyResult: "", photoUrl: "" });

  // Синхронизация статуса банкомата — раз он проблемный, это должно быть видно и в его карточке
  const statuses = listStatuses();
  const problemStatus = statuses.find((s) => s.name === "Проблемный");
  if (problemStatus) updateAtm(atm.id, { workStatusId: problemStatus.id });

  // Группа "Проблемные банкоматы" узнаёт сразу, не дожидаясь ручной
  // передачи технику — раньше об этом вообще никто не уведомлялся
  // автоматически.
  const groupResult = await notifyProblemAtmToGroup({
    atmCode: atm.code,
    atmName: atm.name,
    address: atm.address,
    coordinates: `${atm.latitude}, ${atm.longitude}`,
    reason,
    comment,
    reportedBy,
    dateTime: formatTashkentDateTime(report.createdAt),
  });
  updateProblemReport(report.id, {
    lastNotifyResult: groupResult.ok ? "В группу отправлено" : `Группа: ${groupResult.error}`,
  });

  revalidatePath("/problem-atms");
  revalidatePath("/atms");
}

export async function sendToTechnicianAction(reportId: string, atmCode: string, address: string, coordinates: string, reason: string, reportedBy: string, dateTime: string) {
  const result = await notifyTechnician({ atmCode, address, coordinates, reason, reportedBy, dateTime });
  updateProblemReport(reportId, {
    status: result.ok ? "Передан технику" : "Новый",
    lastNotifyResult: result.ok ? "Отправлено технику" : result.error || "Ошибка отправки",
  });
  revalidatePath("/problem-atms");
}

export async function resolveProblemReportAction(id: string) {
  updateProblemReport(id, { status: "Решён" });
  revalidatePath("/problem-atms");
}

export async function deleteProblemReportAction(id: string) {
  deleteProblemReport(id);
  revalidatePath("/problem-atms");
}
