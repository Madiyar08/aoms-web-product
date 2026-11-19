export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
