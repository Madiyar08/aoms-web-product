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
  // Банкомат физически переехал (миграция), но новое местоположение пока
  // неизвестно — сотрудники сообщают об этом (не могут найти по старым
  // координатам), а точных новых координат ещё нет. Ставите эту
  // категорию — банкомат сразу выпадает из маршрута (тем же механизмом,
  // что и "Внутри здания"), не будет зря отправлять экипаж по старому
  // адресу. Когда узнаете новые координаты — смените категорию обратно
  // и обновите координаты.
  { name: "Местоположение неизвестно (переехал)", description: "", excludedFromRouting: true },
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
