"use strict";

// 回帰テスト: 単一図形選択時の alignShapes は「用紙実寸」を基準に揃えること。
//
// 不具合: 用紙サイズ(mm)を real units へ変換する際に REAL_PER_MM(=10) を
// 掛け忘れ、用紙を 1/10 に誤認していた。A4 横・scale 1/10 なら実寸
// 29700×21000 real units のところ 2970×2100 として整列してしまい、
// 「右揃え」「下揃え」が用紙の左上 1/10 領域に寄っていた。

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

describe("alignShapes: 単一選択は用紙実寸基準", () => {
  let app;
  const rect = () => ({
    id: "r1",
    type: "rect",
    x: 1000,
    y: 1000,
    width: 800,
    height: 500,
  });

  beforeEach(() => {
    app = bootApp();
    app.addShape(rect());
    app.getState().selectedShapeIds = ["r1"];
  });

  it("既定ページは A4 landscape・scale 1/10 → 実寸 29700×21000", () => {
    const { w, h } = app.getPageCanvasMM(app.getCurrentPage());
    assert.equal(w, 29700);
    assert.equal(h, 21000);
  });

  it("right: shape.x + width がページ実寸幅に一致する", () => {
    app.alignShapes("right");
    const { shape } = app.findShapeById("r1");
    const { w } = app.getPageCanvasMM(app.getCurrentPage());
    assert.equal(shape.x + shape.width, w);
  });

  it("bottom: shape.y + height がページ実寸高に一致する", () => {
    app.alignShapes("bottom");
    const { shape } = app.findShapeById("r1");
    const { h } = app.getPageCanvasMM(app.getCurrentPage());
    assert.equal(shape.y + shape.height, h);
  });

  it("centerH: 図形中心がページ実寸幅の中央に一致する", () => {
    app.alignShapes("centerH");
    const { shape } = app.findShapeById("r1");
    const { w } = app.getPageCanvasMM(app.getCurrentPage());
    assert.equal(shape.x + shape.width / 2, w / 2);
  });

  it("left/top: 原点に揃う", () => {
    app.alignShapes("left");
    app.alignShapes("top");
    const { shape } = app.findShapeById("r1");
    assert.equal(shape.x, 0);
    assert.equal(shape.y, 0);
  });
});
