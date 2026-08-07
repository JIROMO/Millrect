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
  assert.equal(profile.contours[0][0].length, 3);
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
  assert.equal(profile.contours[0][0].length, 4);
  const points = profile.contours[0][0];
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
  assert.equal(points.length, 33);
  const bottomY = points[0][1];
  const apexY = points[16][1];
  assert.equal(bottomY - apexY, 150);
});
