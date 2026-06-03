/**
 * docs-screenshots.spec.js — ドキュメント用多ビューシナリオと HTML ページ検証
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  DOC_BOX,
  DOC_BOX_MM,
  DOC_DOCS_BOX,
  DOC_DOCS_MM,
  applyMultiviewBoxScenario,
  applyMultiviewDocsBoxScenario,
  applyDrawingFeaturesScenario,
  fitPageView,
  focusDrawingFeaturesView,
  switchToPage,
  waitForShapeInSvg,
  waitFor3DMesh,
} = require("../../scripts/docs-multiview-scenario");

const appUrl = "/app/index.html";
const docsDir = path.join(__dirname, "../../docs");
const docsUrl = (file) => `/docs/${file}`;

const DOC_PAGES = [
  "index.html",
  "getting-started.html",
  "atlas.html",
  "interface.html",
  "drawing.html",
  "editing.html",
  "multiview-3d.html",
  "export.html",
  "shortcuts.html",
  "ai-mcp.html",
];

const EN_DOC_PAGES = DOC_PAGES;

async function openNewProject(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Docs Scenario");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.createPage && window.update3DScene),
  );
}

test.describe("ドキュメント HTML ページ", () => {
  for (const file of DOC_PAGES) {
    test(`${file} — 画像がすべて読み込める`, async ({ page }) => {
      await page.goto(docsUrl(file));
      await page.waitForLoadState("networkidle");
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.getAttribute("src")),
      );
      expect(broken, `broken images on ${file}`).toEqual([]);
    });
  }

  for (const file of EN_DOC_PAGES) {
    test(`en/${file} — 英語版画像がすべて読み込める`, async ({ page }) => {
      await page.goto(`/docs/en/${file}`);
      await page.waitForLoadState("networkidle");
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.getAttribute("src")),
      );
      expect(broken, `broken images on en/${file}`).toEqual([]);
    });
  }

  test("multiview-3d.html — 3D 関連画像をすべて参照", async ({ page }) => {
    await page.goto(docsUrl("multiview-3d.html"));
    const srcs = await page.evaluate(() =>
      [...document.images].map((img) => img.getAttribute("src")),
    );
    expect(srcs).toEqual(
      expect.arrayContaining([
        "images/multiview-top-drawing.png",
        "images/multiview-front-drawing.png",
        "images/3d-panel.png",
        "images/pages-add-view.png",
        "images/pages-multiview.png",
        "images/drawing-rect.png",
        "images/editing-multiselect.png",
        "images/drawing-features.png",
      ]),
    );
    expect(srcs).not.toContain("images/3d-preview.png");
  });

  test("atlas.html — Live Specimen が DSL を更新する", async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await page.goto(docsUrl("atlas.html"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#atlas-specimens .atlas-card")).toHaveCount(4);
    await expect(page.locator("#specimen-dsl")).toContainText('"W": 120');
    await expect(page.locator("#spec-holes-value")).toContainText("2×2");
    await expect(page.locator("#spec-holes-x")).toHaveCount(0);

    const widthHandle = page.locator('[data-drag-handle="width"]').first();
    await widthHandle.scrollIntoViewIfNeeded();
    const box = await widthHandle.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
    await page.mouse.up();

    await expect(page.locator("#specimen-dsl")).toContainText('"W": 170');
    await expect(page.locator("#specimen-dsl")).toContainText('"countX": 2');
    await expect(page.locator("#specimen-dsl")).toContainText('"countY": 2');
  });
});

test.describe("ドキュメント用 3D シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("120×80×50 mm 穴付きパネルが上面+正面+右側面から生成される（ドキュメント用）", async ({
    page,
  }) => {
    const { topPageId, frontPageId, sidePageId } = await page.evaluate(
      applyMultiviewDocsBoxScenario,
      DOC_DOCS_BOX,
    );

    await waitForShapeInSvg(page, DOC_DOCS_BOX.topShapeId);
    await waitFor3DMesh(page);

    const { meshCount, bounds } = await page.evaluate(() => {
      const status = get3DSceneStatus();
      if (!_3meshes.length)
        return { meshCount: status.meshCount, bounds: null };
      const box = new THREE.Box3();
      for (const mesh of _3meshes) {
        mesh.updateMatrixWorld(true);
        box.union(new THREE.Box3().setFromObject(mesh));
      }
      const size = new THREE.Vector3();
      box.getSize(size);
      const f = (v) => +v.toFixed(1);
      return {
        meshCount: status.meshCount,
        bounds: { x: f(size.x), y: f(size.y), z: f(size.z) },
      };
    });

    expect(meshCount).toBeGreaterThan(0);
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeCloseTo(120, 0);
    expect(bounds.y).toBeCloseTo(50, 0);
    expect(bounds.z).toBeCloseTo(80, 0);

    expect(topPageId).toBeTruthy();
    expect(frontPageId).toBeTruthy();
    expect(sidePageId).toBeTruthy();
  });

  test("120×80×50 mm 直方体が上面+正面から生成される", async ({ page }) => {
    const { topPageId, frontPageId } = await page.evaluate(
      applyMultiviewBoxScenario,
      DOC_BOX,
    );

    await waitForShapeInSvg(page, DOC_BOX.topShapeId);
    await waitFor3DMesh(page);

    const { meshCount, bounds } = await page.evaluate(() => {
      const status = get3DSceneStatus();
      if (!_3meshes.length)
        return { meshCount: status.meshCount, bounds: null };
      const box = new THREE.Box3();
      for (const mesh of _3meshes) {
        mesh.updateMatrixWorld(true);
        box.union(new THREE.Box3().setFromObject(mesh));
      }
      const size = new THREE.Vector3();
      box.getSize(size);
      const f = (v) => +v.toFixed(1);
      return {
        meshCount: status.meshCount,
        bounds: { x: f(size.x), y: f(size.y), z: f(size.z) },
      };
    });

    expect(meshCount).toBeGreaterThan(0);
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBeGreaterThan(100);
    expect(bounds.y).toBeGreaterThan(40);
    expect(bounds.z).toBeGreaterThan(70);

    expect(topPageId).toBeTruthy();
    expect(frontPageId).toBeTruthy();
  });

  test("上面図・正面ページに穴付きパネルの図形が SVG 上に存在する", async ({
    page,
  }) => {
    const { topPageId, frontPageId } = await page.evaluate(
      applyMultiviewDocsBoxScenario,
      DOC_DOCS_BOX,
    );

    await switchToPage(page, topPageId, DOC_DOCS_BOX.topShapeId);
    const topFill = await page.evaluate(
      (id) =>
        document
          .querySelector(`#main-svg [data-id="${id}"]`)
          ?.getAttribute("fill"),
      DOC_DOCS_BOX.topShapeId,
    );
    expect(topFill).toBe(DOC_DOCS_BOX.top.fill);

    await switchToPage(page, frontPageId, DOC_DOCS_BOX.frontShapeId);
    const frontFill = await page.evaluate(
      (id) =>
        document
          .querySelector(`#main-svg [data-id="${id}"]`)
          ?.getAttribute("fill"),
      DOC_DOCS_BOX.frontShapeId,
    );
    expect(frontFill).toBe(DOC_DOCS_BOX.front.fill);
  });

  test("上面図・正面の穴付きパネルがビューポート内に表示される", async ({
    page,
  }) => {
    const { topPageId, frontPageId } = await page.evaluate(
      applyMultiviewDocsBoxScenario,
      DOC_DOCS_BOX,
    );

    for (const [pid, sid] of [
      [topPageId, DOC_DOCS_BOX.topShapeId],
      [frontPageId, DOC_DOCS_BOX.frontShapeId],
    ]) {
      await switchToPage(page, pid, sid);
      const onScreen = await page.evaluate((id) => {
        const el = document.querySelector(`#main-svg [data-id="${id}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        return (
          r.width > 80 &&
          r.height > 40 &&
          r.right > 120 &&
          r.left < vw - 280 &&
          r.bottom > 60 &&
          r.top < vh - 40
        );
      }, sid);
      expect(onScreen, `shape ${sid} should be visible on screen`).toBe(true);
    }
  });

  test("作図サンプル（穴付きパネル + 寸法線）がビューポート内に表示される", async ({
    page,
  }) => {
    await page.evaluate(applyDrawingFeaturesScenario);
    await page.evaluate(focusDrawingFeaturesView);
    await waitForShapeInSvg(page, "feat-top");

    const info = await page.evaluate(() => {
      const el = document.querySelector('#main-svg [data-id="feat-top"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        dims: document.querySelectorAll("#dimension-root .dimension-group")
          .length,
      };
    });
    expect(info).toBeTruthy();
    expect(info.width).toBeGreaterThan(40);
    expect(info.height).toBeGreaterThan(24);
    expect(info.dims).toBeGreaterThanOrEqual(2);
  });

  test("drawing.html — 作図機能の画像を参照", async ({ page }) => {
    await page.goto(docsUrl("drawing.html"));
    const srcs = await page.evaluate(() =>
      [...document.images].map((img) => img.getAttribute("src")),
    );
    expect(srcs).toEqual(
      expect.arrayContaining([
        "images/drawing-features.png",
        "images/drawing-text.png",
        "images/tools-panel.png",
        "images/layers-panel.png",
        "images/sketch-digitize.png",
        "images/reference-image-panel.png",
      ]),
    );
  });

  test("docs 用スクリーンショット PNG が存在する", async () => {
    const imagesDir = path.join(docsDir, "images");
    const required = [
      "startup-dialog.png",
      "startup-new-form.png",
      "startup-project-list.png",
      "main-window.png",
      "drawing-rect.png",
      "drawing-features.png",
      "tools-panel.png",
      "design-panel.png",
      "design-panel-text.png",
      "drawing-text.png",
      "layers-panel.png",
      "history-panel.png",
      "taste-brief-panel.png",
      "editing-multiselect.png",
      "help-shortcuts.png",
      "multiview-top-drawing.png",
      "multiview-front-drawing.png",
      "3d-panel.png",
      "pages-add-view.png",
      "pages-multiview.png",
      "toolbar.png",
      "sketch-digitize.png",
      "reference-image-panel.png",
    ];
    for (const file of required) {
      expect(
        fs.existsSync(path.join(imagesDir, file)),
        `missing ${file} — run npm run docs:screenshots`,
      ).toBe(true);
    }
    expect(fs.existsSync(path.join(imagesDir, "3d-preview.png"))).toBe(false);
  });

  test("en/getting-started.html — 英語版画像を参照", async ({ page }) => {
    await page.goto("/docs/en/getting-started.html");
    await page.waitForLoadState("networkidle");
    const srcs = await page.evaluate(() =>
      [...document.images].map((img) => img.getAttribute("src")),
    );
    expect(srcs).toEqual(
      expect.arrayContaining([
        "../images/en/startup-dialog.png",
        "../images/en/startup-new-form.png",
        "../images/en/startup-project-list.png",
        "../images/en/main-window.png",
        "../images/en/drawing-rect.png",
      ]),
    );
    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.getAttribute("src")),
    );
    expect(broken).toEqual([]);
  });

  test("docs 用英語スクリーンショット PNG が存在する", async () => {
    const imagesDir = path.join(docsDir, "images", "en");
    const required = [
      "startup-dialog.png",
      "startup-new-form.png",
      "startup-project-list.png",
      "main-window.png",
      "drawing-rect.png",
      "drawing-features.png",
      "tools-panel.png",
      "design-panel.png",
      "design-panel-text.png",
      "drawing-text.png",
      "layers-panel.png",
      "history-panel.png",
      "taste-brief-panel.png",
      "editing-multiselect.png",
      "help-shortcuts.png",
      "multiview-top-drawing.png",
      "multiview-front-drawing.png",
      "3d-panel.png",
      "pages-add-view.png",
      "pages-multiview.png",
      "toolbar.png",
      "sketch-digitize.png",
      "reference-image-panel.png",
    ];
    for (const file of required) {
      expect(
        fs.existsSync(path.join(imagesDir, file)),
        `missing en/${file} — run npm run docs:screenshots`,
      ).toBe(true);
    }
  });
});

test.describe("ドキュメント記載寸法", () => {
  test("DOC_BOX が 120×80×50 mm に対応", () => {
    expect(DOC_BOX_MM).toEqual({ width: 120, depth: 80, height: 50 });
    expect(DOC_BOX_MM.width * 10).toBe(1200);
    expect(DOC_BOX_MM.depth * 10).toBe(800);
    expect(DOC_BOX_MM.height * 10).toBe(500);
    expect(DOC_BOX.top.fill).toBe("#8fb7ff");
    expect(DOC_BOX.front.fill).toBe("#ffb347");
  });

  test("DOC_DOCS_BOX が 120×80×50 mm に対応", () => {
    expect(DOC_DOCS_MM.width).toBe(120);
    expect(DOC_DOCS_MM.depth).toBe(80);
    expect(DOC_DOCS_MM.height).toBe(50);
    expect(DOC_DOCS_BOX.top.fill).toBe("#8fb7ff");
    expect(DOC_DOCS_BOX.front.fill).toBe("#ffb347");
  });
});
