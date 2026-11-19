import { findById, insertRow, readAll, updateRow, withTransaction } from "./db";
import { newId, nowIso } from "./entity";
import type { AomsRole } from "./access-control-core";
import { hashAdminPassword, normalizeUsername, verifyAdminPassword } from "./admin-auth-core";
export { hashAdminPassword, normalizeUsername, verifyAdminPassword } from "./admin-auth-core";
const TABLE = "admin_users";
export interface AdminUser {
  id: string; username: string; displayName: string; role: AomsRole;
  passwordHash: string; active: boolean; createdAt: string; updatedAt: string;
}
export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export { isAomsRole } from "./access-control-core";
import { isAomsRole } from "./access-control-core";
export function listAdminUsers(): PublicAdminUser[] {
  return readAll<AdminUser>(TABLE).map(({ passwordHash: _secret, ...user }) => user).sort((a,b) => a.username.localeCompare(b.username));
}
export function findAdminUserByUsername(username: string): AdminUser | null {
  const normalized = normalizeUsername(username);
  return readAll<AdminUser>(TABLE).find(user => user.username === normalized) || null;
}
export function findAdminUserById(id: string): AdminUser | null { return findById<AdminUser>(TABLE, id); }
export async function createAdminUser(input: { username: string; displayName: string; role: AomsRole; password: string }): Promise<PublicAdminUser> {
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("Логин: 3–40 символов, латиница, цифры, точка, дефис или подчёркивание");
  if (!input.displayName.trim() || input.displayName.trim().length > 80) throw new Error("Укажите имя длиной до 80 символов");
  if (!isAomsRole(input.role)) throw new Error("Недопустимая роль");
  if (findAdminUserByUsername(username)) throw new Error("Пользователь с таким логином уже существует");
  const passwordHash = await hashAdminPassword(input.password);
  const user: AdminUser = withTransaction(() => {
    if (findAdminUserByUsername(username)) throw new Error("Пользователь с таким логином уже существует");
    const now = nowIso();
    const row: AdminUser = { id: newId(), username, displayName: input.displayName.trim(), role: input.role, passwordHash, active: true, createdAt: now, updatedAt: now };
    insertRow(TABLE, row); return row;
  });
  const { passwordHash: _secret, ...publicUser } = user;
  return publicUser;
}
export async function ensureBootstrapAdmin(): Promise<void> {
  if (readAll<AdminUser>(TABLE).length) return;
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) return;
  const username = normalizeUsername(process.env.ADMIN_USERNAME || "admin");
  const now = nowIso();
  const passwordHash = await hashAdminPassword(password);
  withTransaction(() => {
    if (readAll<AdminUser>(TABLE).length) return;
    const user: AdminUser = { id: "bootstrap-super-admin", username, displayName: "Главный администратор", role: "super_admin", passwordHash, active: true, createdAt: now, updatedAt: now };
    insertRow(TABLE, user);
  });
}
export async function authenticateAdminUser(username: string, password: string): Promise<AdminUser | null> {
  const user = findAdminUserByUsername(username);
  if (!user || !user.active) return null;
  return await verifyAdminPassword(password, user.passwordHash) ? user : null;
}
export function updateAdminUser(id: string, patch: Partial<Pick<AdminUser, "displayName" | "role" | "active">>): boolean {
  return withTransaction(() => {
  const existing = findAdminUserById(id);
  if (!existing) return false;
  if (patch.role !== undefined && !isAomsRole(patch.role)) throw new Error("Недопустимая роль");
  if (patch.displayName !== undefined && (!patch.displayName.trim() || patch.displayName.trim().length > 80)) throw new Error("Некорректное имя");
  if (existing.role === "super_admin" && existing.active && (patch.active === false || (patch.role && patch.role !== "super_admin"))) {
    const activeAdmins = readAll<AdminUser>(TABLE).filter(u => u.active && u.role === "super_admin");
    if (activeAdmins.length <= 1) throw new Error("Нельзя отключить или понизить последнего активного Super Admin");
  }
  return updateRow<AdminUser>(TABLE, id, { ...patch, updatedAt: nowIso() });
  });
}
export async function resetAdminPassword(id: string, password: string): Promise<boolean> {
  const user = findAdminUserById(id);
  if (!user) return false;
  const passwordHash = await hashAdminPassword(password);
  return withTransaction(() => updateRow<AdminUser>(TABLE, id, { passwordHash, updatedAt: nowIso() }));
}
