"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Model Pipeline");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(
      window.getState?.() &&
      window.get3DModelPipelineState &&
      window.generateModelIrFromProject,
    ),
  );
}

test.describe("Model pipeline wrapper", () => {
  test("keeps legacy 3D display while exposing Model IR and geometry data", async ({
    page,
  }) => {
    await openNewProject(page);

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
                height: 800,
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
                height: 500,
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
      init3DView(document.getElementById("canvas-3d"));
      update3DScene();
    });

    const result = await page.evaluate(() => ({
      status: get3DSceneStatus(),
      pipeline: get3DModelPipelineState(),
    }));

    expect(result.status.meshCount).toBe(1);
    expect(result.pipeline.ok).toBe(true);
    expect(
      result.pipeline.modelIr.operations.some((op) => op.type === "extrude"),
    ).toBe(true);
    expect(result.pipeline.geometryData.meshes.length).toBe(1);
  });
});
