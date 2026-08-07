"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot");

function rect(id, locked = false) {
  return {
    id,
    type: "rect",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    stroke: "#000",
    fill: "none",
    strokeWidth: "thin",
    locked,
  };
}

test("layer list command-click toggles shapes in a multi-selection", () => {
  const app = bootApp();
  app.addShape(rect("a"));
  app.addShape(rect("b"));

  assert.equal(app.selectShapeFromList("a"), true);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["a"]);

  assert.equal(app.selectShapeFromList("b", true), true);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["a", "b"]);

  assert.equal(app.selectShapeFromList("a", true), true);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["b"]);

  assert.equal(app.selectShapeFromList("a"), true);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["a"]);
});

test("locked shapes are not selected from the layer list", () => {
  const app = bootApp();
  app.addShape(rect("free"));
  app.addShape(rect("locked", true));
  app.getState().selectedShapeIds = ["free"];

  assert.equal(app.selectShapeFromList("locked", true), false);
  assert.deepEqual(Array.from(app.getState().selectedShapeIds), ["free"]);
});
