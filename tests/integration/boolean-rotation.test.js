"use strict";

// 回帰テスト: 回転した図形のブール演算が「二重回転」しないこと。
//
// 不具合: shapeToProfileRings は rotation/flip を輪郭へ適用済みで返すのに、
// shapeToClipPolygon が再度 applyShapeTransformReal していたため二重回転していた。
// 90° → 180°（長方形は見た目が元と同じ＝「回転が消えた」ように見える）、
// 40° → 80°（斜めだが誤角度）。union が L 字にならない原因だった。

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

function polyBBox(multipoly) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const polygon of multipoly) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { w: maxX - minX, h: maxY - minY };
}

describe("boolean: 回転焼き込みが二重適用されない", () => {
  let app;
  beforeEach(() => {
    app = bootApp();
  });

  it("rotation:90 の rect は clip polygon で幅高が入れ替わる（180°に戻らない）", () => {
    const poly = app.shapeToClipPolygon({
      id: "r",
      type: "rect",
      x: 0,
      y: 0,
      width: 80,
      height: 520,
      rotation: 90,
    });
    const { w, h } = polyBBox(poly);
    // 90° 回転 → 幅80/高520 が 幅520/高80 に入れ替わる。
    // 二重回転（=180°）バグだと 幅80/高520 のままになる。
    assert.ok(Math.abs(w - 520) < 1, `width expected ~520, got ${w}`);
    assert.ok(Math.abs(h - 80) < 1, `height expected ~80, got ${h}`);
  });

  it("rotation:45 の正方形 rect は対角化して bbox が √2 倍になる", () => {
    const poly = app.shapeToClipPolygon({
      id: "r",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 45,
    });
    const { w, h } = polyBBox(poly);
    const expected = 100 * Math.SQRT2; // ≈141.4（単一回転）。二重回転=90°なら100のまま
    assert.ok(Math.abs(w - expected) < 1, `width expected ~${expected}, got ${w}`);
    assert.ok(Math.abs(h - expected) < 1, `height expected ~${expected}, got ${h}`);
  });

  it("回転なしの rect はそのまま", () => {
    const poly = app.shapeToClipPolygon({
      id: "r",
      type: "rect",
      x: 0,
      y: 0,
      width: 80,
      height: 520,
    });
    const { w, h } = polyBBox(poly);
    assert.ok(Math.abs(w - 80) < 1e-6);
    assert.ok(Math.abs(h - 520) < 1e-6);
  });
});
