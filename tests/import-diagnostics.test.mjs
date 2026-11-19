import test from 'node:test';
import assert from 'node:assert/strict';
import { appendImportIssue, importIssueSummary, IMPORT_ISSUE_LIMIT } from '../lib/import-diagnostics.ts';

const issue = (severity = 'warning', rowNumber = 2) => ({
  rowNumber, code: 'ATM-1', address: 'Test address', severity, reason: 'Test issue',
});

test('keeps import diagnostics within a bounded preview list', () => {
  const issues = [];
  for (let i = 0; i < IMPORT_ISSUE_LIMIT + 20; i += 1) appendImportIssue(issues, issue('warning', i + 1));
  assert.equal(issues.length, IMPORT_ISSUE_LIMIT);
  assert.equal(issues.at(-1).rowNumber, IMPORT_ISSUE_LIMIT);
});

test('summarizes import row errors and warnings separately', () => {
  const issues = [issue('error'), issue('warning', 3), issue('error', 4)];
  assert.deepEqual(importIssueSummary(issues), { errors: 2, warnings: 1, shown: 3 });
});

test('preserves the source row number and context in diagnostics', () => {
  const issues = [];
  appendImportIssue(issues, issue('error', 17));
  assert.deepEqual(issues[0], issue('error', 17));
});
