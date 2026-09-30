"use server";

import { createAtm, deleteAtm, deleteAllAtms, findAtmByCode, updateAtm, getAtmById } from "@/lib/atms";
import { listCategories } from "@/lib/categories";
import { listStatuses } from "@/lib/statuses";
import { rebuildRoutesContainingAtm } from "@/lib/routes";
import { revalidatePath } from "next/cache";

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
  const statuses = listStatuses();
  const categoryExcluded = categories.find((c) => c.id === atm.categoryId)?.excludedFromRouting;
  const statusExcluded = statuses.find((s) => s.id === atm.workStatusId)?.includeInRouting === false;
  if (categoryExcluded || statusExcluded) {
    await rebuildRoutesContainingAtm(atmId).catch(() => {});
  }
}

export async function deleteAllAtmsAction() {
  const count = deleteAllAtms();
  revalidatePath("/atms");
  revalidatePath("/");
  return count;
}

export async function createAtmAction(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  if (code && findAtmByCode(code)) return;

  createAtm({
    code,
    name,
    address: String(formData.get("address") || ""),
    district: String(formData.get("district") || ""),
    latitude: String(formData.get("latitude") || ""),
    longitude: String(formData.get("longitude") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    workStatusId: String(formData.get("workStatusId") || ""),
    addressVerified: formData.get("addressVerified") === "on",
    coordsVerified: formData.get("coordsVerified") === "on",
    comments: String(formData.get("comments") || ""),
    source: "Ручной ввод",
  });
  revalidatePath("/atms");
}

export async function updateAtmAction(id: string, formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  if (code) {
    const existing = findAtmByCode(code);
    if (existing && existing.id !== id) return; // ID занят другим банкоматом
  }

  updateAtm(id, {
    code,
    name,
    address: String(formData.get("address") || ""),
    district: String(formData.get("district") || ""),
    latitude: String(formData.get("latitude") || ""),
    longitude: String(formData.get("longitude") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    workStatusId: String(formData.get("workStatusId") || ""),
    addressVerified: formData.get("addressVerified") === "on",
    coordsVerified: formData.get("coordsVerified") === "on",
    comments: String(formData.get("comments") || ""),
  });
  await rebuildIfNowExcluded(id);
  revalidatePath("/atms");
  revalidatePath(`/atms/${id}`);
}

export async function deleteAtmAction(id: string) {
  deleteAtm(id);
  revalidatePath("/atms");
}

/**
 * Массовое назначение категории и/или статуса выбранным банкоматам.
 * Пустая строка = "не менять это поле" — так можно поменять только
 * категорию, не трогая статус, и наоборот.
 */
export async function bulkAssignAction(ids: string[], categoryId: string, workStatusId: string) {
  const patch: { categoryId?: string; workStatusId?: string } = {};
  if (categoryId) patch.categoryId = categoryId;
  if (workStatusId) patch.workStatusId = workStatusId;
  if (Object.keys(patch).length === 0) return;

  for (const id of ids) {
    updateAtm(id, patch);
    await rebuildIfNowExcluded(id);
  }
  revalidatePath("/atms");
}
