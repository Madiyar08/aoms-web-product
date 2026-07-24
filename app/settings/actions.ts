"use server";

import { createSetting, getSettingByKey, updateSettingValue } from "@/lib/settings";
import { revalidatePath } from "next/cache";

export async function updateSettingAction(id: string, value: string) {
  updateSettingValue(id, value);
  revalidatePath("/settings");
}

export async function createSettingAction(formData: FormData) {
  const key = String(formData.get("key") || "").trim();
  if (!key) return;
  if (getSettingByKey(key)) return;

  createSetting({
    key,
    value: String(formData.get("value") || ""),
    category: String(formData.get("category") || "Общие").trim() || "Общие",
    description: String(formData.get("description") || ""),
    valueType: String(formData.get("valueType") || "string"),
  });
  revalidatePath("/settings");
}
