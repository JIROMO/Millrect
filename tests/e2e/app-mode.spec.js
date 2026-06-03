/**
 * app-mode.spec.js — 本体アプリの 2D/3D モード切替
 * 3D はサンプルではなく、現在の 2D 図面から生成する。
 */
"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Drawing 3D Mode Test");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.setAppMode && window.getState && window.update3DScene),
  );
}

async function installSingleViewPlate(page) {
  await page.evaluate(() => {
    const state = getState();
    const page = getCurrentPage();
    const outer = [
      [100, 100],
      [1100, 100],
      [1100, 700],
      [100, 700],
    ];
    const hole = Array.from({ length: 64 }, (_, i) => {
      const a = (2 * Math.PI * (63 - i)) / 64;
      return [600 + 100 * Math.cos(a), 400 + 100 * Math.sin(a)];
    });
    Object.assign(page, {
      name: "上面図",
      paper: "A4",
      orientation: "landscape",
      scale: { numerator: 1, denominator: 1 },
      viewDefinition: { type: "top", normal: [0, 0, 1], up: [0, 1, 0] },
      dimensions: [],
      constraints: [],
      layers: [
        {
          id: "plate-layer",
          name: "plate",
          visible: true,
          locked: false,
          shapes: [
            {
              id: "plate-outline",
              type: "path",
              contours: [[outer, hole]],
              stroke: "#14213d",
              fill: "#8fb7ff",
              strokeWidth: "medium",
            },
          ],
        },
      ],
    });
    state.partIntent = {
      id: "single_view_plate",
      kind: "flat_plate",
      units: "mm",
      params: { T: 2 },
    };
    state.currentPageId = page.id;
    state.currentLayerId = "plate-layer";
    state.selectedShapeIds = ["plate-outline"];
    render();
    uiUpdate();
  });
}

