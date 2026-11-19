import test from "node:test";
import assert from "node:assert/strict";
import { validateInspectorReportInput } from "../lib/inspector-report-validation.ts";

test("inspector report requires a meaningful comment", () => {
  assert.match(validateInspectorReportInput({ comment: "  ", photos: [] }), /комментарий/i);
});

test("inspector report accepts optional photos and valid GPS", () => {
  assert.equal(validateInspectorReportInput({ comment: "Проверка выполнена", latitude: 41.3, longitude: 69.2, gpsAccuracy: 18 }), null);
});

test("inspector report rejects more than five photos", () => {
  const photos = Array.from({ length: 6 }, () => "data:image/jpeg;base64,AAAA");
  assert.match(validateInspectorReportInput({ comment: "Проверка", photos }), /5 фотографий/i);
});

test("inspector report rejects malformed GPS", () => {
  assert.match(validateInspectorReportInput({ comment: "Проверка", latitude: 91, longitude: 69 }), /координаты/i);
});

test("inspector report rejects non-image attachments", () => {
  assert.match(validateInspectorReportInput({ comment: "Проверка", photos: ["data:video/mp4;base64,AAAA"] }), /фотографией/i);
});

test('inspector report accepts a supported video up to 60 seconds', () => {
  const video = new File([new Uint8Array([1, 2, 3])], 'inspection.mp4', { type: 'video/mp4' });
  assert.equal(validateInspectorReportInput({ comment: 'Проверка банкомата', photos: [], video, videoDurationSeconds: 59.5 }), null);
});

test('inspector report rejects video longer than 60 seconds', () => {
  const video = new File([new Uint8Array([1, 2, 3])], 'inspection.mp4', { type: 'video/mp4' });
  assert.match(validateInspectorReportInput({ comment: 'Проверка', video, videoDurationSeconds: 61 }), /60 секунд/i);
});

test('inspector report rejects unsupported video formats', () => {
  const video = new File([new Uint8Array([1, 2, 3])], 'inspection.avi', { type: 'video/x-msvideo' });
  assert.match(validateInspectorReportInput({ comment: 'Проверка', video, videoDurationSeconds: 10 }), /Поддерживаются/i);
});
