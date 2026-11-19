"use server";
import { revalidatePath } from "next/cache";
import { currentAdminActor, currentAdminRole, roleHasPermission } from "@/lib/access-control";
import { appendAuditEvent } from "@/lib/audit-log";
import { withTransaction } from "@/lib/db";
import { archiveWarehouseItem, createWarehouseItem, recordWarehouseMovement } from "@/lib/warehouse";
function requireWarehouseWrite() {
  const role = currentAdminRole();
  if (!role || !roleHasPermission(role, "warehouse:write")) throw new Error("Недостаточно прав для изменения склада");
  const actor = currentAdminActor(); if (!actor) throw new Error("Требуется авторизация");
  return actor;
}
export async function createWarehouseItemAction(formData: FormData) {
  const actor = requireWarehouseWrite();
  withTransaction(() => { const item = createWarehouseItem({ sku: String(formData.get("sku")||""), name: String(formData.get("name")||""), unit: String(formData.get("unit")||""), minimumStock: Number(formData.get("minimumStock")||0) }); appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "warehouse_item.created", entityType: "warehouse_item", entityId: item.id, detailsJson: JSON.stringify({ sku: item.sku, name: item.name }) }); });
  revalidatePath("/warehouse");
}
export async function recordWarehouseMovementAction(formData: FormData) {
  const actor = requireWarehouseWrite();
  withTransaction(() => { const movement = recordWarehouseMovement({ itemId: String(formData.get("itemId")||""), type: String(formData.get("type")||"") as "receipt"|"issue", quantity: Number(formData.get("quantity")), note: String(formData.get("note")||""), machineId: String(formData.get("machineId")||""), actorId: actor.actorId, actorLabel: actor.actorLabel }); appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: movement.type === "receipt" ? "warehouse.receipt" : "warehouse.issue", entityType: "warehouse_movement", entityId: movement.id, detailsJson: JSON.stringify({ itemId: movement.itemId, quantity: movement.quantity, machineId: movement.machineId || null, noteRecorded: Boolean(movement.note) }) }); });
  revalidatePath("/warehouse");
}
export async function archiveWarehouseItemAction(formData: FormData) {
  const actor = requireWarehouseWrite(); const id = String(formData.get("id")||"");
  withTransaction(() => { if (archiveWarehouseItem(id)) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "warehouse_item.archived", entityType: "warehouse_item", entityId: id, detailsJson: "{}" }); });
  revalidatePath("/warehouse");
}
