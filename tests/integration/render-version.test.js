"use strict";

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { bootApp } = require("../harness/boot");

describe("render version tracking", () => {
  it("pushHistory bumps the document and changed shape render versions", () => {
    const app = bootApp();
    const startDocVersion = app.getDocumentRenderVersion();

    app.addShape({
      id: "r1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fill: "none",
      stroke: "#111",
    });

    const afterAddDocVersion = app.getDocumentRenderVersion();
    const afterAddShapeVersion = app.getShapeRenderVersion("r1");
    assert.ok(afterAddDocVersion > startDocVersion);
    assert.ok(afterAddShapeVersion > 0);

    app.updateShape("r1", { width: 120 });
    assert.ok(app.getDocumentRenderVersion() > afterAddDocVersion);
    assert.ok(app.getShapeRenderVersion("r1") > afterAddShapeVersion);
  });

  it("undo marks the reverted shape dirty for renderer reconciliation", () => {
    const app = bootApp();
    app.addShape({
      id: "r1",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fill: "none",
      stroke: "#111",
    });
    app.updateShape("r1", { width: 120 });

    const beforeUndoShapeVersion = app.getShapeRenderVersion("r1");
    assert.equal(app.undo(), true);

    assert.equal(app.findShapeById("r1").shape.width, 100);
    assert.ok(app.getShapeRenderVersion("r1") > beforeUndoShapeVersion);
  });
});
