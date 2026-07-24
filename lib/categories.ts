import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "atm_categories";

export interface AtmCategory extends BaseEntity {
  name: string;
  description: string;
  excludedFromRouting: boolean;
}

const DEFAULT_CATEGORIES: Array<Omit<AtmCategory, keyof BaseEntity>> = [
  { name: "Обычный", description: "", excludedFromRouting: false },
  { name: "При филиале", description: "", excludedFromRouting: false },
  { name: "Внутри здания", description: "", excludedFromRouting: true },
  { name: "Smart ATM", description: "", excludedFromRouting: false },
  { name: "Горячая точка", description: "", excludedFromRouting: false },
];

export function listCategories(): AtmCategory[] {
  return readAll<AtmCategory>(TABLE);
}

export function getCategoryById(id: string): AtmCategory | null {
  return findById<AtmCategory>(TABLE, id);
}

export function createCategory(data: Omit<AtmCategory, keyof BaseEntity>): AtmCategory {
  const row: AtmCategory = { id: newId(), createdAt: nowIso(), updatedAt: nowIso(), ...data };
  insertRow(TABLE, row);
  return row;
}

export function updateCategory(id: string, patch: Partial<Omit<AtmCategory, keyof BaseEntity>>): boolean {
  return updateRow<AtmCategory>(TABLE, id, { ...patch, updatedAt: nowIso() });
}

export function deleteCategory(id: string): boolean {
  return deleteRow(TABLE, id);
}

export function ensureDefaultCategories(): void {
  const existingNames = new Set(listCategories().map((c) => c.name));
  for (const category of DEFAULT_CATEGORIES) {
    if (!existingNames.has(category.name)) {
      createCategory(category);
    }
  }
}
