"use server";

import { createEmployee, deleteEmployee, updateEmployee } from "@/lib/employees";
import { revalidatePath } from "next/cache";

export async function createEmployeeAction(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return;
  createEmployee({
    fullName,
    phone: String(formData.get("phone") || ""),
    status: String(formData.get("status") || "Активен"),
    role: String(formData.get("role") || ""),
    comments: String(formData.get("comments") || ""),
    telegramChatId: String(formData.get("telegramChatId") || "").trim(),
  });
  revalidatePath("/employees");
}

export async function setEmployeeRoleAction(employeeId: string, role: string) {
  updateEmployee(employeeId, { role });
  revalidatePath("/employees");
}

export async function setTelegramChatIdAction(employeeId: string, chatId: string) {
  updateEmployee(employeeId, { telegramChatId: chatId.trim() });
  revalidatePath("/employees");
}

export async function deleteEmployeeAction(id: string) {
  deleteEmployee(id);
  revalidatePath("/employees");
}
