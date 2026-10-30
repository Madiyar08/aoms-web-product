"use server";

import { createScheduleEntry, deleteScheduleEntry, updateScheduleEntry } from "@/lib/schedule";
import { revalidatePath } from "next/cache";

export async function createScheduleAction(formData: FormData) {
  const date = String(formData.get("date") || "");
  const machineId = String(formData.get("machineId") || "");
  const districts = formData.getAll("districts").map(String).filter(Boolean);
  const kpiTarget = parseInt(String(formData.get("kpiTarget") || "0"), 10) || 0;
  if (!date || !machineId || districts.length === 0) return;

  createScheduleEntry({
    date,
    machineId,
    districts,
    kpiTarget,
    comments: String(formData.get("comments") || ""),
  });
  revalidatePath("/schedule");
}

export async function deleteScheduleAction(id: string) {
  deleteScheduleEntry(id);
  revalidatePath("/schedule");
}

export async function createRecurringScheduleAction(formData: FormData) {
  const { createRecurringSchedule } = await import("@/lib/recurring-schedule");
  const machineId = String(formData.get("machineId") || "");
  const districts = formData.getAll("districts").map(String).filter(Boolean);
  const kpiTarget = parseInt(String(formData.get("kpiTarget") || "0"), 10) || 0;
  const daysOfWeek = formData.getAll("daysOfWeek").map((d) => parseInt(String(d), 10));
  if (!machineId || districts.length === 0 || daysOfWeek.length === 0) return;

  createRecurringSchedule({
    machineId,
    daysOfWeek,
    districts,
    kpiTarget,
    comments: String(formData.get("comments") || ""),
    active: true,
  });
  revalidatePath("/schedule");
}

export async function toggleRecurringScheduleAction(id: string, active: boolean) {
  const { updateRecurringSchedule } = await import("@/lib/recurring-schedule");
  updateRecurringSchedule(id, { active });
  revalidatePath("/schedule");
}

export async function deleteRecurringScheduleAction(id: string) {
  const { deleteRecurringSchedule } = await import("@/lib/recurring-schedule");
  deleteRecurringSchedule(id);
  revalidatePath("/schedule");
}
