"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isMillrectProjectJson } = require("../../packages/project-json");

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
});
