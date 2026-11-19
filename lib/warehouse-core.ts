export type WarehouseMovementType = "receipt" | "issue";
export interface WarehouseBalanceInput { type: WarehouseMovementType; quantity: number }
export function validateWarehouseQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error("Количество должно быть больше 0 и не превышать 1 000 000");
  const rounded = Math.round(quantity * 1000) / 1000;
  if (rounded <= 0) throw new Error("Количество после округления должно быть не меньше 0.001");
  return rounded;
}
export function calculateWarehouseBalance(movements: WarehouseBalanceInput[]): number {
  return movements.reduce((balance, movement) => {
    const quantity = validateWarehouseQuantity(movement.quantity);
    if (movement.type === "receipt") return balance + quantity;
    if (movement.type === "issue") return balance - quantity;
    throw new Error("Неизвестный тип складской операции");
  }, 0);
}
export function assertWarehouseIssueAllowed(currentBalance: number, quantity: number): void {
  const q = validateWarehouseQuantity(quantity);
  if (q > currentBalance + 1e-9) throw new Error("Недостаточно материала на складе");
}
export function normalizeWarehouseUnit(value: unknown): string {
  const unit = String(value ?? "").trim();
  if (!unit || unit.length > 20) throw new Error("Укажите единицу измерения (до 20 символов)");
  return unit;
}

/** An archived item must not conceal a positive stock balance. */
export function assertWarehouseArchiveAllowed(balance: number): void {
  if (!Number.isFinite(balance) || balance > 1e-9 || balance < -1e-9) {
    throw new Error("Нельзя архивировать материал с ненулевым остатком");
  }
}

/** Aggregation uses item IDs, not units: litres and pieces must never be summed. */
export function summarizeWarehouseIssuesByCrew(
  movements: Array<{ itemId: string; machineId?: string; type: WarehouseMovementType; quantity: number }>,
): Array<{ machineId: string; itemId: string; quantity: number; operations: number }> {
  const summary = new Map<string, { machineId: string; itemId: string; quantity: number; operations: number }>();
  for (const movement of movements) {
    if (movement.type !== "issue" || !movement.machineId) continue;
    const quantity = validateWarehouseQuantity(movement.quantity);
    const key = JSON.stringify([movement.machineId, movement.itemId]);
    const existing = summary.get(key);
    if (existing) {
      existing.quantity = Math.round((existing.quantity + quantity) * 1000) / 1000;
      existing.operations++;
    } else {
      summary.set(key, { machineId: movement.machineId, itemId: movement.itemId, quantity, operations: 1 });
    }
  }
  return [...summary.values()].sort((a, b) => a.machineId.localeCompare(b.machineId) || a.itemId.localeCompare(b.itemId));
}

/** Check crew attribution on the server; never trust a posted crew identifier. */
export function validateWarehouseCrewAssignment(type: WarehouseMovementType, machineId: string, exists: boolean): void {
  if (!machineId) return;
  if (type !== "issue") throw new Error("Экипаж можно указать только для выдачи материала");
  if (!exists) throw new Error("Выбранный экипаж не найден");
}
