"use server";

import { requireAdminPermission } from "@/lib/access-control";

import { createHash } from "node:crypto";
import { importAtmsFromExcel, ImportSummary } from "@/lib/excel-import";
import { revalidatePath } from "next/cache";

type ImportState =
  | { mode: "preview"; summary: ImportSummary; fileHash: string; fileName: string }
  | { mode: "complete"; summary: ImportSummary }
  | { error: string }
  | null;

export async function importExcelAction(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  requireAdminPermission("atms:write");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл .xlsx. Для подтверждения нужно повторно выбрать тот же файл." };
  }
  if (!/\.xlsx$/i.test(file.name)) return { error: "Поддерживается формат Excel .xlsx. Сохраните файл в этом формате и повторите попытку." };
  if (file.size > 20 * 1024 * 1024) return { error: "Размер файла не должен превышать 20 МБ." };

  try {
    const buffer = await file.arrayBuffer();
    const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    const confirm = formData.get("confirm") === "yes";
    const expectedHash = String(formData.get("expectedHash") || "");

    if (!confirm) {
      const summary = await importAtmsFromExcel(buffer, { previewOnly: true });
      return { mode: "preview", summary, fileHash, fileName: file.name };
    }

    if (!expectedHash || expectedHash !== fileHash) {
      return { error: "Файл отличается от проверенного. Сначала выполните предварительную проверку заново." };
    }

    const summary = await importAtmsFromExcel(buffer);
    revalidatePath("/atms");
    revalidatePath("/monitoring");
    return { mode: "complete", summary };
  } catch (e) {
    return { error: `Не удалось обработать файл: ${(e as Error).message}` };
  }
}
