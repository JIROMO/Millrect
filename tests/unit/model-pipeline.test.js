"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const schema = require("../../packages/schema");
const {
  generateModelIrFromProject,
} = require("../../packages/model-generator");
const { generateGeometryFromModelIr } = require("../../packages/geometry-core");

const ROOT = path.resolve(__dirname, "../..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function stable(value) {
  return schema.stableStringify(value);
}

describe("model pipeline", () => {
  it("loads every existing sample project JSON", () => {
    const sampleDir = path.join(ROOT, "samples");
    const sampleFiles = fs
      .readdirSync(sampleDir)
      .filter((file) => file.endsWith(".json") && file !== "catalog.json")
      .sort();
    assert.ok(sampleFiles.length > 0);
    for (const file of sampleFiles) {
      const project = readJson(`samples/${file}`);
      assert.equal(
        schema.isMillrectProjectJson(project),
        true,
        `${file} should be a Millrect project JSON`,
      );
    }
  });

  it("generates the same Model IR from the same Project JSON", () => {
    const project = readJson("samples/starter-box.json");
    const first = generateModelIrFromProject(project);
    const second = generateModelIrFromProject(project);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(stable(first.ir), stable(second.ir));
  });

  it("generates the same geometry data from the same Model IR", () => {
    const project = readJson("samples/starter-box.json");
    const ir = generateModelIrFromProject(project).ir;
    const first = generateGeometryFromModelIr(ir);
    const second = generateGeometryFromModelIr(ir);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(stable(first.data), stable(second.data));
  });

  it("validates editable operations such as threaded holes and chamfers", () => {
    const ir = {
      kind: "millrect.model-ir",
      schemaVersion: schema.MODEL_IR_VERSION,
      units: "mm",
      source: { projectName: "manual" },
      dimensions: { width: 40, depth: 30, height: 8 },
      profiles: [
        {
          id: "profile-base",
          pageId: "page-top",
          viewType: "top",
          rings: [
            [
              [0, 0],
              [400, 0],
              [400, 300],
              [0, 300],
            ],
          ],
          bbox: { x: 0, y: 0, w: 400, h: 300 },
        },
      ],
      operations: [
        {
          id: "op-extrude-base",
          type: "extrude",
          profileId: "profile-base",
          height: 8,
        },
        {
          id: "op-thread-m4",
          type: "threaded_hole",
          standard: "M4",
          position: { x: 20, y: 15 },
          depth: 6,
          through: false,
        },
        {
          id: "op-chamfer-front",
          type: "chamfer",
          distance: 1,
          target: "front_edges",
        },
      ],
    };
    assert.equal(schema.validateModelIr(ir).ok, true);
    assert.equal(generateGeometryFromModelIr(ir).ok, true);
  });
});
