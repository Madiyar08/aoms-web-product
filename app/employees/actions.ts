"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { createEmployee, deleteEmployee, updateEmployee } from "@/lib/employees";
import { revalidatePath } from "next/cache";
import { appendAuditEvent } from "@/lib/audit-log";
import { currentAdminActor } from "@/lib/access-control";
import { withTransaction } from "@/lib/db";

export async function createEmployeeAction(formData: FormData) {
  requireAdminPermission("users:manage");
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return;
  withTransaction(() => {
    const employee = createEmployee({
    fullName,
    phone: String(formData.get("phone") || ""),
    status: String(formData.get("status") || "Активен"),
    role: String(formData.get("role") || ""),
    comments: String(formData.get("comments") || ""),
    telegramChatId: String(formData.get("telegramChatId") || "").trim(),
    });
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "employee.created", entityType: "employee", entityId: employee.id, detailsJson: JSON.stringify({ role: employee.role, status: employee.status }) });
  });
  revalidatePath("/employees");
}

export async function setEmployeeRoleAction(employeeId: string, role: string) {
  requireAdminPermission("users:manage");
  withTransaction(() => {
    const changed = updateEmployee(employeeId, { role });
    const actor = currentAdminActor();
    if (changed && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "employee.updated", entityType: "employee", entityId: employeeId, detailsJson: JSON.stringify({ fields: ["role"] }) });
  });
  revalidatePath("/employees");
}

export async function setTelegramChatIdAction(employeeId: string, chatId: string) {
  requireAdminPermission("users:manage");
  withTransaction(() => {
    const changed = updateEmployee(employeeId, { telegramChatId: chatId.trim() });
    const actor = currentAdminActor();
    if (changed && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "employee.updated", entityType: "employee", entityId: employeeId, detailsJson: JSON.stringify({ fields: ["telegramChatId"], valueRecorded: false }) });
  });
  revalidatePath("/employees");
}

export async function deleteEmployeeAction(id: string) {
  requireAdminPermission("users:manage");
  withTransaction(() => {
    const deleted = deleteEmployee(id);
    const actor = currentAdminActor();
    if (deleted && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "employee.deleted", entityType: "employee", entityId: id, detailsJson: JSON.stringify({}) });
  });
  revalidatePath("/employees");
}
