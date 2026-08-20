"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

test("1 mm mode quantizes real coordinates without changing normal mode", () => {
  const app = bootApp();
  const state = app.getState();

  assert.equal(state.oneMmMode, false);
  assert.equal(app.quantizeMmForUnitMode(1.6), 1.6);
  assert.equal(app.quantizeRealForUnitMode(16), 16);

  state.oneMmMode = true;
  assert.equal(app.quantizeMmForUnitMode(1.6), 2);
  assert.equal(app.quantizeMmForUnitMode(-1.6), -2);
  assert.equal(app.quantizeRealForUnitMode(16), 20);
  const point = app.quantizeRealPointForUnitMode({ x: 14, y: 26 });
  assert.equal(point.x, 10);
  assert.equal(point.y, 30);
});

test("1 mm mode rounds a moved shape's anchor while preserving one translation", () => {
  const app = bootApp();
  const state = app.getState();
  state.oneMmMode = true;

  const delta = app.quantizeMoveDeltaForUnitMode(
    4,
    1,
    { x: 1.2, y: 3.7 },
    state,
  );

  assert.equal(delta.dxReal, 8);
  assert.ok(Math.abs(delta.dyReal - 3) < 1e-9);
  assert.equal(1.2 + delta.dxReal / 10, 2);
  assert.equal(3.7 + delta.dyReal / 10, 4);
});
