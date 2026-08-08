"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot");

function addTopCircle(app, radius = 200) {
  app.addShape({
    id: "base-circle",
    type: "circle",
    cx: 500,
    cy: 500,
    r: radius,
    stroke: "#123456",
    fill: "#abcdef",
    strokeWidth: "medium",
  });
  app.getState().selectedShapeIds = ["base-circle"];
}

test("cone builder creates a front page and triangular profile", () => {
  const app = bootApp();
  addTopCircle(app);

  assert.equal(
    app.createRevolvedShapeFromSelectedCircle({ heightMm: 50, topDiameterMm: 0 }),
    true,
  );
  const state = app.getState();
  const circle = app.findShapeById("base-circle").shape;
  const front = state.pages.find((page) => page.viewDefinition?.type === "front");
  const profile = front.layers.flatMap((layer) => layer.shapes)[0];
  assert.equal(circle.solidIntersect, true);
  assert.equal(profile.type, "path");
  // polygon-clipping 形式（始点=終点で閉じる）なので三角形は 3+1 点。
  const ring = profile.contours[0][0];
  assert.equal(ring.length, 4);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(profile.fill, "#abcdef");
  assert.equal(state.currentPageId, front.id);
  assert.deepEqual(Array.from(state.selectedShapeIds), [profile.id]);
});

test("frustum builder reuses the front page and creates a trapezoid", () => {
  const app = bootApp();
  const top = app.getCurrentPage();
  const front = app.defaultState().pages[0];
  front.id = "front-page";
  front.name = "Front";
  front.viewDefinition = { type: "front" };
  app.getState().pages.push(front);
  addTopCircle(app);

  assert.equal(
    app.createRevolvedShapeFromSelectedCircle({ heightMm: 30, topDiameterMm: 20 }),
    true,
  );
  assert.equal(app.getState().pages.length, 2);
  const profile = front.layers[0].shapes[0];
  const points = profile.contours[0][0];
  // polygon-clipping 形式（始点=終点で閉じる）なので台形は 4+1 点。
  assert.equal(points.length, 5);
  assert.deepEqual(points[0], points[points.length - 1]);
  assert.equal(points[2][0] - points[3][0], 200);
  assert.equal(app.getState().pages[0], top);
});

test("top diameter must be smaller than the selected circle", () => {
  const app = bootApp();
  addTopCircle(app);
  assert.equal(
    app.createRevolvedShapeFromSelectedCircle({ heightMm: 30, topDiameterMm: 40 }),
    false,
  );
  assert.equal(app.getState().pages.length, 1);
});

test("cone profile is centered on the circle's real x, not the front page's paper", () => {
  const app = bootApp();
  const top = app.getCurrentPage();
  // circle は用紙中央から離れた位置にある（例: 同じ上面図に他部品がある想定）
  app.addShape({
    id: "off-center-circle",
    type: "circle",
    cx: 9000,
    cy: 500,
    r: 100,
    stroke: "#123456",
    fill: "#abcdef",
    strokeWidth: "medium",
  });
  app.getState().selectedShapeIds = ["off-center-circle"];

  assert.equal(
    app.createRevolvedShapeFromSelectedCircle({ heightMm: 20, topDiameterMm: 0 }),
    true,
  );
  const state = app.getState();
  const circle = app.findShapeById("off-center-circle").shape;
  const front = state.pages.find((page) => page.viewDefinition?.type === "front");
  const profile = front.layers.flatMap((layer) => layer.shapes)[0];
  const ring = profile.contours[0][0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  const apex = ring[2];
  const [baseLeft, baseRight] = ring;
  // 母線（正面図の三角形）は円と同じ real 座標 cx を中心に置かれる。
  // ページ紙面中央基準だと、上面図ページに他図形がある場合に世界座標がずれる。
  assert.equal((baseLeft[0] + baseRight[0]) / 2, circle.cx);
  assert.equal(apex[0], circle.cx);
  assert.equal(state.pages[0], top);
});

test("dome builder creates a sampled half-ellipse front profile", () => {
  const app = bootApp();
  addTopCircle(app);
  assert.equal(
    app.createRevolvedShapeFromSelectedCircle({ kind: "dome", heightMm: 15 }),
    true,
  );
  const front = app.getState().pages.find(
    (page) => page.viewDefinition?.type === "front",
  );
  const profile = front.layers[0].shapes[0];
  const points = profile.contours[0][0];
  // 半楕円 33 点 + polygon-clipping 形式の閉じる点で 34。
  assert.equal(points.length, 34);
  assert.deepEqual(points[0], points[points.length - 1]);
  const bottomY = points[0][1];
  const apexY = points[16][1];
  assert.equal(bottomY - apexY, 150);
});
