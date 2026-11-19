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

/** Table names are internal identifiers, never user-provided SQL fragments. */
function assertTableName(table: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(table)) {
    throw new Error("Недопустимое имя таблицы SQLite.");
  }
  return table;
}

function parseRow<T>(table: string, id: string | undefined, data: string): T {
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    const context = id ? `таблица ${table}, запись ${id}` : `таблица ${table}`;
    console.error(`[db] Повреждён JSON в ${context}`, error);
    throw new Error(`Не удалось прочитать данные SQLite (${context}). Проверьте целостность базы и резервную копию.`);
  }
}

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
      const db = new mod.DatabaseSync(DB_PATH);
      // Wait briefly for another application process holding a write lock.
      // Keep the existing journal mode: changing it on a mounted production
      // volume requires a separately planned backup/restore exercise.
      db.exec("PRAGMA busy_timeout = 5000;");
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec("PRAGMA synchronous = FULL;");
      globalForDb.__aomsDb = db;
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
  const safeTable = assertTableName(table);
  getDb().exec(`CREATE TABLE IF NOT EXISTS "${safeTable}" (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
}

export function readAll<T>(table: string): T[] {
  ensureTable(table);
  const safeTable = assertTableName(table);
  const rows = getDb().prepare(`SELECT id, data FROM "${safeTable}"`).all() as { id: string; data: string }[];
  return rows.map((r) => parseRow<T>(safeTable, r.id, r.data));
}

export function findById<T>(table: string, id: string | undefined | null): T | null {
  // node:sqlite выбрасывает исключение, если параметру запроса передать
  // undefined/null (а не просто не находит строку) — из-за этого один
  // такой вызов превращался в необработанное исключение и HTTP 500 у
  // вызывающей стороны (например, в /api/miniapp/submit-cleaning для
  // отчётов без ID банкомата). Явно отсекаем это здесь, на входе.
  if (!id) return null;
  ensureTable(table);
  const safeTable = assertTableName(table);
  const row = getDb()
    .prepare(`SELECT id, data FROM "${safeTable}" WHERE id = ?`)
    .get(id) as { id: string; data: string } | undefined;
  return row ? parseRow<T>(safeTable, row.id, row.data) : null;
}

export function insertRow<T extends { id: string }>(table: string, row: T): void {
  ensureTable(table);
  const safeTable = assertTableName(table);
  getDb()
    .prepare(`INSERT INTO "${safeTable}" (id, data) VALUES (?, ?)`)
    .run(row.id, JSON.stringify(row));
}

export function updateRow<T extends { id: string }>(
  table: string,
  id: string,
  patch: Partial<T>
): boolean {
  ensureTable(table);
  const safeTable = assertTableName(table);
  const existing = findById<T>(safeTable, id);
  if (!existing) return false;
  const merged = { ...existing, ...patch };
  getDb().prepare(`UPDATE "${safeTable}" SET data = ? WHERE id = ?`).run(JSON.stringify(merged), id);
  return true;
}

export function deleteRow(table: string, id: string): boolean {
  ensureTable(table);
  const safeTable = assertTableName(table);
  const result = getDb().prepare(`DELETE FROM "${safeTable}" WHERE id = ?`).run(id);
  return result.changes > 0;
}

/** Execute synchronous SQLite writes atomically. Nested calls use SAVEPOINTs,
 * so a caught inner failure cannot silently retain half of its writes. */
let transactionDepth = 0;
let savepointSequence = 0;
export function withTransaction<T>(work: () => T): T {
  const db = getDb();
  const isOuter = transactionDepth === 0;
  const savepoint = `aoms_nested_${++savepointSequence}`;
  if (isOuter) db.exec("BEGIN IMMEDIATE");
  else db.exec(`SAVEPOINT ${savepoint}`);
  transactionDepth += 1;

  try {
    const result = work();
    if (isOuter) db.exec("COMMIT");
    else db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    try {
      if (isOuter) db.exec("ROLLBACK");
      else {
        db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      }
    } catch (rollbackError) {
      console.error("[db] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    transactionDepth -= 1;
  }
}

/** Lightweight, read-only diagnostics suitable for an admin health check. */
export function checkDatabaseIntegrity(): { ok: boolean; result: string[]; journalMode: string; foreignKeys: number } {
  const db = getDb();
  const integrityRows = db.prepare("PRAGMA quick_check").all() as { quick_check?: string }[];
  const result = integrityRows.map((row) => String(row.quick_check || "unknown"));
  const journal = db.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
  const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys?: number } | undefined;
  return {
    ok: result.length > 0 && result.every((entry) => entry === "ok"),
    result,
    journalMode: String(journal?.journal_mode || "unknown"),
    foreignKeys: Number(foreignKeys?.foreign_keys ?? 0),
  };
}
