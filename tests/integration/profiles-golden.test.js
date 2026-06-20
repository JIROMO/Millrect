"use strict";

// ゴールデン・スナップショットの例。
// 「2D が唯一のソース、Profile/3D は派生」という設計に合わせ、
// 図面 → 派生 Profile（rings / bbox）の決定論を固定する。
//
// 派生ロジックを意図的に変えたとき:
//   UPDATE_SNAPSHOTS=1 npm run test:integration

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");
const { matchSnapshot } = require("../harness/snapshot.js");

describe("derived profiles (golden)", () => {
  let app;
  beforeEach(() => {
    app = bootApp();
  });

  it("rect + circle → Profile rings/bbox スナップショット", () => {
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "r1",
          type: "rect",
          x: 10,
          y: 20,
          width: 100,
          height: 60,
          stroke: "#000",
          fill: "#000",
          strokeWidth: "thin",
        },
      },
      {
        action: "addShape",
        shape: {
          id: "c1",
          type: "circle",
          cx: 200,
          cy: 100,
          r: 30,
          stroke: "#000",
          fill: "#000",
          strokeWidth: "thin",
        },
      },
    ]);

    const profiles = app
      .extractProfilesFromPage(app.getCurrentPage())
      .map((p) => ({
        sourceId: p.sourceId,
        bbox: p.bbox,
        ringCount: p.rings.length,
      }));

    matchSnapshot("rect-circle-profiles", profiles);
  });

  it("line / open-bezier は Profile 非対象（3D に出ない）", () => {
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 50,
          y2: 50,
          stroke: "#000",
          strokeWidth: "thin",
        },
      },
    ]);
    const profiles = app.extractProfilesFromPage(app.getCurrentPage());
    assert.equal(profiles.length, 0, "line は profile を生成しない");
  });
});
