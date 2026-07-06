"use strict";

// applyDrawingCommands の自動配置（placement: auto / center / none）。
// エージェントが原点 (0,0) 起点で作図しても左上に張り付かず、
// 空ページなら用紙中央・既存図形と衝突するなら空きスペースに置かれることを検証する。

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

// harness の既定ページ: A4 landscape（2970×2100 paper units）・scale 1/10
// → 用紙の実寸空間は 29700×21000 real units
const PAPER_W = 29700;
const PAPER_H = 21000;

describe("auto placement (applyDrawingCommands placement option)", () => {
  let app;
  beforeEach(() => {
    app = bootApp();
  });

  function addRect(id, x, y, w = 100, h = 50, opts = undefined) {
    app.applyDrawingCommands(
      [
        {
          action: "addShape",
          shape: {
            id,
            type: "rect",
            x,
            y,
            width: w,
            height: h,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
      ],
      opts,
    );
    return app.findShapeById(id).shape;
  }

  it("空ページ: 原点起点のバッチは用紙中央に配置される（auto 既定）", () => {
    const r = addRect("r1", 0, 0, 100, 50);
    assert.equal(r.x, (PAPER_W - 100) / 2);
    assert.equal(r.y, (PAPER_H - 50) / 2);
  });

  it("placement:'none' は座標をそのまま使う", () => {
    const r = addRect("r1", 0, 0, 100, 50, { placement: "none" });
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  it("placement:'center' は既存図形があっても常に中央", () => {
    addRect("r1", 0, 0, 100, 50); // → 中央へ
    const r2 = addRect("r2", 0, 0, 200, 100, { placement: "center" });
    assert.equal(r2.x, (PAPER_W - 200) / 2);
    assert.equal(r2.y, (PAPER_H - 100) / 2);
  });

  it("バッチ内の複数図形は相対位置を保ったまま一括シフトされる", () => {
    app.applyDrawingCommands([
      { action: "addShape", shape: rect("a", 0, 0, 100, 50) },
      { action: "addShape", shape: rect("b", 200, 0, 100, 50) },
    ]);
    const a = app.findShapeById("a").shape;
    const b = app.findShapeById("b").shape;
    assert.equal(b.x - a.x, 200, "相対位置が保たれる");
    assert.equal(b.y - a.y, 0);
    // バッチ全体 (300×50) が中央に来る
    assert.equal(a.x, (PAPER_W - 300) / 2);
    assert.equal(a.y, (PAPER_H - 50) / 2);
  });

  it("2 回目の原点起点バッチは既存図形と離れていても空きスペースへ再配置される", () => {
    const r1 = addRect("r1", 0, 0, 100, 50); // → 中央
    const r2 = addRect("r2", 0, 0, 100, 50); // 原点起点で再度
    assert.notEqual(r2.x, 0, "左上に張り付かない");
    assert.ok(
      !overlap(bbox(r1), bbox(r2)),
      "既存図形と重ならない位置に置かれる",
    );
    assert.ok(r2.x >= 0 && r2.x + 100 <= PAPER_W, "用紙内に収まる");
    assert.ok(r2.y >= 0 && r2.y + 50 <= PAPER_H, "用紙内に収まる");
  });

  it("既存図形の内側に完全に収まるバッチ（穴あけ）は動かさない", () => {
    const r1 = addRect("r1", 0, 0, 1000, 1000); // → 中央へシフト
    // r1 の中に収まる円（穴あけ・ブーリアン用の重ね）
    const cx = r1.x + 500;
    const cy = r1.y + 500;
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "hole",
          type: "circle",
          cx,
          cy,
          r: 100,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      },
    ]);
    const hole = app.findShapeById("hole").shape;
    assert.equal(hole.cx, cx, "内側配置はそのまま");
    assert.equal(hole.cy, cy);
  });

  it("既存図形に隣接（20mm 以内）するバッチは動かさない", () => {
    const r1 = addRect("r1", 0, 0, 1000, 1000); // → 中央へシフト
    // r1 の右辺にぴったり接する線（接続線の相対配置）
    const x1 = r1.x + 1000;
    const y1 = r1.y;
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "l1",
          type: "line",
          x1,
          y1,
          x2: x1 + 500,
          y2: y1,
          stroke: "#000",
          strokeWidth: "thin",
        },
      },
    ]);
    const l1 = app.findShapeById("l1").shape;
    assert.equal(l1.x1, x1, "隣接配置はそのまま");
    assert.equal(l1.y1, y1);
  });

  it("寸法線だけのバッチは動かさない（既存図形への注記）", () => {
    addRect("r1", 0, 0, 100, 50); // → 中央
    const r1 = app.findShapeById("r1").shape;
    app.applyDrawingCommands([
      {
        action: "addShape",
        shape: {
          id: "d1",
          type: "dimension",
          dimensionType: "horizontal",
          from: { x: r1.x, y: r1.y },
          to: { x: r1.x + 100, y: r1.y },
          offset: -80,
        },
      },
    ]);
    const d1 = app.findShapeById("d1").shape;
    assert.equal(d1.from.x, r1.x, "寸法線は図形位置に張り付いたまま");
  });

  it("バッチ内の寸法線は図形と一緒にシフトされる", () => {
    app.applyDrawingCommands([
      { action: "addShape", shape: rect("a", 0, 0, 100, 50) },
      {
        action: "addShape",
        shape: {
          id: "d1",
          type: "dimension",
          dimensionType: "horizontal",
          from: { x: 0, y: 0 },
          to: { x: 100, y: 0 },
          offset: -80,
        },
      },
    ]);
    const a = app.findShapeById("a").shape;
    const d1 = app.findShapeById("d1").shape;
    assert.equal(d1.from.x, a.x, "寸法線が図形に追従する");
    assert.equal(d1.from.y, a.y);
  });
});

// ── 小道具 ───────────────────────────────────────────────────
function rect(id, x, y, w, h) {
  return {
    id,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    stroke: "#000",
    fill: "none",
    strokeWidth: "thin",
  };
}
function bbox(r) {
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}
function overlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
