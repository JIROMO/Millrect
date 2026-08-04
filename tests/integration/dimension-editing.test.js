"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { bootApp } = require("../harness/boot");

test("寸法値は未編集時に座標から自動計算され、編集値を表示できる", () => {
  const app = bootApp();
  const dim = {
    type: "dimension",
    dimensionType: "horizontal",
    from: { x: 100, y: 200 },
    to: { x: 225, y: 200 },
  };

  assert.equal(app.dimensionValueMM(dim), 12.5);
  dim.value = 18;
  assert.equal(app.dimensionValueMM(dim), 18);
});

test("寸法用の精密スナップはグループ内の子図形の点を使う", () => {
  const app = bootApp();
  const scale = { numerator: 1, denominator: 1 };
  const group = {
    id: "group-1",
    type: "group",
    children: [
      { id: "circle-1", type: "circle", cx: 100, cy: 100, r: 10 },
      { id: "circle-2", type: "circle", cx: 200, cy: 100, r: 10 },
    ],
  };

  // 1:1では real 10 = paper 1mm。最初の円の右端は paper (11, 10)。
  const compact = app.snapToShapes(
    { x: 11, y: 10 },
    [group],
    scale,
    0.2,
  );
  const expanded = app.snapToShapes(
    { x: 11, y: 10 },
    [group],
    scale,
    0.2,
    null,
    { expandGroups: true },
  );

  assert.equal(compact, null);
  assert.deepEqual(
    { x: expanded.x, y: expanded.y, snapType: expanded.snapType },
    { x: 11, y: 10, snapType: "endpoint" },
  );
});
