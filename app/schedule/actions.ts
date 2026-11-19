"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { createScheduleEntry, deleteScheduleEntry } from "@/lib/schedule";
import { revalidatePath } from "next/cache";
import { appendAuditEvent } from "@/lib/audit-log";
import { currentAdminActor } from "@/lib/access-control";
import { withTransaction } from "@/lib/db";

export async function createScheduleAction(formData: FormData) {
  requireAdminPermission("schedule:write");
  const date = String(formData.get("date") || "");
  const machineId = String(formData.get("machineId") || "");
  const districts = formData.getAll("districts").map(String).filter(Boolean);
  const kpiTarget = parseInt(String(formData.get("kpiTarget") || "0"), 10) || 0;
  if (!date || !machineId || districts.length === 0) return;

  withTransaction(() => {
    const entry = createScheduleEntry({
    date,
    machineId,
    districts,
    kpiTarget,
    comments: String(formData.get("comments") || ""),
    });
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "schedule.created", entityType: "schedule", entityId: entry.id, detailsJson: JSON.stringify({ date, machineId, districts, kpiTarget }) });
  });
  revalidatePath("/schedule");
}

export async function deleteScheduleAction(id: string) {
  requireAdminPermission("schedule:write");
  withTransaction(() => {
    const actor = currentAdminActor();
    const deleted = deleteScheduleEntry(id);
    if (deleted && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "schedule.deleted", entityType: "schedule", entityId: id, detailsJson: JSON.stringify({}) });
  });
  revalidatePath("/schedule");
}

export async function createRecurringScheduleAction(formData: FormData) {
  requireAdminPermission("schedule:write");
  const { createRecurringSchedule } = await import("@/lib/recurring-schedule");
  const machineId = String(formData.get("machineId") || "");
  const districts = formData.getAll("districts").map(String).filter(Boolean);
  const kpiTarget = parseInt(String(formData.get("kpiTarget") || "0"), 10) || 0;
  const daysOfWeek = formData.getAll("daysOfWeek").map((d) => parseInt(String(d), 10));
  if (!machineId || districts.length === 0 || daysOfWeek.length === 0) return;

  withTransaction(() => {
    const recurring = createRecurringSchedule({
    machineId,
    daysOfWeek,
    districts,
    kpiTarget,
    comments: String(formData.get("comments") || ""),
    active: true,
    });
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "recurring_schedule.created", entityType: "recurring_schedule", entityId: recurring.id, detailsJson: JSON.stringify({ machineId, daysOfWeek, districts, kpiTarget }) });
  });
  revalidatePath("/schedule");
}

export async function toggleRecurringScheduleAction(id: string, active: boolean) {
  requireAdminPermission("schedule:write");
  const { updateRecurringSchedule } = await import("@/lib/recurring-schedule");
  withTransaction(() => {
    const changed = updateRecurringSchedule(id, { active });
    const actor = currentAdminActor();
    if (changed && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "recurring_schedule.updated", entityType: "recurring_schedule", entityId: id, detailsJson: JSON.stringify({ fields: ["active"], active }) });
  });
  revalidatePath("/schedule");
}

export async function deleteRecurringScheduleAction(id: string) {
  requireAdminPermission("schedule:write");
  const { deleteRecurringSchedule } = await import("@/lib/recurring-schedule");
  withTransaction(() => {
    const deleted = deleteRecurringSchedule(id);
    const actor = currentAdminActor();
    if (deleted && actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "recurring_schedule.deleted", entityType: "recurring_schedule", entityId: id, detailsJson: JSON.stringify({}) });
  });
  revalidatePath("/schedule");
}
