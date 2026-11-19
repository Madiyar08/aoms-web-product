"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { createMachine, deleteMachine, updateMachine } from "@/lib/machines";
import { revalidatePath } from "next/cache";
import { appendAuditEvent } from "@/lib/audit-log";
import { currentAdminActor } from "@/lib/access-control";
import { withTransaction } from "@/lib/db";

export async function createMachineAction(formData: FormData) {
  requireAdminPermission("operations:write");
  const number = String(formData.get("number") || "").trim();
  if (!number) return;
  withTransaction(() => {
    const machine = createMachine({
    number,
    employee1Id: String(formData.get("employee1Id") || ""),
    employee2Id: String(formData.get("employee2Id") || ""),
    status: String(formData.get("status") || "Свободна"),
    comments: String(formData.get("comments") || ""),
    telegramGroupChatId: String(formData.get("telegramGroupChatId") || "").trim() || undefined,
    });
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "machine.created", entityType: "machine", entityId: machine.id, detailsJson: JSON.stringify({ number: machine.number }) });
  });
  revalidatePath("/machines");
}

export async function deleteMachineAction(id: string) {
  requireAdminPermission("operations:write");
  withTransaction(() => {
    const deleted = deleteMachine(id);
    const actor = currentAdminActor();
    if (deleted && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "machine.deleted", entityType: "machine", entityId: id, detailsJson: JSON.stringify({}) });
  });
  revalidatePath("/machines");
}

export async function updateMachineTelegramGroupAction(id: string, formData: FormData) {
  requireAdminPermission("operations:write");
  const value = String(formData.get("telegramGroupChatId") || "").trim();
  withTransaction(() => {
    const changed = updateMachine(id, { telegramGroupChatId: value || undefined });
    const actor = currentAdminActor();
    if (changed && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "machine.updated", entityType: "machine", entityId: id, detailsJson: JSON.stringify({ fields: ["telegramGroupChatId"], valueRecorded: false }) });
  });
  revalidatePath("/machines");
}
