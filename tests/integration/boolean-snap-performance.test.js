"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

describe("boolean path snapping", () => {
  let app;
  beforeEach(() => {
    app = bootApp();
  });

  it("円近似の密な頂点列をスナップ用途だけ簡略化する", () => {
    const ring = Array.from({ length: 128 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 128;
      return [10 * Math.cos(a), 10 * Math.sin(a)];
    });
    ring.push(ring[0]);

    const simplified = app._simplifySnapRing(ring);
    assert.ok(simplified.length < 64, `${simplified.length} points remain`);
    assert.deepEqual(simplified[0], ring[0]);
  });

  it("簡略化後も path と別図形の交点へスナップできる", () => {
    const path = {
      id: "boolean-result",
      type: "path",
      contours: [
        [
          [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
            [0, 0],
          ],
        ],
      ],
    };
    const line = {
      id: "line",
      type: "line",
      x1: 50,
      y1: -50,
      x2: 50,
      y2: 50,
    };
    const snap = app.snapToShapes(
      { x: 5.1, y: 0.1 },
      [path, line],
      { numerator: 1, denominator: 1 },
      1,
    );

    assert.equal(snap.x, 5);
    assert.equal(snap.y, 0);
    assert.equal(snap.snapType, "intersection");
  });
});
