import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoms-db-test-'));
process.env.AOMS_SQLITE_DB_PATH = path.join(tempDir, 'aoms-test.db');
// lib/db.ts uses a runtime require indirection for Next.js bundling; expose
// Node's equivalent in this ESM-only test process.
globalThis.require = createRequire(import.meta.url);
const db = await import('../lib/db.ts');

test('creates a JSON row table and reads inserted rows', () => {
  db.insertRow('test_records', { id: 'one', value: 'hello' });
  assert.deepEqual(db.findById('test_records', 'one'), { id: 'one', value: 'hello' });
  assert.deepEqual(db.readAll('test_records'), [{ id: 'one', value: 'hello' }]);
});

test('update merges a patch and delete reports whether a row existed', () => {
  assert.equal(db.updateRow('test_records', 'one', { value: 'updated' }), true);
  assert.deepEqual(db.findById('test_records', 'one'), { id: 'one', value: 'updated' });
  assert.equal(db.deleteRow('test_records', 'one'), true);
  assert.equal(db.deleteRow('test_records', 'one'), false);
});

test('outer transaction rolls back every write after an exception', () => {
  assert.throws(() => db.withTransaction(() => {
    db.insertRow('test_records', { id: 'rollback-a', value: 1 });
    db.insertRow('test_records', { id: 'rollback-b', value: 2 });
    throw new Error('abort');
  }), /abort/);
  assert.equal(db.findById('test_records', 'rollback-a'), null);
  assert.equal(db.findById('test_records', 'rollback-b'), null);
});

test('nested transaction rolls back to savepoint when its error is caught by outer work', () => {
  db.withTransaction(() => {
    db.insertRow('test_records', { id: 'outer-kept', value: 1 });
    assert.throws(() => db.withTransaction(() => {
      db.insertRow('test_records', { id: 'inner-rolled-back', value: 2 });
      throw new Error('inner abort');
    }), /inner abort/);
    db.insertRow('test_records', { id: 'outer-kept-2', value: 3 });
  });
  assert.ok(db.findById('test_records', 'outer-kept'));
  assert.equal(db.findById('test_records', 'inner-rolled-back'), null);
  assert.ok(db.findById('test_records', 'outer-kept-2'));
});

test('nested success is committed with the outer transaction', () => {
  db.withTransaction(() => {
    db.insertRow('test_records', { id: 'nested-a', value: 1 });
    db.withTransaction(() => db.insertRow('test_records', { id: 'nested-b', value: 2 }));
  });
  assert.ok(db.findById('test_records', 'nested-a'));
  assert.ok(db.findById('test_records', 'nested-b'));
});

test('rejects unsafe table identifiers before executing SQL', () => {
  for (const name of ['x"; DROP TABLE test_records;--', 'table name', '', '1table']) {
    assert.throws(() => db.readAll(name), /имя таблицы/);
  }
  assert.ok(db.findById('test_records', 'nested-a'));
});

test('malformed JSON fails with actionable table and record context', () => {
  const raw = new DatabaseSync(process.env.AOMS_SQLITE_DB_PATH);
  raw.prepare('UPDATE test_records SET data = ? WHERE id = ?').run('{broken', 'nested-a');
  raw.close();
  assert.throws(() => db.findById('test_records', 'nested-a'), /таблица test_records, запись nested-a/);
});

test('integrity diagnostics report SQLite quick_check and configured pragmas', () => {
  const result = db.checkDatabaseIntegrity();
  assert.equal(result.ok, true);
  assert.deepEqual(result.result, ['ok']);
  assert.equal(result.foreignKeys, 1);
  assert.equal(typeof result.journalMode, 'string');
});
