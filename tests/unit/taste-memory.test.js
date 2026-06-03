"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  createEmptyProjectBrief,
  normalizeProjectBrief,
  mergeProjectBrief,
  isEmptyProjectBrief,
  briefSummary,
  normalizeJudgment,
  evaluateBriefBeforeMake,
} = require("../../packages/taste-memory");

describe("taste-memory", () => {
  it("createEmptyProjectBrief returns versioned empty structure", () => {
    const b = createEmptyProjectBrief();
    assert.equal(b.version, 1);
    assert.deepEqual(b.designPrinciples, []);
    assert.ok(b.updatedAt);
  });

  it("normalizeProjectBrief returns null for empty input", () => {
    assert.equal(normalizeProjectBrief(null), null);
    assert.equal(normalizeProjectBrief({}), null);
  });

  it("normalizeProjectBrief keeps intent and phase", () => {
    const b = normalizeProjectBrief({
      intent: "スマホケース",
      phase: "taste",
    });
    assert.equal(b.intent, "スマホケース");
    assert.equal(b.phase, "taste");
  });

  it("mergeProjectBrief appends decisions", () => {
    const merged = mergeProjectBrief(null, {
      intent: "box",
      decisions: [{ outcome: "note", reason: "曲線は少なめ" }],
    });
    assert.equal(merged.decisions.length, 1);
    assert.equal(merged.decisions[0].reason, "曲線は少なめ");
  });

  it("normalizeJudgment requires reason", () => {
    assert.equal(normalizeJudgment({ outcome: "accept" }), null);
  });

  it("briefSummary counts principles", () => {
    const s = briefSummary({
      intent: "x",
      phase: "brief",
      designPrinciples: [{ id: "p1", statement: "a", polarity: "prefer" }],
      decisions: [],
    });
    assert.equal(s.designPrincipleCount, 1);
    assert.equal(s.intent, "x");
  });

  it("isEmptyProjectBrief detects non-empty", () => {
    assert.equal(isEmptyProjectBrief({ phase: "discover" }), false);
    assert.equal(isEmptyProjectBrief(null), true);
  });

  it("evaluateBriefBeforeMake allows when not required", () => {
    assert.equal(evaluateBriefBeforeMake(null, false).allowed, true);
  });

  it("evaluateBriefBeforeMake blocks discover-only when required", () => {
    const r = evaluateBriefBeforeMake(
      {
        phase: "discover",
        designPrinciples: [{ id: "p", statement: "a", polarity: "prefer" }],
      },
      true,
    );
    assert.equal(r.allowed, false);
    assert.equal(r.code, "BRIEF_REQUIRED");
  });

  it("evaluateBriefBeforeMake allows brief with intent", () => {
    const r = evaluateBriefBeforeMake(
      { phase: "brief", intent: "phone case", designPrinciples: [] },
      true,
    );
    assert.equal(r.allowed, true);
  });
});
