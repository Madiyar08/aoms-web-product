import { findById, insertRow, readAll, updateRow, withTransaction } from "./db";
import { newId, nowIso } from "./entity";
import { getMachineById } from "./machines";
import { assertWarehouseArchiveAllowed, assertWarehouseIssueAllowed, calculateWarehouseBalance, validateWarehouseCrewAssignment, normalizeWarehouseUnit, validateWarehouseQuantity, type WarehouseMovementType } from "./warehouse-core";

const ITEMS = "warehouse_items";
const MOVEMENTS = "warehouse_movements";
export interface WarehouseItem { id: string; sku: string; name: string; unit: string; minimumStock: number; active: boolean; createdAt: string; updatedAt: string }
export interface WarehouseMovement { id: string; itemId: string; type: WarehouseMovementType; quantity: number; note: string; machineId?: string; actorId: string; actorLabel: string; createdAt: string }
export interface WarehouseItemSummary extends WarehouseItem { balance: number; lowStock: boolean }
export function listWarehouseItems(includeArchived = false): WarehouseItemSummary[] {
  const movements = readAll<WarehouseMovement>(MOVEMENTS);
  return readAll<WarehouseItem>(ITEMS).filter(item => includeArchived || item.active).map(item => {
    const balance = calculateWarehouseBalance(movements.filter(m => m.itemId === item.id));
    return { ...item, balance: Math.round(balance * 1000) / 1000, lowStock: balance <= item.minimumStock };
  }).sort((a,b) => a.name.localeCompare(b.name, "ru"));
}
export function listWarehouseMovements(limit = 100): WarehouseMovement[] {
  return readAll<WarehouseMovement>(MOVEMENTS).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, Math.max(1, Math.min(500, Math.floor(limit))));
}
export function createWarehouseItem(input: { sku: string; name: string; unit: string; minimumStock?: number }): WarehouseItem {
  const sku = input.sku.trim().toUpperCase(); const name = input.name.trim();
  if (!sku || sku.length > 40) throw new Error("Артикул обязателен и не должен превышать 40 символов");
  if (!name || name.length > 120) throw new Error("Название обязательно и не должно превышать 120 символов");
  if (readAll<WarehouseItem>(ITEMS).some(item => item.sku.toLowerCase() === sku.toLowerCase())) throw new Error("Такой артикул уже существует");
  const minimumStock = input.minimumStock === undefined ? 0 : Number(input.minimumStock);
  if (!Number.isFinite(minimumStock) || minimumStock < 0 || minimumStock > 1_000_000) throw new Error("Минимальный остаток должен быть от 0 до 1 000 000");
  const now = nowIso(); const item: WarehouseItem = { id: newId(), sku, name, unit: normalizeWarehouseUnit(input.unit), minimumStock, active: true, createdAt: now, updatedAt: now };
  insertRow(ITEMS, item); return item;
}
export function recordWarehouseMovement(input: { itemId: string; type: WarehouseMovementType; quantity: number; note?: string; machineId?: string; actorId: string; actorLabel: string }): WarehouseMovement {
  return withTransaction(() => {
    const item = findById<WarehouseItem>(ITEMS, input.itemId);
    if (!item || !item.active) throw new Error("Материал не найден или архивирован");
    const quantity = validateWarehouseQuantity(input.quantity);
    const existing = readAll<WarehouseMovement>(MOVEMENTS).filter(m => m.itemId === item.id);
    const balance = calculateWarehouseBalance(existing);
    if (input.type === "issue") assertWarehouseIssueAllowed(balance, quantity);
    if (input.type !== "receipt" && input.type !== "issue") throw new Error("Неизвестный тип складской операции");
    const machineId = String(input.machineId ?? "").trim();
    validateWarehouseCrewAssignment(input.type, machineId, Boolean(machineId && getMachineById(machineId)));
    const note = String(input.note ?? "").trim().slice(0, 500);
    if (input.type === "issue" && !note) throw new Error("Для расхода укажите основание");
    const movement: WarehouseMovement = { id: newId(), itemId: item.id, type: input.type, quantity, note, ...(machineId ? { machineId } : {}), actorId: input.actorId, actorLabel: input.actorLabel, createdAt: nowIso() };
    insertRow(MOVEMENTS, movement); return movement;
  });
}
export function archiveWarehouseItem(id: string): boolean {
  return withTransaction(() => {
    const item = findById<WarehouseItem>(ITEMS, id); if (!item || !item.active) return false;
    const balance = calculateWarehouseBalance(readAll<WarehouseMovement>(MOVEMENTS).filter(m => m.itemId === id));
    assertWarehouseArchiveAllowed(balance);
    // Soft archive: movement history remains intact; nonzero stock cannot be hidden.
    return updateRow<WarehouseItem>(ITEMS, id, { active: false, updatedAt: nowIso() });
  });
}
