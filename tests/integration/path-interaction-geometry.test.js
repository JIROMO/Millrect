"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

test("100-hole paths reuse lightweight interaction geometry without changing canonical contours", () => {
  const app = bootApp();
  const circle = (cx, cy, r, count = 128) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });
  const holes = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      holes.push(circle(col * 7, row * 7, 1.6));
    }
  }
  const shape = {
    id: "path-100-holes",
    type: "path",
    contours: [
      [
        [
          [-5, -5],
          [68, -5],
          [68, 68],
          [-5, 68],
        ],
        ...holes,
      ],
    ],
  };
  const scale = { numerator: 1, denominator: 1 };
  const canonicalBefore = JSON.stringify(shape.contours);

  const first = app.getPathInteractionGeometry(shape, scale);
  const second = app.getPathInteractionGeometry(shape, scale);
  const displayVertexCount = first.displayPaperRings.reduce(
    (sum, ring) => sum + ring.length,
    0,
  );

  assert.strictEqual(second, first, "unchanged shapes should reuse the cache");
  assert.equal(first.canonicalVertexCount, 12804);
  assert.ok(displayVertexCount < first.canonicalVertexCount / 2);
  assert.equal(first.hitRealRings.length, 101);
  assert.equal(first.hitRingBounds.length, 101);
  assert.equal(JSON.stringify(shape.contours), canonicalBefore);

  app.markShapeDirty(shape.id);
  const afterDirty = app.getPathInteractionGeometry(shape, scale);
  assert.notStrictEqual(afterDirty, first, "dirty shapes should rebuild once");
  assert.equal(JSON.stringify(shape.contours), canonicalBefore);
});


// ドラッグ中（mouseup で markShapeDirty される前）の回転・contours 差し替えでも
// キャッシュが古い輪郭を返さないこと。返すと選択枠が操作前の位置に取り残される。
test("path interaction geometry follows live rotation and contour replacement before markShapeDirty", () => {
  const app = bootApp();
  const shape = {
    id: "path-live-edit",
    type: "path",
    contours: [
      [
        [
          [0, 0],
          [100, 0],
          [100, 50],
          [0, 50],
        ],
      ],
    ],
  };
  const scale = { numerator: 1, denominator: 1 };
  const bounds = (geometry) => {
    const xs = geometry.hitRealRings.flat().map(([x]) => x);
    const ys = geometry.hitRealRings.flat().map(([, y]) => y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(
      (v) => Math.round(v),
    );
  };

  const before = app.getPathInteractionGeometry(shape, scale);
  assert.deepEqual(bounds(before), [0, 0, 100, 50]);

  shape.rotation = 90;
  const rotated = app.getPathInteractionGeometry(shape, scale);
  assert.notStrictEqual(rotated, before, "rotation must invalidate the cache");
  assert.deepEqual(bounds(rotated), [25, -25, 75, 75]);

  shape.rotation = 0;
  shape.contours = shape.contours.map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => [x + 30, y + 10])),
  );
  const moved = app.getPathInteractionGeometry(shape, scale);
  assert.deepEqual(bounds(moved), [30, 10, 130, 60]);
});
