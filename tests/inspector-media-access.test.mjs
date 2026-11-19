import test from "node:test";
import assert from "node:assert/strict";
import { isInspectorMediaReference } from "../lib/inspector-media-access.ts";

test("detects local and Telegram media referenced by inspector reports", () => {
  const reports = [{ photosJson: JSON.stringify(["/api/photos/a.jpg", "/api/photos/tg_123"]), videoUrl: "/api/photos/v.mp4" }];
  assert.equal(isInspectorMediaReference("/api/photos/a.jpg", reports), true);
  assert.equal(isInspectorMediaReference("/api/photos/tg_123", reports), true);
  assert.equal(isInspectorMediaReference("/api/photos/v.mp4", reports), true);
});

test("does not classify unrelated media as inspector media", () => {
  assert.equal(isInspectorMediaReference("/api/photos/other.jpg", [{ photosJson: "[]", videoUrl: "" }]), false);
});

test("malformed legacy photo JSON does not break access checks", () => {
  assert.equal(isInspectorMediaReference("/api/photos/a.jpg", [{ photosJson: "{bad", videoUrl: "" }]), false);
});
