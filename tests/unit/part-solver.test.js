"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resizeRectCentered,
  syncParamBindConstraints,
  buildProfileBindings,
  targetSizesReal,
  applyParamBindSolver,
  installDslConstraints,
  buildPartIntentRecord,
} = require("../../packages/part-solver");
const { compilePartDsl } = require("../../packages/part-dsl");

function mockPages() {
  return [
    {
      id: "p-top",
      viewDefinition: { type: "top" },
      layers: [
        {
          id: "l1",
          shapes: [
            {
              id: "top-rect",
              type: "rect",
              x: 100,
              y: 100,
              width: 1200,
              height: 800,
              stroke: "#000",
              fill: "#fff",
            },
          ],
        },
      ],
    },
    {
      id: "p-front",
      viewDefinition: { type: "front" },
      layers: [
        {
          id: "l2",
          shapes: [
            {
              id: "front-rect",
              type: "rect",
              x: 200,
              y: 200,
              width: 1200,
              height: 500,
              stroke: "#000",
              fill: "#fff",
            },
          ],
        },
      ],
    },
  ];
}

describe("part-solver", () => {
  it("resizeRectCentered — 中心固定", () => {
    const r = { x: 0, y: 0, width: 100, height: 50 };
    resizeRectCentered(r, 200, 100);
    assert.equal(r.width, 200);
    assert.equal(r.height, 100);
    assert.equal(r.x, -50);
    assert.equal(r.y, -25);
  });

  it("targetSizesReal — W/D/H → real units", () => {
    const sizes = targetSizesReal("box", { W: 100, D: 60, H: 40 });
    assert.equal(sizes.top.width, 1000);
    assert.equal(sizes.top.height, 600);
  });

  it("targetSizesReal — panel W/H", () => {
    const sizes = targetSizesReal("panel", { W: 200, H: 100 });
    assert.equal(sizes.top.width, 2000);
    assert.equal(sizes.top.height, 1000);
  });

  it("applyParamBindSolver — W 変更で top/front をリサイズ", () => {
    const pages = mockPages();
    const state = { pages };
    const partIntent = {
      dsl: { part: "box", params: { W: 150, D: 60, H: 40 } },
      bindings: buildProfileBindings(pages, "box"),
      paramConstraints: [],
      features: [],
    };
    const r = applyParamBindSolver(state, partIntent);
    assert.equal(r.ok, true);
    assert.equal(pages[0].layers[0].shapes[0].width, 1500);
    assert.equal(pages[1].layers[0].shapes[0].width, 1500);
    assert.equal(pages[0].layers[0].shapes[0].height, 600);
  });

  it("installDslConstraints — view 参照で page.constraints に追加", () => {
    const pages = mockPages();
    const state = { pages };
    const bindings = buildProfileBindings(pages);
    const installed = installDslConstraints(
      state,
      [{ type: "fixed", view: "top", params: { x: 0, y: 0 } }],
      bindings,
      (p) => `${p}-1`,
    );
    assert.equal(installed.length, 1);
    assert.equal(pages[0].constraints[0].type, "fixed");
    assert.deepEqual(pages[0].constraints[0].shapeIds, ["top-rect"]);
  });

  it("buildPartIntentRecord — compile 結果から intent 生成", () => {
    const compiled = compilePartDsl({
      part: "box",
      params: { W: 100, D: 60, H: 40 },
      views: ["top", "front"],
    });
    const pages = mockPages();
    const intent = buildPartIntentRecord(
      compiled.dsl,
      compiled,
      { pages },
      compiled.buildOptions,
    );
    assert.equal(intent.dsl.params.W, 100);
    assert.ok(intent.bindings.top);
    assert.ok(intent.paramConstraints.length >= 3);
  });

  it("syncParamBindConstraints — param 値を同期", () => {
    const synced = syncParamBindConstraints(
      [{ kind: "param_bind", param: "W", value: 100, binds: [{ mm: 100 }] }],
      { W: 200, D: 60, H: 40 },
    );
    assert.equal(synced[0].value, 200);
    assert.equal(synced[0].binds[0].mm, 200);
  });
});
