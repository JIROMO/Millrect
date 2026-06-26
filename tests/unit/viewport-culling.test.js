"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  boxIntersects,
  isShapeVisibleInCull,
  visibleShapesForRender,
} = require("../../packages/viewport-culling");

const ROOT = path.resolve(__dirname, "../..");

test("boxIntersects treats missing boxes as visible", () => {
  assert.equal(boxIntersects(null, { x: 0, y: 0, w: 10, h: 10 }), true);
  assert.equal(boxIntersects({ x: 0, y: 0, w: 10, h: 10 }, null), true);
});

test("boxIntersects detects overlap and separation", () => {
  const cull = { x: 0, y: 0, w: 100, h: 100 };

  assert.equal(boxIntersects({ x: 10, y: 10, w: 20, h: 20 }, cull), true);
  assert.equal(boxIntersects({ x: 100, y: 40, w: 10, h: 10 }, cull), true);
  assert.equal(boxIntersects({ x: 111, y: 40, w: 10, h: 10 }, cull), false);
  assert.equal(boxIntersects({ x: 40, y: -20, w: 10, h: 10 }, cull), false);
});

test("visibleShapesForRender keeps selected and unknown-bbox shapes", () => {
  const page = { scale: { numerator: 1, denominator: 1 } };
  const cull = { x: 0, y: 0, w: 100, h: 100 };
  const shapes = [
    { id: "inside" },
    { id: "outside" },
    { id: "selected-outside" },
    { id: "throws" },
    { id: "null-bbox" },
  ];
  const boxes = {
    inside: { x: 10, y: 10, w: 20, h: 20 },
    outside: { x: 200, y: 200, w: 20, h: 20 },
    "selected-outside": { x: 300, y: 300, w: 20, h: 20 },
    "null-bbox": null,
  };
  const visible = visibleShapesForRender(
    shapes,
    page,
    cull,
    new Set(["selected-outside"]),
    (shape) => {
      if (shape.id === "throws") throw new Error("bbox failed");
      return boxes[shape.id];
    },
  );

  assert.deepEqual(
    visible.map((shape) => shape.id),
    ["inside", "selected-outside", "throws", "null-bbox"],
  );
});

test("isShapeVisibleInCull returns true when culling is disabled", () => {
  assert.equal(
    isShapeVisibleInCull(
      { id: "outside" },
      { scale: null },
      null,
      new Set(),
      () => ({ x: 999, y: 999, w: 1, h: 1 }),
    ),
    true,
  );
});

test("viewport culling package is loaded before renderer in the app shell", () => {
  const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  const cullingIndex = html.indexOf("../packages/viewport-culling.js");
  const rendererIndex = html.indexOf('src="js/renderer.js"');

  assert.notEqual(cullingIndex, -1);
  assert.notEqual(rendererIndex, -1);
  assert.ok(cullingIndex < rendererIndex);
});
