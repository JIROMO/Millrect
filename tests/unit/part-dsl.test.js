"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizePartDsl,
  compilePartDsl,
  legacyOptionsToPartDsl,
} = require("../../packages/part-dsl");

describe("part-dsl", () => {
  it("normalizePartDsl — W/D/H エイリアス", () => {
    const r = normalizePartDsl({
      part: "box",
      params: { width: 100, depth: 60, height: 40 },
    });
    assert.equal(r.ok, true);
    assert.equal(r.dsl.params.W, 100);
    assert.equal(r.dsl.params.D, 60);
    assert.equal(r.dsl.params.H, 40);
  });

  it("compilePartDsl — buildOptions + param_bind constraints", () => {
    const plan = compilePartDsl({
      part: "box",
      params: { W: 120, D: 80, H: 50 },
      views: ["top", "front", "right"],
      features: [
        { type: "hole_grid", view: "top", count: [2, 2], diameter_mm: 4 },
      ],
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.buildOptions.sizeMm.width, 120);
    assert.equal(plan.features.length, 1);
    assert.ok(plan.constraints.some((c) => c.param === "W"));
    assert.ok(plan.solver);
  });

  it("legacyOptionsToPartDsl — createPart options 互換", () => {
    const dsl = legacyOptionsToPartDsl({
      kind: "box",
      sizeMm: { width: 100, depth: 60, height: 40 },
      features: [{ type: "hole_grid", count: [1, 1] }],
    });
    const plan = compilePartDsl(dsl);
    assert.equal(plan.ok, true);
    assert.equal(plan.dsl.params.W, 100);
  });

  it("normalizePartDsl — 未対応 part でエラー", () => {
    const r = normalizePartDsl({ part: "gear" });
    assert.equal(r.ok, false);
  });
});
