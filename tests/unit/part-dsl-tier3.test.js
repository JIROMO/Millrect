"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizePartDsl, compilePartDsl } = require("../../packages/part-dsl");
const {
  validateManufacturingRules,
} = require("../../packages/manufacturing-rules");
const { lBracketTopOuterRing } = require("../../packages/part-geometry");

describe("part-dsl tier3", () => {
  it("panel — W/H params", () => {
    const r = normalizePartDsl({
      part: "panel",
      params: { W: 200, H: 100 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.dsl.params.W, 200);
    assert.deepEqual(r.dsl.views, ["top"]);
  });

  it("l_bracket — A/B/T/H", () => {
    const r = normalizePartDsl({
      part: "l_bracket",
      params: { A: 80, B: 60, T: 5, H: 40 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.dsl.params.T, 5);
  });

  it("compilePartDsl — slot feature", () => {
    const plan = compilePartDsl({
      part: "panel",
      params: { W: 100, H: 80 },
      features: [{ type: "slot", width_mm: 20, height_mm: 5 }],
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.features[0].type, "slot");
  });

  it("enclosure — wall T param", () => {
    const plan = compilePartDsl({
      part: "enclosure",
      params: { W: 100, D: 60, H: 40, T: 3 },
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.dsl.params.T, 3);
    assert.equal(plan.buildOptions.wallThicknessMm, 3);
  });
});

describe("manufacturing-rules", () => {
  it("validateManufacturingRules — 穴径过小", () => {
    const r = validateManufacturingRules({
      part: "panel",
      params: { W: 100, H: 80 },
      manufacturing: { min_hole_diameter_mm: 3 },
      features: [{ type: "hole_grid", diameter_mm: 1.5 }],
    });
    assert.equal(r.ok, false);
    assert.ok(r.violations.some((v) => v.code === "HOLE_TOO_SMALL"));
  });

  it("lBracketTopOuterRing — 6 頂点", () => {
    const ring = lBracketTopOuterRing(80, 60, 5);
    assert.equal(ring.length, 6);
  });
});
