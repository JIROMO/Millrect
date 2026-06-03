"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { SAMPLE_CATALOG } = require("../../packages/sample-catalog");
const { compilePartDsl } = require("../../packages/part-dsl");

describe("sample-catalog", () => {
  it("has unique sample ids", () => {
    const ids = SAMPLE_CATALOG.map((entry) => entry.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("partDsl entries compile successfully", () => {
    for (const entry of SAMPLE_CATALOG) {
      if (entry.type !== "partDsl") continue;
      const plan = compilePartDsl(entry.dsl);
      assert.equal(
        plan.ok,
        true,
        `${entry.id}: ${plan.error || "compile failed"}`,
      );
    }
  });

  it("multiview starter-box has multiview fit", () => {
    const starter = SAMPLE_CATALOG.find((entry) => entry.id === "starter-box");
    assert.ok(starter);
    assert.equal(starter.type, "multiview");
    assert.equal(starter.fitView, "multiview");
  });
});
