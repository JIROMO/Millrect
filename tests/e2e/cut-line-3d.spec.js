/**
 * cut-line-3d.spec.js
 * 設計契約:
 *  - role:"cut" 線は 2D 注釈であり 3D には影響しない（暗黙の切り取りは無い）。
 *  - 切り欠きは図形ジオメトリそのものに焼き込まれていれば 3D に反映される。
 */

"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Cut Line 3D");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.update3DScene),
  );
}

// 100mm 角 × 2mm 厚の平板。top レイヤーの図形群を渡す。
function buildPlateState(topShapes) {
  const state = getState();
  const topPage = state.pages[0];
  Object.assign(topPage, {
    name: "上面図",
    scale: { numerator: 1, denominator: 1 },
    viewDefinition: { type: "top", normal: [0, 0, 1], up: [0, 1, 0] },
    layers: [
      {
        id: "layer-top",
        name: "top",
        visible: true,
        locked: false,
        shapes: topShapes,
      },
    ],
  });
  const frontPage = createPage({
    name: "正面図",
    paper: "A4",
    orientation: "landscape",
    scale: { numerator: 1, denominator: 1 },
    viewDefinition: { type: "front", normal: [0, -1, 0], up: [0, 0, 1] },
    layers: [
      {
        id: "layer-front",
        name: "front",
        visible: true,
        locked: false,
        shapes: [
          {
            id: "plate-front",
            type: "rect",
            x: 100,
            y: 100,
            width: 1000,
            height: 20, // 2mm thickness
            stroke: "#14213d",
            fill: "#ffb347",
            strokeWidth: "medium",
          },
        ],
      },
    ],
  });
  state.pages = [topPage, frontPage];
  replaceState(state);
  render();
  uiUpdate();
  const canvas = document.getElementById("canvas-3d");
  if (!window._3scene) init3DView(canvas);
  update3DScene();
}

const PLATE_RECT = {
  id: "plate-top",
  type: "rect",
  x: 100,
  y: 100,
  width: 1000,
  height: 1000,
  stroke: "#14213d",
  fill: "#8fb7ff",
  strokeWidth: "medium",
};

// 右辺に矩形ノッチを焼き込んだ path（rect 相当の外形から切り欠き済み）。
const NOTCHED_PATH = {
  id: "plate-top",
  type: "path",
  contours: [
    [
      [
        [100, 100],
        [1100, 100],
        [1100, 550],
        [900, 550],
        [900, 650],
        [1100, 650],
        [1100, 1100],
        [100, 1100],
      ],
    ],
  ],
  stroke: "#14213d",
  fill: "#8fb7ff",
  strokeWidth: "medium",
};

function meshVolume() {
  let vol = 0;
  for (const mesh of _3meshes) {
    mesh.updateMatrixWorld(true);
    const pos = mesh.geometry.attributes.position;
    const m = mesh.matrixWorld;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(m);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, i + 2).applyMatrix4(m);
      vol += a.dot(b.clone().cross(c)) / 6;
    }
  }
  return Math.abs(vol);
}

test.describe("cut の 3D 反映ルール", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test('role:"cut" 線は 3D に影響しない', async ({ page }) => {
    const cut = {
      id: "cut-1",
      type: "line",
      role: "cut",
      x1: 100,
      y1: 600,
      x2: 1100,
      y2: 600,
      stroke: "#2563eb",
      strokeWidth: "thin",
    };
    const result = await page.evaluate(
      ({ buildSrc, volSrc, plate, cut }) => {
        eval(`(${buildSrc})([${JSON.stringify(plate)}])`);
        const plain = eval(`(${volSrc})()`);
        eval(
          `(${buildSrc})([${JSON.stringify(plate)}, ${JSON.stringify(cut)}])`,
        );
        const withCutLine = eval(`(${volSrc})()`);
        return { plain, withCutLine, meshCount: _3meshes.length };
      },
      {
        buildSrc: buildPlateState.toString(),
        volSrc: meshVolume.toString(),
        plate: PLATE_RECT,
        cut,
      },
    );
    expect(result.meshCount).toBe(1);
    expect(result.plain).toBeGreaterThan(0);
    // 線を足しても体積は変わらない（暗黙の切り取りは無い）
    expect(Math.abs(result.withCutLine - result.plain)).toBeLessThan(
      result.plain * 1e-3,
    );
  });

  test("図形ジオメトリに焼き込まれた切り欠きは 3D に反映される", async ({
    page,
  }) => {
    const result = await page.evaluate(
      ({ buildSrc, volSrc, plate, notched }) => {
        eval(`(${buildSrc})([${JSON.stringify(plate)}])`);
        const plain = eval(`(${volSrc})()`);
        eval(`(${buildSrc})([${JSON.stringify(notched)}])`);
        const notchedVol = eval(`(${volSrc})()`);
        return { plain, notchedVol, meshCount: _3meshes.length };
      },
      {
        buildSrc: buildPlateState.toString(),
        volSrc: meshVolume.toString(),
        plate: PLATE_RECT,
        notched: NOTCHED_PATH,
      },
    );
    expect(result.meshCount).toBe(1);
    expect(result.plain).toBeGreaterThan(0);
    // ノッチの分だけ体積が減る
    expect(result.notchedVol).toBeGreaterThan(0);
    expect(result.notchedVol).toBeLessThan(result.plain);
  });
});
