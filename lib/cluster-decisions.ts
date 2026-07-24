import { deleteRow, findById, insertRow, readAll, updateRow } from "./db";
import { BaseEntity, newId, nowIso } from "./entity";

const TABLE = "cluster_decisions";

export interface ClusterDecision extends BaseEntity {
  signature: string; // clusterSignature(atmIds) — стабильный ключ группы
  atmIds: string[];
  decision: string; // "merged" | "rejected"
  note: string;
}

export function listClusterDecisions(): ClusterDecision[] {
  return readAll<ClusterDecision>(TABLE);
}

export function getDecisionBySignature(signature: string): ClusterDecision | null {
  return listClusterDecisions().find((d) => d.signature === signature) ?? null;
}

export function saveDecision(signature: string, atmIds: string[], decision: string, note: string): ClusterDecision {
  const existing = getDecisionBySignature(signature);
  if (existing) {
    updateRow<ClusterDecision>(TABLE, existing.id, { decision, note, updatedAt: nowIso() });
    return { ...existing, decision, note };
  }
  const row: ClusterDecision = {
    id: newId(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    signature,
    atmIds,
    decision,
    note,
  };
  insertRow(TABLE, row);
  return row;
}

export function deleteDecision(id: string): boolean {
  return deleteRow(TABLE, id);
}
