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
