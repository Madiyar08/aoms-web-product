"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { createAtm, deleteAtm, deleteAllAtms, findAtmByCode, updateAtm, getAtmById } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { createStatusExclusionChecker } from "@/lib/routing-rules";
import { rebuildRoutesContainingAtm } from "@/lib/routes";
import { revalidatePath } from "next/cache";
import { resolveRegionName, regionIdForName } from "@/lib/geography";
import { appendAuditEvent } from "@/lib/audit-log";
import { currentAdminActor } from "@/lib/access-control";
import { withTransaction } from "@/lib/db";

/**
 * После смены категории/статуса банкомата — если новое значение теперь
 * исключает его из маршрута ("Внутри здания", "Проблемный" и т.п.),
 * перестраивает все уже построенные маршруты на сегодня/будущее, где
 * этот банкомат есть. Без этого список у сотрудника оставался бы
 * устаревшим до ручного визита руководителя на страницу "Маршруты".
 */
async function rebuildIfNowExcluded(atmId: string) {
  const atm = getAtmById(atmId);
  if (!atm) return;
  const categories = listCategories();
  const categoryExcluded = categories.find((c) => c.id === atm.categoryId)?.excludedFromRouting;
  const statusExcluded = !!createStatusExclusionChecker()(atm);
  if (categoryExcluded || statusExcluded) {
    await rebuildRoutesContainingAtm(atmId).catch(() => {});
  }
}

export async function deleteAllAtmsAction() {
  requireAdminPermission("atms:write");
  const count = withTransaction(() => {
    const deleted = deleteAllAtms();
    const actor = currentAdminActor();
    if (actor && deleted > 0) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "atm.bulk_deleted", entityType: "atm", entityId: "all", detailsJson: JSON.stringify({ count: deleted }) });
    return deleted;
  });
  revalidatePath("/atms");
  revalidatePath("/");
  return count;
}

export async function createAtmAction(formData: FormData) {
  requireAdminPermission("atms:write");
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  if (code && findAtmByCode(code)) return;

  withTransaction(() => {
    const atm = createAtm({
    code,
    name,
    address: String(formData.get("address") || ""),
    district: String(formData.get("district") || ""),
    region: resolveRegionName(String(formData.get("region") || "")),
    regionId: regionIdForName(String(formData.get("region") || "")),
    latitude: String(formData.get("latitude") || ""),
    longitude: String(formData.get("longitude") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    workStatusId: String(formData.get("workStatusId") || ""),
    addressVerified: formData.get("addressVerified") === "on",
    coordsVerified: formData.get("coordsVerified") === "on",
    comments: String(formData.get("comments") || ""),
    source: "Ручной ввод",
    });
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "atm.created", entityType: "atm", entityId: atm.id, detailsJson: JSON.stringify({ code: atm.code, fields: ["code", "name", "address", "district", "region", "coordinates", "categoryId", "workStatusId"] }) });
    return atm;
  });
  revalidatePath("/atms");
}

export async function updateAtmAction(id: string, formData: FormData) {
  requireAdminPermission("atms:write");
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  if (code) {
    const existing = findAtmByCode(code);
    if (existing && existing.id !== id) return; // ID занят другим банкоматом
  }

  const patch = {
    code,
    name,
    address: String(formData.get("address") || ""),
    district: String(formData.get("district") || ""),
    region: resolveRegionName(String(formData.get("region") || "")),
    regionId: regionIdForName(String(formData.get("region") || "")),
    latitude: String(formData.get("latitude") || ""),
    longitude: String(formData.get("longitude") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    workStatusId: String(formData.get("workStatusId") || ""),
    addressVerified: formData.get("addressVerified") === "on",
    coordsVerified: formData.get("coordsVerified") === "on",
    comments: String(formData.get("comments") || ""),
  };
  const updated = withTransaction(() => {
    const before = getAtmById(id);
    const ok = updateAtm(id, patch);
    const changedFields = before ? Object.keys(patch).filter((key) => String((before as any)[key] ?? "") !== String((patch as any)[key] ?? "")) : [];
    const actor = currentAdminActor();
    if (ok && actor && changedFields.length) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "atm.updated", entityType: "atm", entityId: id, detailsJson: JSON.stringify({ code, changedFields }) });
    return ok;
  });
  if (!updated) return;
  await rebuildIfNowExcluded(id);
  revalidatePath("/atms");
  revalidatePath(`/atms/${id}`);
}

export async function deleteAtmAction(id: string) {
  requireAdminPermission("atms:write");
  withTransaction(() => {
    const existed = getAtmById(id);
    if (!existed) return;
    deleteAtm(id);
    const actor = currentAdminActor();
    if (actor) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "atm.deleted", entityType: "atm", entityId: id, detailsJson: JSON.stringify({ code: existed.code }) });
  });
  revalidatePath("/atms");
}

/**
 * Массовое назначение категории и/или статуса выбранным банкоматам.
 * Пустая строка = "не менять это поле" — так можно поменять только
 * категорию, не трогая статус, и наоборот.
 */
export async function bulkAssignAction(ids: string[], categoryId: string, workStatusId: string) {
  requireAdminPermission("atms:write");
  const patch: { categoryId?: string; workStatusId?: string } = {};
  if (categoryId) patch.categoryId = categoryId;
  if (workStatusId) patch.workStatusId = workStatusId;
  if (Object.keys(patch).length === 0) return;

  const changedIds = withTransaction(() => {
    const changed: string[] = [];
    for (const id of ids) if (updateAtm(id, patch)) changed.push(id);
    const actor = currentAdminActor();
    if (actor && changed.length) appendAuditEvent({ actorId: actor.actorId, actorLabel: actor.actorLabel, actorRole: actor.role, action: "atm.bulk_updated", entityType: "atm", entityId: "bulk", detailsJson: JSON.stringify({ count: changed.length, fields: Object.keys(patch) }) });
    return changed;
  });
  for (const id of changedIds) await rebuildIfNowExcluded(id);
  revalidatePath("/atms");
}
