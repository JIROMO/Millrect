/**
 * stl-validation.spec.js — STL 出力前メッシュ検証
 */

"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("STL Validation");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.validateMeshesForExport),
  );
}

test.describe("STL 出力前検証", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("メッシュなしでは validateMeshesForExport が ok:false", async ({
    page,
  }) => {
    const result = await page.evaluate(() => validateMeshesForExport(_3meshes));
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test("立方体メッシュは validateMeshesForExport が ok:true", async ({
    page,
  }) => {
    await page.evaluate(() => {
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
            shapes: [
              {
                id: "top-s",
                type: "rect",
                x: 100,
                y: 100,
                width: 1000,
                height: 1000,
                stroke: "#14213d",
                fill: "#8fb7ff",
                strokeWidth: "medium",
              },
            ],
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
                id: "front-s",
                type: "rect",
                x: 100,
                y: 100,
                width: 1000,
                height: 1000,
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
    });

    const result = await page.evaluate(() => {
      return {
        status: get3DSceneStatus(),
        validation: validateMeshesForExport(_3meshes),
      };
    });
    expect(result.status.meshCount).toBe(1);
    expect(result.validation.ok).toBe(true);
  });
});
