import { insertRow, readAll } from "./db";
import { newId, nowIso } from "./entity";

const TABLE = "audit_log";
import type { AuditAction, AuditEntityType } from "./audit-log-catalog";
export { AUDIT_ACTIONS } from "./audit-log-catalog";

export interface AuditEvent {
  id: string;
  createdAt: string;
  actorId: string;
  actorLabel: string;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  detailsJson: string;
}

/** Append-only by design: this module exposes no update/delete operation. */
export function appendAuditEvent(input: Omit<AuditEvent, "id" | "createdAt">): AuditEvent {
  const event: AuditEvent = { id: newId(), createdAt: nowIso(), ...input };
  insertRow(TABLE, event);
  return event;
}

export function listAuditEvents(limit = 200): AuditEvent[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return readAll<AuditEvent>(TABLE)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}


/** Returns immutable audit events for one entity, newest first. */
export function listAuditEventsForEntity(entityType: AuditEvent["entityType"], entityId: string, limit = 100): AuditEvent[] {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return readAll<AuditEvent>(TABLE)
    .filter((event) => event.entityType === entityType && event.entityId === entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}
