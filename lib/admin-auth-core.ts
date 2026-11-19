import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export function normalizeUsername(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, ""); }
export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Пароль должен содержать не менее 12 символов");
  const salt = randomBytes(16).toString("hex"); const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}
export async function verifyAdminPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, salt, hash] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const derived = await scrypt(password, salt, 64) as Buffer; const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
