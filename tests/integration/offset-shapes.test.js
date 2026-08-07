"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot");

function rect(id, x, y, width, height) {
  return { id, type: "rect", x, y, width, height, stroke: "#123456", fill: "none", strokeWidth: "thin" };
}

function bbox(contours) {
  const points = contours.flat(2);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

test("1mm inward offset keeps a rect as a selected rect copy", () => {
  const app = bootApp();
  app.addShape(rect("r1", 100, 200, 100, 80));
  app.getState().selectedShapeIds = ["r1"];

  assert.equal(app.offsetSelectedShapes(1), true);
  const shapes = app.getCurrentLayer().shapes;
  assert.equal(shapes.length, 2);
  assert.equal(shapes[0].id, "r1");
  assert.equal(shapes[1].type, "rect");
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), [shapes[1].id]);
  assert.equal(shapes[1].x, 110);
  assert.equal(shapes[1].y, 210);
  assert.equal(shapes[1].width, 80);
  assert.equal(shapes[1].height, 60);
  assert.equal(shapes[1].stroke, "#123456");
});

test("rect outward offset preserves rect transforms and adjusts corner radius", () => {
  const app = bootApp();
  app.addShape({
    ...rect("rounded", 100, 200, 100, 80),
    rx: 20,
    rotation: 30,
    flipH: true,
  });
  app.getState().selectedShapeIds = ["rounded"];

  assert.equal(app.offsetSelectedShapes(1, "outset"), true);
  const result = app.getCurrentLayer().shapes[1];
  assert.equal(result.type, "rect");
  assert.equal(result.x, 90);
  assert.equal(result.y, 190);
  assert.equal(result.width, 120);
  assert.equal(result.height, 100);
  assert.equal(result.rx, 30);
  assert.equal(result.rotation, 30);
  assert.equal(result.flipH, true);
});

test("offset expands holes while shrinking the outer contour", () => {
  const app = bootApp();
  app.addShape({
    id: "frame",
    type: "path",
    contours: [[
      [[0, 0], [200, 0], [200, 200], [0, 200]],
      [[50, 50], [50, 150], [150, 150], [150, 50]],
    ]],
    stroke: "#000",
    fill: "none",
    strokeWidth: "thin",
  });
  app.getState().selectedShapeIds = ["frame"];

  assert.equal(app.offsetSelectedShapes(1), true);
  const result = app.getCurrentLayer().shapes[1];
  assert.equal(result.contours.length, 1);
  assert.equal(result.contours[0].length, 2);
  const outer = bbox([[result.contours[0][0]]]);
  const hole = bbox([[result.contours[0][1]]]);
  assert.ok(Math.abs(outer.w - 180) < 1e-6);
  assert.ok(Math.abs(hole.w - 120) < 1e-6);
});

test("1mm outward offset expands the outline and shrinks holes", () => {
  const app = bootApp();
  app.addShape({
    id: "frame",
    type: "path",
    contours: [[
      [[0, 0], [200, 0], [200, 200], [0, 200]],
      [[50, 50], [50, 150], [150, 150], [150, 50]],
    ]],
    stroke: "#000",
    fill: "none",
    strokeWidth: "thin",
  });
  app.getState().selectedShapeIds = ["frame"];

  assert.equal(app.offsetSelectedShapes(1, "outset"), true);
  const result = app.getCurrentLayer().shapes[1];
  assert.equal(result.contours.length, 1);
  assert.equal(result.contours[0].length, 2);
  const outer = bbox([[result.contours[0][0]]]);
  const hole = bbox([[result.contours[0][1]]]);
  assert.ok(Math.abs(outer.x + 10) < 1e-6);
  assert.ok(Math.abs(outer.w - 220) < 1e-6);
  assert.ok(Math.abs(hole.w - 80) < 1e-6);
  assert.equal(
    result.contours[0][0].length,
    5,
    "rectangle outset keeps four sharp corners plus the closing point",
  );
});

test("too-large offset fails without modifying the drawing", () => {
  const app = bootApp();
  app.addShape(rect("small", 0, 0, 10, 10));
  app.getState().selectedShapeIds = ["small"];
  assert.equal(app.offsetSelectedShapes(1), false);
  assert.equal(app.getCurrentLayer().shapes.length, 1);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["small"]);
});
