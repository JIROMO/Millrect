"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  layoutCenteredRectMm,
  boxViewSizesMm,
  analyzeMultiviewReadiness,
  buildRectDimensionSpecs,
  buildHoleGridHoleRings,
  buildRectWithHolesPathShape,
  applyReferenceScaleAnchor,
} = require("../../packages/agent-intent");

describe("agent-intent", () => {
  it("layoutCenteredRectMm — A4 横 1:2 で 120×80 mm を中央配置", () => {
    const geom = layoutCenteredRectMm(
      120,
      80,
      { width: 297, height: 210 },
      { numerator: 1, denominator: 2 },
    );
    assert.equal(geom.width, 1200);
    assert.equal(geom.height, 800);
    assert.ok(geom.x > 0);
    assert.ok(geom.y > 0);
  });

  it("boxViewSizesMm — 各ビューの mm 寸法", () => {
    const sizes = boxViewSizesMm({ width: 120, depth: 80, height: 50 });
    assert.deepEqual(sizes.top, { w: 120, h: 80 });
    assert.deepEqual(sizes.front, { w: 120, h: 50 });
    assert.deepEqual(sizes.right, { w: 80, h: 50 });
  });

  it("analyzeMultiviewReadiness — 2 軸 + 輪郭ありで ok", () => {
    const result = analyzeMultiviewReadiness([
      { pageId: "p1", name: "上面", viewType: "top", profileCount: 1 },
      { pageId: "p2", name: "正面", viewType: "front", profileCount: 1 },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.axisCount, 2);
    assert.equal(result.ready, true);
  });

  it("analyzeMultiviewReadiness — 1 軸のみで NEED_TWO_AXES", () => {
    const result = analyzeMultiviewReadiness([
      { pageId: "p1", name: "上面", viewType: "top", profileCount: 1 },
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.axisCount, 1);
    assert.ok(result.issues.some((i) => i.code === "NEED_TWO_AXES"));
  });

  it("buildRectDimensionSpecs — 水平・垂直 2 本", () => {
    const specs = buildRectDimensionSpecs({
      x: 100,
      y: 200,
      width: 1200,
      height: 800,
    });
    assert.equal(specs.length, 2);
    assert.equal(specs[0].dimensionType, "horizontal");
    assert.equal(specs[1].dimensionType, "vertical");
  });

  it("buildHoleGridHoleRings — 2×2 grid", () => {
    const rect = { x: 0, y: 0, width: 1000, height: 800 };
    const rings = buildHoleGridHoleRings(rect, {
      diameterMm: 4,
      insetMm: 10,
      count: [2, 2],
    });
    assert.equal(rings.length, 4);
    assert.equal(rings[0].length, 128);
  });

  it("buildRectWithHolesPathShape — path contours", () => {
    const rect = {
      id: "r1",
      type: "rect",
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
      stroke: "#000",
      fill: "#ccc",
      strokeWidth: "medium",
    };
    const hole = buildHoleGridHoleRings(rect, { count: [1, 1] });
    const path = buildRectWithHolesPathShape(rect, hole);
    assert.equal(path.type, "path");
    assert.equal(path.contours[0].length, 2);
  });

  it("applyReferenceScaleAnchor — 2 点間を指定 mm に合わせる", () => {
    const image = { x: 0, y: 0, width: 1000, height: 500 };
    const r = applyReferenceScaleAnchor(
      image,
      { x: 100, y: 100 },
      { x: 600, y: 100 },
      100,
    );
    assert.equal(r.ok, true);
    assert.equal(r.scaleFactor, 2);
    assert.equal(image.width, 2000);
  });
});
