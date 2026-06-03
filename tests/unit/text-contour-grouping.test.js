"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  groupRingsIntoPolygons,
  ringSignedArea,
  ringCenter,
  pointInRing,
  countNegativeRings,
  flattenRings,
  glyphFillRule,
  shouldUnionOverlappingPositiveRings,
  shouldUnionStrokeFragments,
} = require("../../packages/text-contour-grouping");

function rectRing(x0, y0, x1, y1, ccw = true) {
  const ring = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  return ccw ? ring : ring.slice().reverse();
}

function pointOutsideRing(point, ring) {
  return !pointInRing(point[0], point[1], ring);
}

describe("text-contour-grouping", () => {
  it("第一頂点が外周外でも中心が内側なら counter を穴にする", () => {
    const outer = rectRing(0, 0, 100, 100, true);
    // 開始点 (105,50) は外周外。中心 (50,50) は外周内。
    const hole = [
      [105, 50],
      [70, 50],
      [70, 30],
      [30, 30],
      [30, 70],
      [70, 70],
      [70, 50],
      [105, 50],
    ];
    assert.equal(pointOutsideRing(hole[0], outer), true);
    const holeCenter = ringCenter(hole);
    assert.equal(pointInRing(holeCenter[0], holeCenter[1], outer), true);

    const polys = groupRingsIntoPolygons([outer, hole]);
    assert.equal(polys.length, 1);
    assert.equal(polys[0].length, 2);
    assert.ok(ringSignedArea(polys[0][0]) > 0);
    assert.ok(ringSignedArea(polys[0][1]) < 0);
    assert.equal(glyphFillRule(polys), "nonzero");
  });

  it("ネストした counter / 島は深さで向きを交互にする", () => {
    const outer = rectRing(0, 0, 100, 100, true);
    const hole = rectRing(20, 20, 80, 80, false);
    const island = rectRing(35, 35, 65, 65, true);
    const polys = groupRingsIntoPolygons([outer, hole, island]);
    assert.equal(polys.length, 1);
    assert.equal(polys[0].length, 3);
    assert.ok(ringSignedArea(polys[0][0]) > 0);
    assert.ok(ringSignedArea(polys[0][1]) < 0);
    assert.ok(ringSignedArea(polys[0][2]) > 0);
  });

  it("離れた外周は別 compound path に分離する", () => {
    const left = rectRing(0, 0, 40, 40, true);
    const right = rectRing(60, 0, 100, 40, true);
    const polys = groupRingsIntoPolygons([left, right]);
    assert.equal(polys.length, 2);
    assert.equal(polys[0].length, 1);
    assert.equal(polys[1].length, 1);
  });

  it("stroke 分解のみ union 対象", () => {
    const fragmentA = [rectRing(0, 0, 10, 10)];
    const fragmentB = [rectRing(12, 0, 22, 10)];
    const compound = groupRingsIntoPolygons([
      rectRing(0, 0, 100, 100, true),
      rectRing(20, 20, 80, 80, false),
    ]);
    assert.equal(shouldUnionStrokeFragments([fragmentA, fragmentB]), true);
    assert.equal(shouldUnionStrokeFragments(compound), false);
  });

  it("重なる正方向リングは union、ネスト counter は union しない", () => {
    const leftBar = rectRing(0, 0, 10, 100, true);
    const topBar = rectRing(0, 90, 60, 100, true);
    assert.equal(shouldUnionOverlappingPositiveRings([leftBar, topBar]), true);
    assert.equal(glyphFillRule([[leftBar], [topBar]]), "nonzero");

    const outer = rectRing(0, 0, 100, 100, true);
    const hole = rectRing(20, 20, 80, 80, false);
    const compound = groupRingsIntoPolygons([outer, hole]);
    assert.equal(
      shouldUnionOverlappingPositiveRings(flattenRings(compound)),
      false,
    );
    assert.equal(glyphFillRule(compound), "nonzero");
  });
});
