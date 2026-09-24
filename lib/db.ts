/**
 * Низкоуровневый доступ к SQLite — прямой аналог IStorageAdapter из
 * Python-версии. Строка любой таблицы хранится как id + JSON-блок,
 * что позволяет добавлять поля в модели без миграций на этом этапе MVP.
 *
 * Используется node:sqlite — экспериментальный, но встроенный в Node.js
 * модуль (доступен с Node 22.5+). Выбран специально: он не требует
 * скачивания нативных бинарников с внешних серверов (в отличие от
 * Prisma/better-sqlite3), что делает сборку воспроизводимой в любой
 * песочнице или CI без доступа к сторонним доменам.
 *
 * Если понадобится перейти на PostgreSQL — меняется только этот файл
 * (и его публичный контракт: readAll/findById/insertRow/updateRow/
 * deleteRow), весь остальной код (lib/*.ts, app/**) не заметит разницы.
 */

import fs from "node:fs";
import path from "node:path";

export const DB_PATH = process.env.AOMS_SQLITE_DB_PATH || path.join(process.cwd(), "data", "aoms.db");
/** Папка, где лежит файл БД — используем и для хранения фото, чтобы не
 * заводить отдельный Volume: одна и та же смонтированная папка. */
export const DB_DIR = path.dirname(DB_PATH);

// Минимальный тип вместо импорта из "node:sqlite" — чтобы вообще нигде
// в файле не было ссылки на этот модуль, которую webpack мог бы
// проанализировать и вкомпилировать в бандл.
interface DbLike {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): { changes: number };
  };
}

const globalForDb = globalThis as unknown as { __aomsDb?: DbLike };

function ensureDir(): void {
  const dir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Проверяем именно ЗАПИСЬ, а не только существование — на смонтированном
    // Volume папка обычно уже существует, но процесс может не иметь права
    // писать в неё (частая причина падения сразу после подключения Volume
    // на Railway/аналогах). fs.accessW бросит понятную ошибку заранее,
    // а не даст SQLite упасть с непрозрачным низкоуровневым сообщением.
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.error(
      `[db] Нет доступа на запись в директорию базы данных "${dir}" (AOMS_SQLITE_DB_PATH="${DB_PATH}"). ` +
        `Код ошибки: ${err.code || "?"}. Если это Volume в Railway — проверьте: 1) Mount Path совпадает с этой ` +
        `папкой, 2) у процесса есть права на запись (владелец/группа volume). Полная ошибка ниже:`,
      err
    );
    throw err;
  }
}

function getDb(): DbLike {
  if (!globalForDb.__aomsDb) {
    ensureDir();
    // Грузим node:sqlite через непрозрачный для сборщика require: webpack
    // статически анализирует обычный require("node:sqlite") и вкомпилирует
    // его в бандл страницы, из-за чего `next build` ("Collecting page
    // data") пытается выполнить модуль и падает с ERR_UNKNOWN_BUILTIN_MODULE
    // на версиях Node, где node:sqlite требует флага --experimental-sqlite.
    // Вызов через переменную сборщик проанализировать не может, поэтому
    // require срабатывает только в рантайме Node (где модуль доступен).
    const nodeRequire = eval("require") as NodeRequire;
    const mod = nodeRequire("node:sqlite") as { DatabaseSync: new (p: string) => DbLike };
    try {
      globalForDb.__aomsDb = new mod.DatabaseSync(DB_PATH);
    } catch (e) {
      console.error(
        `[db] Не удалось открыть/создать файл базы данных "${DB_PATH}". Если путь указывает на смонтированный ` +
          `Volume — почти всегда это права доступа или то, что Mount Path в настройках Volume не совпадает с ` +
          `папкой в AOMS_SQLITE_DB_PATH. Полная ошибка ниже:`,
        e
      );
      throw e;
    }
  }
  return globalForDb.__aomsDb;
}

function ensureTable(table: string): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS "${table}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
}

export function readAll<T>(table: string): T[] {
  ensureTable(table);
  const rows = getDb().prepare(`SELECT data FROM "${table}"`).all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

export function findById<T>(table: string, id: string | undefined | null): T | null {
  // node:sqlite выбрасывает исключение, если параметру запроса передать
  // undefined/null (а не просто не находит строку) — из-за этого один
  // такой вызов превращался в необработанное исключение и HTTP 500 у
  // вызывающей стороны (например, в /api/miniapp/submit-cleaning для
  // отчётов без ID банкомата). Явно отсекаем это здесь, на входе.
  if (!id) return null;
  ensureTable(table);
  const row = getDb()
    .prepare(`SELECT data FROM "${table}" WHERE id = ?`)
    .get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : null;
}

export function insertRow<T extends { id: string }>(table: string, row: T): void {
  ensureTable(table);
  getDb()
    .prepare(`INSERT INTO "${table}" (id, data) VALUES (?, ?)`)
    .run(row.id, JSON.stringify(row));
}

export function updateRow<T extends { id: string }>(
  table: string,
  id: string,
  patch: Partial<T>
): boolean {
  ensureTable(table);
  const existing = findById<T>(table, id);
  if (!existing) return false;
  const merged = { ...existing, ...patch };
  getDb().prepare(`UPDATE "${table}" SET data = ? WHERE id = ?`).run(JSON.stringify(merged), id);
  return true;
}

export function deleteRow(table: string, id: string): boolean {
  ensureTable(table);
  const result = getDb().prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
  return result.changes > 0;
}
