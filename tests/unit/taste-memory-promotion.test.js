"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
require("../../packages/taste-memory");
const {
  reinforceProjectPrinciplesIntoGlobal,
  promoteStatementToGlobal,
  copyGlobalPrinciplesForProject,
  PROMOTE_PROJECT_THRESHOLD,
} = require("../../packages/taste-memory-promotion");

describe("taste-memory-promotion", () => {
  it("does not promote on first project only", () => {
    const g = { version: 1, principles: [], pending: [], antiPatterns: [] };
    const brief = {
      designPrinciples: [
        { id: "p1", statement: "曲線は少なめ", polarity: "prefer" },
      ],
    };
    const { global, promoted } = reinforceProjectPrinciplesIntoGlobal(
      g,
      brief,
      "proj-a",
    );
    assert.equal(promoted.length, 0);
    assert.equal(global.principles.length, 0);
    assert.equal(global.pending.length, 1);
    assert.equal(global.pending[0].projectIds.length, 1);
  });

  it("promotes after second distinct project", () => {
    let g = { version: 1, principles: [], pending: [], antiPatterns: [] };
    const brief = {
      designPrinciples: [
        { id: "p1", statement: "曲線は少なめ", polarity: "prefer" },
      ],
    };
    g = reinforceProjectPrinciplesIntoGlobal(g, brief, "proj-a").global;
    const r2 = reinforceProjectPrinciplesIntoGlobal(g, brief, "proj-b");
    assert.equal(r2.promoted.length, 1);
    assert.equal(r2.global.principles.length, 1);
    assert.equal(
      r2.global.principles[0].evidenceCount,
      PROMOTE_PROJECT_THRESHOLD,
    );
  });

  it("manual promote adds to principles", () => {
    const g = { version: 1, principles: [], pending: [], antiPatterns: [] };
    const r = promoteStatementToGlobal(
      g,
      { statement: "構造美を優先", polarity: "prefer" },
      "proj-x",
    );
    assert.equal(r.ok, true);
    assert.equal(r.global.principles.length, 1);
  });

  it("copyGlobalPrinciplesForProject strips global metadata", () => {
    const g = {
      version: 1,
      principles: [
        {
          id: "gp1",
          statement: "道具感",
          polarity: "prefer",
          evidenceCount: 2,
          projectIds: ["a", "b"],
          lastReinforced: "2026-01-01",
        },
      ],
      pending: [],
      antiPatterns: [],
    };
    const copies = copyGlobalPrinciplesForProject(g);
    assert.equal(copies.length, 1);
    assert.equal(copies[0].statement, "道具感");
    assert.equal(copies[0].evidenceCount, undefined);
  });
});
