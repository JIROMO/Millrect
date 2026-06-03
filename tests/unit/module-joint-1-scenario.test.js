"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildModuleJoint1ProjectState,
  moduleJoint1DimensionShapes,
  moduleJoint1Layout,
  moduleJoint1PathShape,
  moduleJoint1SlotRects,
  MODULE_JOINT_1_MM,
} = require("../../packages/module-joint-1-scenario");

const MJ_REAL_PER_MM = 10;

function moduleJoint1AllRings() {
  return moduleJoint1PathShape().contours.flat();
}

describe("module-joint-1-scenario", () => {
  it("defines 18 cut slots from each edge to the hole center", () => {
    const { ox, w } = moduleJoint1Layout();
    const slots = moduleJoint1SlotRects();
    assert.equal(slots.length, 18);

    const midX = ox + w / 2;
    for (const slot of slots) {
      const xs = slot[0].map((p) => p[0]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const cx = (minX + maxX) / 2;
      if (cx < midX) {
        // 左列: 端(0以下) から 左穴中心(6mm) まで
        assert.ok(minX <= ox, "left slot should start at/over the left edge");
        assert.ok(Math.abs(maxX - (ox + 6 * MJ_REAL_PER_MM)) < 1);
      } else {
        // 右列: 右穴中心(18mm) から 端(24mm以上) まで
        assert.ok(Math.abs(minX - (ox + 18 * MJ_REAL_PER_MM)) < 1);
        assert.ok(maxX >= ox + w, "right slot should reach the right edge");
      }
    }
  });

  it("bakes the keyhole cuts into the outline geometry (no enclosed holes)", () => {
    const path = moduleJoint1PathShape();
    // 全穴がスロットで端に開口するため、囲われた穴（内側リング）は残らない
    let innerRings = 0;
    for (const poly of path.contours) innerRings += poly.length - 1;
    assert.equal(innerRings, 0, "all holes should open to an edge (keyholes)");
  });

  it("uses Ø6 (R3) end-edge notches, distinct from the R2 corners", () => {
    const { ox, oy } = moduleJoint1Layout();
    const notchR = (MODULE_JOINT_1_MM.notchDiameter / 2) * MJ_REAL_PER_MM; // 30
    const cornerR = MODULE_JOINT_1_MM.radius * MJ_REAL_PER_MM; // 20
    assert.notEqual(notchR, cornerR, "notch and corner radii must differ");

    // 上端ノッチは n1=6mm / n2=18mm の中心で深さ R3 (=30 real) まで入り込む
    const rings = moduleJoint1AllRings();
    for (const nMm of [6, 18]) {
      const cx = ox + nMm * MJ_REAL_PER_MM;
      const apex = rings.some((ring) =>
        ring.some(
          ([x, y]) =>
            Math.abs(x - cx) < 0.6 && Math.abs(y - (oy + notchR)) < 0.6,
        ),
      );
      assert.ok(apex, `top notch apex at x=${nMm}mm should reach depth R3`);
    }
  });

  it("places small dimensions outside the part where possible", () => {
    const { ox, oy } = moduleJoint1Layout();
    const dims = Object.fromEntries(
      moduleJoint1DimensionShapes().map((dim) => [dim.id, dim]),
    );

    assert.ok(
      dims["module-joint-1-dim-h"].from.x +
        dims["module-joint-1-dim-h"].offset <
        ox,
    );
    assert.ok(
      dims["module-joint-1-dim-pitch"].from.x +
        dims["module-joint-1-dim-pitch"].offset <
        ox,
    );
    assert.ok(
      dims["module-joint-1-dim-hole"].from.y +
        dims["module-joint-1-dim-hole"].offset <
        oy,
    );
  });

  it("describes edge cut-ins without implying a center line", () => {
    const state = buildModuleJoint1ProjectState();
    const note = state.pages[0].layers
      .flatMap((layer) => layer.shapes)
      .find((shape) => shape.id === "module-joint-1-note");

    assert.match(note.text, /端部/);
    assert.doesNotMatch(note.text, /すべて/);
  });
});
