"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isMillrectProjectJson,
  normalizeProjectUpdatedAt,
  resolveImportedProjectUpdatedAt,
} = require("../../packages/project-json");

describe("project-json", () => {
  const valid = {
    projectName: "box",
    unit: "mm",
    pages: [
      {
        id: "page-1",
        layers: [{ id: "layer-1", shapes: [] }],
      },
    ],
  };

  it("accepts minimal valid project", () => {
    assert.equal(isMillrectProjectJson(valid), true);
  });

  it("rejects package.json-like objects", () => {
    assert.equal(
      isMillrectProjectJson({ name: "millrect", version: "0.2.0" }),
      false,
    );
  });

  it("rejects missing pages", () => {
    assert.equal(isMillrectProjectJson({ projectName: "x" }), false);
    assert.equal(isMillrectProjectJson({ pages: [] }), false);
  });

  it("rejects page without layers", () => {
    assert.equal(
      isMillrectProjectJson({ pages: [{ id: "page-1", layers: [] }] }),
      false,
    );
  });

  it("rejects layer without shapes array", () => {
    assert.equal(
      isMillrectProjectJson({
        pages: [{ id: "page-1", layers: [{ id: "layer-1" }] }],
      }),
      false,
    );
  });

  it("normalizes imported updatedAt values without replacing them with import time", () => {
    assert.equal(normalizeProjectUpdatedAt(1_725_000_000_123), 1_725_000_000_123);
    assert.equal(normalizeProjectUpdatedAt(1_725_000_000), 1_725_000_000_000);
    assert.equal(
      normalizeProjectUpdatedAt("2024-08-30T12:34:56.000Z"),
      Date.parse("2024-08-30T12:34:56.000Z"),
    );
    assert.equal(
      normalizeProjectUpdatedAt("invalid", "1725000000"),
      1_725_000_000_000,
    );
  });

  it("returns null when no imported updatedAt candidate is valid", () => {
    assert.equal(normalizeProjectUpdatedAt(undefined, "", "invalid"), null);
  });

  it("recognizes updatedat aliases from backup and project data", () => {
    assert.equal(
      resolveImportedProjectUpdatedAt(
        { updatedat: "2024-01-02T03:04:05Z" },
        {},
        {},
        99,
      ),
      Date.parse("2024-01-02T03:04:05Z"),
    );
    assert.equal(
      resolveImportedProjectUpdatedAt(
        {},
        { updated_at: "1725000000" },
        {},
        99,
      ),
      1_725_000_000_000,
    );
  });
});