async function installOffsetTopRightBox(page) {
  await page.evaluate(() => {
    const state = getState();
    const topPage = state.pages[0];
    Object.assign(topPage, {
      name: "上面図",
      paper: "A4",
      orientation: "landscape",
      scale: { numerator: 1, denominator: 1 },
      viewDefinition: { type: "top", normal: [0, 0, 1], up: [0, 1, 0] },
      dimensions: [],
      constraints: [],
      layers: [
        {
          id: "layer-top",
          name: "top",
          visible: true,
          locked: false,
          shapes: [
            {
              id: "top-offset-rect",
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
    const rightPage = createPage({
      name: "右側面図",
      paper: "A4",
      orientation: "landscape",
      scale: { numerator: 1, denominator: 1 },
      viewDefinition: { type: "right", normal: [1, 0, 0], up: [0, 0, 1] },
      layers: [
        {
          id: "layer-right",
          name: "right",
          visible: true,
          locked: false,
          shapes: [
            {
              id: "right-offset-rect",
              type: "rect",
              x: 2300,
              y: 1600,
              width: 800,
              height: 500,
              stroke: "#14213d",
              fill: "#ffb347",
              strokeWidth: "medium",
            },
          ],
        },
      ],
    });
    state.pages = [topPage, rightPage];
    state.currentPageId = topPage.id;
    state.currentLayerId = "layer-top";
    state.selectedShapeIds = [];
    replaceState(state);
    render();
    uiUpdate();
  });
}

async function enter3D(page) {
  await page.locator("#btn-mode-3d").click();
  await expect(page.locator("#app")).toHaveClass(/mode-3d/);
  await expect(page.locator("#panel-3d")).toBeVisible();
  await page.waitForFunction(() => get3DSceneStatus().meshCount > 0, {
    timeout: 15000,
  });
}

async function meshSize(page) {
  return page.evaluate(() => {
    const box = new THREE.Box3();
    for (const mesh of _3meshes) {
      mesh.updateMatrixWorld(true);
      box.union(new THREE.Box3().setFromObject(mesh));
    }
    const size = new THREE.Vector3();
    box.getSize(size);
    return size.toArray();
  });
}

test.describe("2D / 3D モード切替", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewProject(page);
  });

  test("3D は現在の2D図面を薄板として表示し、ナビに active CSS が当たる", async ({
    page,
  }) => {
    await installSingleViewPlate(page);
    await enter3D(page);

    await expect(page.locator("#btn-mode-3d")).toHaveClass(/active/);
    await expect(page.locator("#btn-mode-3d")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#btn-mode-3d")).toHaveCSS(
      "background-color",
      "rgb(37, 99, 235)",
    );
    await expect(page.locator("#btn-mode-2d")).not.toHaveClass(/active/);
    await expect(page.locator("#canvas-area")).toBeHidden();
    await expect(page.locator("#canvas-3d")).toBeVisible();

    const sorted = (await meshSize(page)).sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThan(1.5);
    expect(sorted[0]).toBeLessThan(2.5);
    expect(sorted[2]).toBeGreaterThan(90);

    await page.locator("#btn-mode-2d").click();
    await expect(page.locator("#app")).not.toHaveClass(/mode-3d/);
    await expect(page.locator("#panel-3d")).toBeHidden();
    await expect(page.locator("#btn-mode-2d")).toHaveClass(/active/);
    await expect(page.locator("#btn-mode-2d")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#btn-mode-3d")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator("#canvas-area")).toBeVisible();
  });

  test("Module Joint 1 は現在図面由来の薄板3Dになる", async ({ page }) => {
    await page.evaluate(() => {
      replaceState(buildModuleJoint1ProjectState("Module Joint 1"));
      render();
      uiUpdate();
    });
    await enter3D(page);

    const sorted = (await meshSize(page)).sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThan(1.5);
    expect(sorted[0]).toBeLessThan(2.5);
    expect(sorted[1]).toBeGreaterThan(20);
    expect(sorted[2]).toBeGreaterThan(90);
  });

  test("上面図と右側面図の紙面座標がずれていても3Dを生成する", async ({
    page,
  }) => {
    await installOffsetTopRightBox(page);
    await enter3D(page);

    const sorted = (await meshSize(page)).sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThan(49);
    expect(sorted[0]).toBeLessThan(51);
    expect(sorted[1]).toBeGreaterThan(79);
    expect(sorted[1]).toBeLessThan(81);
    expect(sorted[2]).toBeGreaterThan(99);
    expect(sorted[2]).toBeLessThan(101);
  });

  test("3D モードの STL ボタンは現在図面のメッシュを書き出す", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());
    await installSingleViewPlate(page);
    await enter3D(page);
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.locator("#btn-export-stl").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /Drawing 3D Mode Test.*\.stl$/,
    );
  });

  test("印刷モードは紙面だけを等倍表示し、編集UIを印刷対象から外す", async ({
    page,
  }) => {
    await installSingleViewPlate(page);

    await page.locator("#btn-print-mode").click();
    await expect(page.locator("#app")).toHaveClass(/mode-print/);
    await expect(page.locator("#toolbar")).toBeHidden();
    await expect(page.locator("#sidebar-left")).toBeHidden();
    await expect(page.locator("#sidebar-right")).toBeHidden();
    await expect(page.locator("#zoom-controls")).toBeHidden();
    await expect(page.locator("#print-mode-bar")).toBeVisible();
    await expect(page.locator("#btn-print-mode")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.waitForFunction(() => {
      const svg = document.getElementById("main-svg");
      const vp = document.getElementById("vp");
      return (
        svg?.getAttribute("viewBox") === "0 0 297 210" &&
        vp?.getAttribute("transform") === "translate(0,0) scale(1)"
      );
    });
    await expect(page.locator("#grid")).toHaveCount(0);
    await expect(page.locator("#sel-handles")).toHaveCount(0);

    const printVars = await page.evaluate(() => ({
      w: document.documentElement.style.getPropertyValue("--print-paper-width"),
      h: document.documentElement.style.getPropertyValue(
        "--print-paper-height",
      ),
      pageStyle: document.getElementById("millrect-print-page-style")
        ?.textContent,
    }));
    expect(printVars).toEqual({
      w: "297mm",
      h: "210mm",
      pageStyle: "@page { size: A4 landscape; margin: 0; }",
    });

    await page.locator("#print-mode-exit").click();
    await expect(page.locator("#app")).not.toHaveClass(/mode-print/);
    await expect(page.locator("#toolbar")).toBeVisible();
    await expect(page.locator("#btn-print-mode")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.waitForFunction(
      () => !document.getElementById("main-svg")?.hasAttribute("viewBox"),
    );
  });

  test("Cmd/Ctrl+P は印刷モードをトグルし、ネイティブ print は呼ばない", async ({
    page,
  }) => {
    await installSingleViewPlate(page);
    await page.evaluate(() => {
      window.__printCallCount = 0;
      Object.defineProperty(window, "print", {
        configurable: true,
        value: () => {
          window.__printCallCount += 1;
        },
      });
    });

    const shortcut = process.platform === "darwin" ? "Meta+P" : "Control+P";

    // 1回目: 印刷モードに入る（ネイティブ印刷ダイアログは出さない）
    await page.keyboard.press(shortcut);
    await expect(page.locator("#app")).toHaveClass(/mode-print/);
    await expect(page.locator("#btn-print-mode")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // 2回目: 印刷モードを抜ける（トグル）
    await page.keyboard.press(shortcut);
    await expect(page.locator("#app")).not.toHaveClass(/mode-print/);

    // ネイティブ print() は一度も呼ばれない
    expect(await page.evaluate(() => window.__printCallCount)).toBe(0);
  });
});
