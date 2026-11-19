import test from "node:test";
import assert from "node:assert/strict";
import { buildInspectorMediaItems, buildPersistedInspectorMediaState, inspectorMediaRetryDelay } from "../lib/inspector-media-queue-core.ts";

test("media queue includes local photos and video, skips already archived references", () => {
  const items = buildInspectorMediaItems([
    "/api/photos/a.jpg",
    "/api/photos/tg_ABC",
    "data:image/jpeg;base64,AAAA",
    "/api/photos/b.webp",
  ], "/api/photos/clip.mp4");
  assert.deepEqual(items.map((item) => item.kind), ["photo", "photo", "video"]);
  assert.equal(items[0].sourceUrl, "/api/photos/a.jpg");
  assert.equal(items[2].sourceUrl, "/api/photos/clip.mp4");
});

test("media retry delay grows exponentially and is capped at 30 minutes", () => {
  assert.equal(inspectorMediaRetryDelay(1), 10_000);
  assert.equal(inspectorMediaRetryDelay(2), 20_000);
  assert.equal(inspectorMediaRetryDelay(4), 80_000);
  assert.equal(inspectorMediaRetryDelay(99), 30 * 60_000);
});

test("archive confirmation updates report and queue state as one deterministic transition", () => {
  const report = { photosJson: JSON.stringify(["/api/photos/a.jpg", "/api/photos/b.jpg"]), videoUrl: "/api/photos/clip.mp4" };
  const job = { items: [
    { kind: "photo", sourceUrl: "/api/photos/a.jpg" },
    { kind: "video", sourceUrl: "/api/photos/clip.mp4" },
  ] };
  const result = buildPersistedInspectorMediaState(report, job, 0, "/api/photos/tg_PHOTO1", "2026-11-19T10:00:00.000Z");
  assert.deepEqual(JSON.parse(result.reportPatch.photosJson), ["/api/photos/tg_PHOTO1", "/api/photos/b.jpg"]);
  assert.equal(result.items[0].archivedUrl, "/api/photos/tg_PHOTO1");
  assert.equal(result.items[0].completedAt, "2026-11-19T10:00:00.000Z");
  assert.equal(result.items[1].completedAt, undefined);
});

test("archive transition rejects missing source references and malformed Telegram URLs", () => {
  const report = { photosJson: JSON.stringify(["/api/photos/other.jpg"]), videoUrl: "" };
  const job = { items: [{ kind: "photo", sourceUrl: "/api/photos/a.jpg" }] };
  assert.throws(() => buildPersistedInspectorMediaState(report, job, 0, "/api/photos/tg_A", "now"), /больше не связана/);
  assert.throws(() => buildPersistedInspectorMediaState(report, job, 0, "/api/photos/a.jpg", "now"), /некорректную ссылку/);
});

test("archive transition supports video and is idempotent when archive reference is already persisted", () => {
  const report = { photosJson: "[]", videoUrl: "/api/photos/clip.mp4" };
  const job = { items: [{ kind: "video", sourceUrl: "/api/photos/clip.mp4" }] };
  const result = buildPersistedInspectorMediaState(report, job, 0, "/api/photos/tgvideo_VIDEO1", "now");
  assert.equal(result.reportPatch.videoUrl, "/api/photos/tgvideo_VIDEO1");
  const retry = buildPersistedInspectorMediaState({ ...report, ...result.reportPatch }, { items: [{ ...result.items[0] }] }, 0, "/api/photos/tgvideo_VIDEO1", "later");
  assert.equal(retry.reportPatch.videoUrl, "/api/photos/tgvideo_VIDEO1");
});
