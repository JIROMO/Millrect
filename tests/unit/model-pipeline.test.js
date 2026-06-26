"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const schema = require("../../packages/schema");
const {
  generateModelIrFromProject,
} = require("../../packages/model-generator");
const { generateGeometryFromModelIr } = require("../../packages/geometry-core");

function stable(value) {
  return schema.stableStringify(value);
}

const MINIMAL_PROJECT = {
  projectName: "test",
  unit: "mm",
  pages: [
    {
      id: "page-top",
      name: "Top",
      paper: "A4",
      orientation: "landscape",
      scale: { numerator: 1, denominator: 10 },
      viewDefinition: { type: "top", normal: null, up: null },
      dimensions: [],
      layers: [
        {
          id: "layer-1",
          name: "Layer 1",
          visible: true,
          locked: false,
          shapes: [
            {
              id: "shape-rect",
              type: "rect",
              x: 0,
              y: 0,
              width: 1200,
              height: 800,
              stroke: "#1a1a2e",
              fill: "#ffffff",
              strokeWidth: "thin",
            },
          ],
        },
      ],
    },
    {
      id: "page-front",
      name: "Front",
      paper: "A4",
      orientation: "landscape",
      scale: { numerator: 1, denominator: 10 },
      viewDefinition: { type: "front", normal: null, up: null },
      dimensions: [],
      layers: [
        {
          id: "layer-2",
          name: "Layer 1",
          visible: true,
          locked: false,
          shapes: [
            {
              id: "shape-rect-2",
              type: "rect",
              x: 0,
              y: 0,
              width: 1200,
              height: 500,
              stroke: "#1a1a2e",
              fill: "#ffffff",
              strokeWidth: "thin",
            },
          ],
        },
      ],
    },
  ],
};

describe("model pipeline", () => {
  it("validates a minimal project JSON", () => {
    assert.equal(schema.isMillrectProjectJson(MINIMAL_PROJECT), true);
  });

  it("generates the same Model IR from the same Project JSON", () => {
    const first = generateModelIrFromProject(MINIMAL_PROJECT);
    const second = generateModelIrFromProject(MINIMAL_PROJECT);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(stable(first.ir), stable(second.ir));
  });

  it("generates the same geometry data from the same Model IR", () => {
    const ir = generateModelIrFromProject(MINIMAL_PROJECT).ir;
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
