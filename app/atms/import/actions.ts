"use server";

import { importAtmsFromExcel, ImportSummary } from "@/lib/excel-import";
import { revalidatePath } from "next/cache";

type ImportState = ImportSummary | { error: string } | null;

export async function importExcelAction(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл .xlsx" };
  }

  const buffer = await file.arrayBuffer();
  try {
    const summary = await importAtmsFromExcel(buffer);
    revalidatePath("/atms");
    return summary;
  } catch (e) {
    return { error: `Не удалось прочитать файл: ${(e as Error).message}` };
  }
}
