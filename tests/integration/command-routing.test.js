"use strict";

// 不変条件（invariant）テストの例。
// MCP / WS と同じ applyDrawingCommands を叩き、CLAUDE.md の設計原則を直接検証する。
//
// 新しい機能を足したら、このファイルに it(...) を 1 つ足すだけでよい。

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

describe("command routing (applyDrawingCommands)", () => {
  let app;
  beforeEach(() => {
    app = bootApp(); // 毎回まっさらな空プロジェクト（page-1 / layer-1）
  });

  it("rect は currentLayer.shapes へ入る", () => {
    app.applyDrawingCommands([{ action: "addShape", shape: rect("r1") }]);
    const page = app.getCurrentPage();
    assert.equal(page.layers[0].shapes.length, 1);
    assert.equal(page.layers[0].shapes[0].id, "r1");
  });

  it("dimension は shapes に混ざらず page.dimensions[] へ自動ルーティングされる", () => {
    app.applyDrawingCommands([
      { action: "addShape", shape: rect("r1") },
      {
        action: "addShape",
        shape: {
          id: "d1",
          type: "dimension",
          dimensionType: "horizontal",
          from: { x: 0, y: 0 },
          to: { x: 100, y: 0 },
        },
      },
    ]);
    const page = app.getCurrentPage();
    assert.equal(
      page.layers[0].shapes.length,
      1,
      "shapes に dimension が混入しない",
    );
    assert.equal(page.dimensions.length, 1);
    assert.equal(page.dimensions[0].id, "d1");
  });

  it("ID 衝突時は genId で再生成され、既存図形は維持される", () => {
    app.applyDrawingCommands([{ action: "addShape", shape: rect("dup") }]);
    app.applyDrawingCommands([{ action: "addShape", shape: rect("dup") }]);
    const shapes = app.getCurrentPage().layers[0].shapes;
    assert.equal(shapes.length, 2);
    assert.equal(shapes[0].id, "dup");
    assert.notEqual(shapes[1].id, "dup", "2 つ目は再生成される");
    assert.match(shapes[1].id, /^shape-/);
  });

  it("undo はドキュメント（pages）を 1 ステップ戻す", () => {
    app.applyDrawingCommands([{ action: "addShape", shape: rect("r1") }]);
    app.applyDrawingCommands([{ action: "addShape", shape: rect("r2") }]);
    assert.equal(app.getCurrentPage().layers[0].shapes.length, 2);
    app.undo();
    assert.equal(app.getCurrentPage().layers[0].shapes.length, 1);
    assert.equal(app.getCurrentPage().layers[0].shapes[0].id, "r1");
  });

  it("findShapeById は dimension を isDimension=true / layer=null で返す", () => {
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "d1",
          type: "dimension",
          dimensionType: "vertical",
          from: { x: 0, y: 0 },
          to: { x: 0, y: 80 },
        },
      },
    ]);
    const res = app.findShapeById("d1");
    assert.equal(res.isDimension, true);
    assert.equal(res.layer, null);
    assert.equal(res.shape.id, "d1");
  });
});

// ── 小道具 ───────────────────────────────────────────────────
function rect(id) {
  return {
    id,
    type: "rect",
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    stroke: "#1a1a2e",
    fill: "none",
    strokeWidth: "thin",
  };
}
