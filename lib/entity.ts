import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
