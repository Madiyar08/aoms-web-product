"use server";

import { createMachine, deleteMachine, updateMachine } from "@/lib/machines";
import { revalidatePath } from "next/cache";

export async function createMachineAction(formData: FormData) {
  const number = String(formData.get("number") || "").trim();
  if (!number) return;
  createMachine({
    number,
    employee1Id: String(formData.get("employee1Id") || ""),
    employee2Id: String(formData.get("employee2Id") || ""),
    status: String(formData.get("status") || "Свободна"),
    comments: String(formData.get("comments") || ""),
    telegramGroupChatId: String(formData.get("telegramGroupChatId") || "").trim() || undefined,
  });
  revalidatePath("/machines");
}

export async function deleteMachineAction(id: string) {
  deleteMachine(id);
  revalidatePath("/machines");
}

export async function updateMachineTelegramGroupAction(id: string, formData: FormData) {
  const value = String(formData.get("telegramGroupChatId") || "").trim();
  updateMachine(id, { telegramGroupChatId: value || undefined });
  revalidatePath("/machines");
}
