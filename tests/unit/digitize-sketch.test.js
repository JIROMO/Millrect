"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeDigitizeProposals,
  proposalToShape,
} = require("../../packages/digitize-sketch");

describe("digitize-sketch", () => {
  it("proposalToShape — rect mm → real units", () => {
    const shape = proposalToShape({
      type: "rect",
      x_mm: 10,
      y_mm: 20,
      width_mm: 50,
      height_mm: 30,
    });
    assert.equal(shape.type, "rect");
    assert.equal(shape.ghost, true);
    assert.equal(shape.x, 100);
    assert.equal(shape.y, 200);
    assert.equal(shape.width, 500);
    assert.equal(shape.height, 300);
  });

  it("proposalToShape — circle", () => {
    const shape = proposalToShape({
      type: "circle",
      cx_mm: 25,
      cy_mm: 25,
      r_mm: 5,
    });
    assert.equal(shape.type, "circle");
    assert.equal(shape.r, 50);
  });

  it("normalizeDigitizeProposals — 無効提案を errors に", () => {
    const result = normalizeDigitizeProposals([
      { type: "rect", x_mm: 0, y_mm: 0, width_mm: 10, height_mm: 10 },
      { type: "bogus" },
      { type: "line", x1_mm: 0, y1_mm: 0, x2_mm: 10 },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.shapes.length, 1);
    assert.equal(result.errors.length, 2);
  });
});
