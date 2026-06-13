/**
 * text-outline.spec.js — テキストアウトライン化
 *
 * ブラウザ: HarfBuzz WASM（HTTP サーバー経由）
 * モック API: 置換・stroke なし・垂直位置補正
 * Electron (macOS): Core Text / fontkit 実アウトライン
 */

const path = require("path");
const fs = require("fs");
const { test, expect } = require("@playwright/test");

const appUrl = "/app/index.html";
const projectRoot = path.join(__dirname, "../..");
const nativeBin = path.join(
  projectRoot,
  "native/macos/outline-text/bin/outline-text",
);

async function openNewProject(page, name = "Text Outline Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

function addTestText(page, id = "txt-outline", overrides = {}) {
  return page.evaluate(
    ({ id, overrides }) => {
      addShape({
        id,
        type: "text",
        x: 200,
        y: 200,
        text: "Outline",
        fontSize: 35,
        fontFamily: "Gen Interface JP",
        fontWeight: "normal",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
        ...overrides,
      });
      render();
      return findShapeById(id)?.shape ?? null;
    },
    { id, overrides },
  );
}

test.describe("テキストアウトライン（ブラウザ）", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("ブラウザ WASM text engine が利用可能", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    const available = await page.evaluate(() => isTextOutlineAvailable());
    expect(available).toBe(true);
  });

  test("右パネルのアウトライン化ボタンは有効（WASM 準備後）", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await addTestText(page);
    await page.evaluate(() => {
      getState().selectedShapeIds = ["txt-outline"];
      uiUpdate();
    });
    const btn = page.locator("#btn-text-outline");
    await expect(btn).toBeEnabled();
  });

  test("measureTextOutlineMetrics: 1行目 yTop は anchor.y と一致", async ({
    page,
  }) => {
    await addTestText(page);
    const result = await page.evaluate(() => {
      const shape = findShapeById("txt-outline").shape;
      const scale = getCurrentPage().scale;
      const m = measureTextOutlineMetrics(shape, scale);
      return {
        anchorY: m.anchorPaper.y,
        yTop0: m.lines[0]?.yTopPaper,
        anchorX: m.anchorPaper.x,
        xPaper0: m.lines[0]?.xPaper,
      };
    });
    expect(result.yTop0).toBeCloseTo(result.anchorY, 1);
    expect(result.xPaper0).toBeCloseTo(result.anchorX, 1);
  });

  test("モック API: ネイティブプレビューは path で描画", async ({ page }) => {
    await addTestText(page);
    const result = await page.evaluate(async () => {
      window.electronAPI = {
        outlineTextShape: async () => ({
          children: [
            {
              type: "path",
              contours: [
                [
                  [
                    [200, 200],
                    [280, 200],
                    [280, 240],
                    [200, 240],
                  ],
                ],
              ],
              fill: "#1a1a2e",
              stroke: "none",
            },
          ],
          engine: "mock",
        }),
      };
      await refreshTextNativePreview("txt-outline");
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      render();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const g = document.querySelector('[data-id="txt-outline"]');
      return {
        hasForeignObject: Boolean(g?.querySelector("foreignObject")),
        pathCount: g?.querySelectorAll("path").length ?? 0,
        cached: Boolean(
          getTextNativePreviewChildren(
            "txt-outline",
            findShapeById("txt-outline").shape,
            getCurrentPage().scale,
          )?.length,
        ),
      };
    });

    expect(result.cached).toBe(true);
    expect(result.hasForeignObject).toBe(false);
    expect(result.pathCount).toBeGreaterThan(0);
  });

  test("モック API: ネイティブ layout で yTop は anchor.y と一致", async ({
    page,
  }) => {
    await addTestText(page);
    const result = await page.evaluate(async () => {
      window.electronAPI = {
        measureTextLayout: async (payload) => ({
          layout: {
            layoutPaper: { w: 120, h: 40, insetTop: 0, insetLeft: 0 },
            anchorPaper: payload.anchorPaper,
            lines: [
              {
                text: "Outline",
                lineIndex: 0,
                xPaper: payload.anchorPaper.x,
                yTopPaper: payload.anchorPaper.y,
              },
            ],
          },
          engine: "mock",
        }),
        outlineTextShape: async () => ({ children: [], engine: "mock" }),
      };
      await refreshTextNativeLayout("txt-outline");
      const shape = findShapeById("txt-outline").shape;
      const scale = getCurrentPage().scale;
      const m = measureTextOutlineMetrics(shape, scale);
      return {
        yTop0: m.lines[0]?.yTopPaper,
        anchorY: m.anchorPaper.y,
        insetTop: m.layoutPaper.insetTop,
        fromNative: Boolean(
          getTextNativeLayoutMetrics("txt-outline", shape, scale),
        ),
      };
    });

    expect(result.fromNative).toBe(true);
    expect(result.insetTop).toBe(0);
    expect(result.yTop0).toBeCloseTo(result.anchorY, 1);
  });

  test("モック API: 選択 bbox はテキスト枠（字間を含む）", async ({ page }) => {
    await page.evaluate(() => {
      window.electronAPI = {
        outlineTextShape: async () => ({
          children: [
            {
              type: "path",
              contours: [
                [
                  [
                    [205, 215],
                    [295, 215],
                    [295, 255],
                    [205, 255],
                  ],
                ],
              ],
              fill: "#1a1a2e",
              stroke: "none",
            },
          ],
          engine: "mock",
        }),
      };
    });
    await addTestText(page);
    const result = await page.evaluate(async () => {
      const shape = findShapeById("txt-outline").shape;
      const scale = getCurrentPage().scale;
      await refreshTextNativePreview("txt-outline");
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      render();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const layoutBox = getTextLayoutBoxPaper(shape, scale);
      const shapeBb = getShapeBBox(shape, scale);
      const preview = getTextNativePreviewChildren("txt-outline", shape, scale);
      const inkBb = textNativePreviewBBoxPaper(preview, scale);
      return { layoutBox, shapeBb, inkBb };
    });

    expect(result.inkBb).not.toBeNull();
    // HarfBuzz / ブラウザ計測は OS 間で数 px ずれる（CI Linux vs ローカル macOS）
    const paperSlack = 6;
    expect(result.layoutBox.w).toBeGreaterThanOrEqual(
      result.inkBb.w - paperSlack,
    );
    expect(result.layoutBox.h).toBeGreaterThanOrEqual(
      result.inkBb.h - paperSlack,
    );
    expect(result.layoutBox.x).toBeLessThanOrEqual(result.inkBb.x + paperSlack);
    expect(result.shapeBb.w).toBe(result.layoutBox.w);
  });

  test("モック API: text が group に置換され stroke は none", async ({
    page,
  }) => {
    await addTestText(page);
    const result = await page.evaluate(async () => {
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-outline").shape;
      const metrics = measureTextOutlineMetrics(shape, scale);
      const anchorY = metrics.anchorPaper.y;
      const tooHighY = anchorY - 12;

      window.electronAPI = {
        outlineTextShape: async () => ({
          children: [
            {
              type: "path",
              contours: [
                [
                  [
                    [200, tooHighY],
                    [320, tooHighY],
                    [320, tooHighY + 40],
                    [200, tooHighY + 40],
                  ],
                ],
              ],
              fill: "#1a1a2e",
              stroke: "#1a1a2e",
            },
          ],
          engine: "mock",
        }),
      };

      await outlineTextShape("txt-outline");

      const textGone = findShapeById("txt-outline") === null;
      const group = getAllShapesOnPage(getCurrentPage()).find(
        (s) => s.type === "group",
      );
      const bb = group ? getShapeBBox(group, scale) : null;
      return {
        textGone,
        groupType: group?.type,
        childCount: group?.children?.length ?? 0,
        childStroke: group?.children?.[0]?.stroke,
        childFill: group?.children?.[0]?.fill,
        anchorY,
        bbY: bb?.y,
        yDelta: bb ? Math.abs(bb.y - anchorY) : null,
      };
    });

    expect(result.textGone).toBe(true);
    expect(result.groupType).toBe("group");
    expect(result.childCount).toBeGreaterThan(0);
    expect(result.childStroke).toBe("none");
    expect(result.childFill).toBe("#1a1a2e");
    expect(result.yDelta).not.toBeNull();
    expect(result.yDelta).toBeLessThan(2);
  });

  test("WASM: outlineTextShape で path group に置換", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await addTestText(page);
    const result = await page.evaluate(async () => {
      await outlineTextShape("txt-outline");
      const textGone = findShapeById("txt-outline") === null;
      const group = getAllShapesOnPage(getCurrentPage()).find(
        (s) => s.type === "group",
      );
      return {
        textGone,
        groupType: group?.type,
        childCount: group?.children?.length ?? 0,
        childType: group?.children?.[0]?.type,
        childStroke: group?.children?.[0]?.stroke,
      };
    });
    expect(result.textGone).toBe(true);
    expect(result.groupType).toBe("group");
    expect(result.childCount).toBeGreaterThan(0);
    expect(result.childType).toBe("path");
    expect(result.childStroke).toBe("none");
  });

  test("Google Fonts URL: Kosugi Maru 登録とアウトライン", async ({ page }) => {
    // フォント TTF のネットワーク取得を含むため遅い（回線次第で 30s を超える）
    test.slow();
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.locator('button.panel-tab[data-tab="pages"]').click();
    await page
      .getByRole("button", { name: "プロジェクトフォント（任意）" })
      .click();
    await page
      .locator("#project-font-url")
      .fill(
        "https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap",
      );
    await page.locator("#project-font-add-btn").click();
    await page.waitForFunction(
      () =>
        (window.getState().fonts || []).some((f) => f.family === "Kosugi Maru"),
      null,
      { timeout: 20000 },
    );
    await page.evaluate(() => {
      addShape({
        id: "txt-kosugi",
        type: "text",
        x: 200,
        y: 200,
        text: "こんにちは",
        fontSize: 40,
        fontFamily: "Kosugi Maru",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document.querySelector('[data-id="txt-kosugi"] path')?.getAttribute("d")
          ?.length > 10,
      null,
      { timeout: 15000 },
    );
    const preview = await page.evaluate(async () => {
      await refreshTextNativePreview("txt-kosugi");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-kosugi").shape;
      const kosugi = await browserMeasureTextLayout({
        shape: { ...shape, text: "かき" },
        scale,
        anchorPaper: { x: 0, y: 0 },
        fontCandidates: [shape.fontFamily, "Gen Interface JP"],
      });
      const noto = await browserMeasureTextLayout({
        shape: {
          text: "かき",
          fontSize: shape.fontSize,
          fontFamily: "Gen Interface JP",
          fontWeight: "normal",
          lineHeight: 1,
        },
        scale,
        anchorPaper: { x: 0, y: 0 },
        fontCandidates: ["Gen Interface JP"],
      });
      const path = document.querySelector('[data-id="txt-kosugi"] path');
      const previewChildren = getTextNativePreviewChildren(
        "txt-kosugi",
        shape,
        scale,
      );
      return {
        fontFamily: shape.fontFamily,
        kosugiW: kosugi.layout.layoutPaper.w,
        notoW: noto.layout.layoutPaper.w,
        fillRule:
          previewChildren?.[0]?.fillRule ?? path?.getAttribute("fill-rule"),
      };
    });
    expect(preview.fontFamily).toBe("Kosugi Maru");
    expect(preview.fillRule).toBe("nonzero");
    expect(preview.kosugiW).toBeGreaterThan(0);

    const result = await page.evaluate(async () => {
      await outlineTextShape("txt-kosugi");
      const group = getAllShapesOnPage(getCurrentPage()).find(
        (s) => s.type === "group",
      );
      return {
        fontFamily: getState().fonts[0]?.family,
        groupChildren: group?.children?.length ?? 0,
      };
    });
    expect(result.fontFamily).toBe("Kosugi Maru");
    expect(result.groupChildren).toBeGreaterThan(0);
  });

  test("Fontsource browser: Kosugi Maru をライブラリ登録", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.locator('button.panel-tab[data-tab="pages"]').click();
    await page
      .getByRole("button", { name: "プロジェクトフォント（任意）" })
      .click();
    await page.locator("#project-font-browse-btn").click();
    await page.waitForSelector("#font-browser-dialog", { timeout: 10000 });
    await page.waitForSelector("#font-browser-list .font-browser-item", {
      timeout: 60000,
    });
    await page.locator("#font-browser-search").fill("Kosugi Maru");
    await page
      .locator("#font-browser-list .font-browser-item")
      .filter({ hasText: "Kosugi Maru" })
      .first()
      .click();
    await page.locator("#font-browser-add").click();
    await page.waitForFunction(
      () => !document.getElementById("font-browser-overlay"),
      null,
      { timeout: 20000 },
    );
    const result = await page.evaluate(() => ({
      library: (getFontLibraryFonts() || []).map((f) => f.family),
      project: (getState().fonts || []).map((f) => f.family),
    }));
    expect(result.library).toContain("Kosugi Maru");
    expect(result.project).toContain("Kosugi Maru");
  });

  test("Fontsource browser: Roboto Bold が 400 と別 glyph", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.locator('button.panel-tab[data-tab="pages"]').click();
    await page
      .getByRole("button", { name: "プロジェクトフォント（任意）" })
      .click();
    await page.locator("#project-font-browse-btn").click();
    await page.waitForSelector("#font-browser-list .font-browser-item", {
      timeout: 60000,
    });
    await page.locator("#font-browser-search").fill("Roboto");
    await page.locator("#font-browser-japanese").uncheck();
    await page
      .locator("#font-browser-list .font-browser-item")
      .filter({ hasText: "Roboto" })
      .first()
      .click();
    await page.locator("#font-browser-add").click();
    await page.waitForFunction(
      () => (getState().fonts || []).some((f) => f.family === "Roboto"),
      null,
      { timeout: 20000 },
    );
    const fontEntry = await page.evaluate(() =>
      (getState().fonts || []).find((f) => f.family === "Roboto"),
    );
    expect(fontEntry.fileUrl).toBeTruthy();
    expect(fontEntry.fileUrlBold).toBeTruthy();
    expect(fontEntry.fileUrl).not.toBe(fontEntry.fileUrlBold);

    await page.evaluate(() => {
      addShape({
        id: "txt-roboto-bold",
        type: "text",
        x: 200,
        y: 200,
        text: "Hello",
        fontSize: 40,
        fontFamily: "Roboto",
        fontWeight: "bold",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-roboto-bold"] path')
          ?.getAttribute("d")?.length > 10,
      null,
      { timeout: 15000 },
    );
    const widths = await page.evaluate(async () => {
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-roboto-bold").shape;
      const bold = await browserMeasureTextLayout({
        shape,
        scale,
        anchorPaper: { x: 0, y: 0 },
        fontCandidates: [shape.fontFamily],
      });
      const regular = await browserMeasureTextLayout({
        shape: { ...shape, fontWeight: "normal" },
        scale,
        anchorPaper: { x: 0, y: 0 },
        fontCandidates: [shape.fontFamily],
      });
      return {
        boldW: bold.layout.layoutPaper.w,
        regularW: regular.layout.layoutPaper.w,
      };
    });
    expect(widths.boldW).toBeGreaterThan(widths.regularW);
  });

  test("Google Fonts URL: 複数 family を一括登録", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.locator('button.panel-tab[data-tab="pages"]').click();
    await page
      .getByRole("button", { name: "プロジェクトフォント（任意）" })
      .click();
    await page
      .locator("#project-font-url")
      .fill(
        "https://fonts.googleapis.com/css2?family=Kosugi+Maru&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap",
      );
    await page.locator("#project-font-add-btn").click();
    await page.waitForFunction(
      () => {
        const names = (window.getState().fonts || []).map((f) => f.family);
        return names.includes("Kosugi Maru") && names.includes("Roboto");
      },
      null,
      { timeout: 30000 },
    );
    const result = await page.evaluate(async () => {
      const fonts = getState().fonts || [];
      const cssUrls = [...new Set(fonts.map((f) => f.cssUrl))];
      addShape({
        id: "txt-roboto",
        type: "text",
        x: 200,
        y: 200,
        text: "Hello",
        fontSize: 40,
        fontFamily: "Roboto",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
      await outlineTextShape("txt-roboto");
      const group = getAllShapesOnPage(getCurrentPage()).find(
        (s) => s.type === "group",
      );
      return {
        families: fonts.map((f) => f.family).sort(),
        cssUrlCount: cssUrls.length,
        groupChildren: group?.children?.length ?? 0,
      };
    });
    expect(result.families).toEqual(["Kosugi Maru", "Roboto"]);
    expect(result.cssUrlCount).toBe(1);
    expect(result.groupChildren).toBeGreaterThan(0);
  });

  test("テキスト: fill のみ指定でも文字色が表示される", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-fill-color",
        type: "text",
        x: 200,
        y: 200,
        text: "Color",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        fill: "#e11d48",
        stroke: "none",
        strokeWidth: "thin",
      });
      render();
    });
    const result = await page.evaluate(async () => {
      await refreshTextNativePreview("txt-fill-color");
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      render();
      const g = document.querySelector('[data-id="txt-fill-color"]');
      const path = g?.querySelector("path");
      const div = g?.querySelector(".millrect-text-shape");
      return {
        pathFill: path?.getAttribute("fill") || null,
        divColor: div?.style.color || null,
        ink: textShapeInkColor(findShapeById("txt-fill-color").shape),
      };
    });
    expect(result.ink).toBe("#e11d48");
    expect(result.pathFill || result.divColor).toBe("#e11d48");
  });

  test("テキスト: ネイティブプレビュー後も文字色が維持される", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-preview-color",
        type: "text",
        x: 200,
        y: 200,
        text: "KeepColor",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        stroke: "#2563eb",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () => {
        const g = document.querySelector('[data-id="txt-preview-color"]');
        const path = g?.querySelector("path");
        return path && path.getAttribute("fill") === "#2563eb";
      },
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(() => {
      const g = document.querySelector('[data-id="txt-preview-color"]');
      const path = g?.querySelector("path");
      const div = g?.querySelector(".millrect-text-shape");
      return {
        pathFill: path?.getAttribute("fill") || null,
        hasPath: Boolean(path),
        hasDiv: Boolean(div),
      };
    });
    expect(result.hasPath).toBe(true);
    expect(result.hasDiv).toBe(false);
    expect(result.pathFill).toBe("#2563eb");
  });

  test("テキスト: 1/10 スケールでも path プレビューが読めるサイズ", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      const pageObj = getCurrentPage();
      pageObj.scale = { numerator: 1, denominator: 10 };
      addShape({
        id: "txt-scale-default",
        type: "text",
        x: 500,
        y: 500,
        text: "Scale",
        fontSize: 3.5,
        fontFamily: "Gen Interface JP",
        stroke: "#1a1a2e",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () => {
        const g = document.querySelector('[data-id="txt-scale-default"]');
        return g?.querySelector("path")?.getAttribute("d")?.length > 10;
      },
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(() => {
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-scale-default").shape;
      const preview = getTextNativePreviewChildren(
        "txt-scale-default",
        shape,
        scale,
      );
      const pathBb = textNativePreviewBBoxPaper(preview, scale);
      const domLayout = measureTextLayoutDom(shape, null);
      return {
        pathH: pathBb?.h ?? 0,
        domH: domLayout.h,
        fontSize: shape.fontSize,
      };
    });
    expect(result.pathH).toBeGreaterThan(result.fontSize * 0.5);
    // 修正前は real 単位変換漏れで path が DOM の約 1/10 になっていた
    expect(result.pathH).toBeGreaterThan(result.domH / 4);
    expect(result.pathH).toBeLessThan(result.domH * 1.2);
  });

  test("テキスト: Gen Interface JP で和文・欧文を同一フォントで描画", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-cjk-fallback",
        type: "text",
        x: 200,
        y: 200,
        text: "あいうABC",
        fontSize: 20,
        fontFamily: "Gen Interface JP",
        stroke: "#1a1a2e",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () => {
        const g = document.querySelector('[data-id="txt-cjk-fallback"]');
        const paths = g?.querySelectorAll("path");
        return paths && paths.length >= 3;
      },
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      await refreshTextNativePreview("txt-cjk-fallback");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-cjk-fallback").shape;
      const preview = getTextNativePreviewChildren(
        "txt-cjk-fallback",
        shape,
        scale,
      );
      const bb = textNativePreviewBBoxPaper(preview, scale);
      const pathCount = document.querySelectorAll(
        '[data-id="txt-cjk-fallback"] path',
      ).length;
      return { pathCount, width: bb?.w ?? 0, fontSize: shape.fontSize };
    });
    expect(result.pathCount).toBeGreaterThanOrEqual(3);
    expect(result.width).toBeGreaterThan(result.fontSize * 2);
  });

  test("テキスト: Gen Interface JP の path 上端は anchor.y と一致", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-noto-align",
        type: "text",
        x: 200,
        y: 200,
        text: "あいうえお",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        stroke: "#c44",
        fill: "#c44",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-noto-align"] path')
          ?.getAttribute("d")?.length > 10,
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      await refreshTextNativePreview("txt-noto-align");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-noto-align").shape;
      const preview = getTextNativePreviewChildren(
        "txt-noto-align",
        shape,
        scale,
      );
      const inkBb = textNativePreviewBBoxPaper(preview, scale);
      const anchorY = realToPaper(shape.y, scale);
      return {
        inkTop: inkBb?.y,
        anchorY,
        delta: inkBb ? inkBb.y - anchorY : null,
      };
    });
    expect(Math.abs(result.delta)).toBeLessThan(1);
  });

  test("テキスト: Gen Interface JP + 日本語は union 後 nonzero（穴あり）", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-inter-a",
        type: "text",
        x: 200,
        y: 200,
        text: "あ",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-inter-a"] path')
          ?.getAttribute("d")?.length > 10,
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      await refreshTextNativePreview("txt-inter-a");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-inter-a").shape;
      const preview = getTextNativePreviewChildren("txt-inter-a", shape, scale);
      const raw = await browserOutlineText({
        shape: {
          text: "あ",
          fontSize: shape.fontSize,
          fontFamily: shape.fontFamily,
          fontWeight: shape.fontWeight,
          lineHeight: 1,
          stroke: shape.stroke,
        },
        scale,
        anchorPaper: { x: 0, y: 0 },
        lines: [{ text: "あ", lineIndex: 0, xPaper: 0, yTopPaper: 0 }],
        layoutPaper: { insetTop: 0, insetLeft: 0, w: 80, h: 40 },
        fontCandidates: [shape.fontFamily, "Gen Interface JP"],
      });
      const path = document.querySelector('[data-id="txt-inter-a"] path');
      return {
        rawPolyCount: raw.children[0]?.contours?.length ?? 0,
        previewPolyCount: preview?.[0]?.contours?.length ?? 0,
        fillRule: preview?.[0]?.fillRule ?? path?.getAttribute("fill-rule"),
      };
    });
    expect(result.rawPolyCount).toBeGreaterThan(1);
    expect(result.previewPolyCount).toBeGreaterThanOrEqual(1);
    expect(result.fillRule).toBe("nonzero");
  });

  test("テキスト: Bold 日本語は nonzero で内側ループ", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-bold-hole",
        type: "text",
        x: 200,
        y: 200,
        text: "あ",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        fontWeight: "bold",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-bold-hole"] path')
          ?.getAttribute("d")?.length > 10,
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      function ringSignedArea(ring) {
        let area = 0;
        for (let i = 0; i < ring.length; i++) {
          const [x0, y0] = ring[i];
          const [x1, y1] = ring[(i + 1) % ring.length];
          area += x0 * y1 - x1 * y0;
        }
        return area / 2;
      }
      await refreshTextNativePreview("txt-bold-hole");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-bold-hole").shape;
      const preview = getTextNativePreviewChildren(
        "txt-bold-hole",
        shape,
        scale,
      );
      const poly = preview?.[0]?.contours?.[0] || [];
      return {
        fillRule: preview?.[0]?.fillRule,
        ringCount: poly.length,
        outerArea: poly[0] ? ringSignedArea(poly[0]) : 0,
        holeArea: poly[1] ? ringSignedArea(poly[1]) : 0,
      };
    });
    expect(result.fillRule).toBe("nonzero");
    expect(result.ringCount).toBeGreaterThanOrEqual(2);
  });

  test("テキスト: Bold の「お」は union 後 nonzero で counter を維持", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-bold-o",
        type: "text",
        x: 200,
        y: 200,
        text: "お",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        fontWeight: "bold",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-bold-o"] path')
          ?.getAttribute("fill-rule") === "nonzero",
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      function ringArea(ring) {
        let area = 0;
        for (let i = 0; i < ring.length; i++) {
          const [x0, y0] = ring[i];
          const [x1, y1] = ring[(i + 1) % ring.length];
          area += x0 * y1 - x1 * y0;
        }
        return area / 2;
      }
      const raw = await browserOutlineText({
        shape: {
          text: "お",
          fontSize: 40,
          fontFamily: "Gen Interface JP",
          fontWeight: "bold",
          lineHeight: 1,
          stroke: "#1a1a2e",
        },
        scale: getCurrentPage().scale,
        anchorPaper: { x: 0, y: 0 },
        lines: [{ text: "お", lineIndex: 0, xPaper: 0, yTopPaper: 0 }],
        layoutPaper: { insetTop: 0, insetLeft: 0, w: 200, h: 40 },
        fontCandidates: ["Gen Interface JP"],
      });
      const shape = findShapeById("txt-bold-o").shape;
      const preview = getTextNativePreviewChildren(
        "txt-bold-o",
        shape,
        getCurrentPage().scale,
      );
      const rings = (preview?.[0]?.contours || []).flat();
      const holeRings = rings.filter((ring) => ringArea(ring) < 0);
      const path = document.querySelector('[data-id="txt-bold-o"] path');
      return {
        rawPolys: raw.children[0]?.contours?.length ?? 0,
        previewPolys: preview?.[0]?.contours?.length ?? 0,
        holeRingCount: holeRings.length,
        fillRule: preview?.[0]?.fillRule,
        svgFillRule: path?.getAttribute("fill-rule"),
      };
    });
    expect(result.rawPolys).toBeGreaterThan(1);
    expect(result.holeRingCount).toBeGreaterThan(0);
    expect(result.fillRule).toBe("nonzero");
    expect(result.svgFillRule).toBe("nonzero");
  });

  test("テキスト: Bold 漢字「屋」は counter を穴として保持", async ({
    page,
  }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-bold-ya",
        type: "text",
        x: 200,
        y: 200,
        text: "屋",
        fontSize: 40,
        fontFamily: "Gen Interface JP",
        fontWeight: "bold",
        stroke: "#1a1a2e",
        fill: "#1a1a2e",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-id="txt-bold-ya"] path')
          ?.getAttribute("d")?.length > 10,
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      function ringSignedArea(ring) {
        let area = 0;
        for (let i = 0; i < ring.length; i++) {
          const [x0, y0] = ring[i];
          const [x1, y1] = ring[(i + 1) % ring.length];
          area += x0 * y1 - x1 * y0;
        }
        return area / 2;
      }
      await refreshTextNativePreview("txt-bold-ya");
      render();
      const scale = getCurrentPage().scale;
      const shape = findShapeById("txt-bold-ya").shape;
      const preview = getTextNativePreviewChildren("txt-bold-ya", shape, scale);
      const contours = preview?.[0]?.contours || [];
      let totalRings = 0;
      let totalHoles = 0;
      for (const poly of contours) {
        totalRings += poly.length;
        totalHoles += poly.filter((ring) => ringSignedArea(ring) < 0).length;
      }
      return {
        fillRule: preview?.[0]?.fillRule,
        polyCount: contours.length,
        totalRings,
        totalHoles,
      };
    });
    expect(result.fillRule).toBe("nonzero");
    expect(result.polyCount).toBeGreaterThanOrEqual(1);
    expect(result.totalRings).toBeGreaterThanOrEqual(3);
    expect(result.totalHoles).toBeGreaterThanOrEqual(2);
  });

  test("テキスト: Bold ウェイトで path が生成される", async ({ page }) => {
    await page.waitForFunction(() => window.__millrectHbReady === true, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      addShape({
        id: "txt-bold",
        type: "text",
        x: 200,
        y: 200,
        text: "Bold",
        fontSize: 24,
        fontFamily: "Gen Interface JP",
        fontWeight: "bold",
        stroke: "#1a1a2e",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    await page.waitForFunction(
      () => document.querySelectorAll('[data-id="txt-bold"] path').length >= 2,
      null,
      { timeout: 15000 },
    );
    const result = await page.evaluate(async () => {
      const scale = getCurrentPage().scale;
      const mk = (weight) => ({
        shape: {
          text: "Bold",
          fontSize: 24,
          fontFamily: "Gen Interface JP",
          fontWeight: weight,
          lineHeight: 1,
        },
        scale,
        anchorPaper: { x: 0, y: 0 },
        fontCandidates: ["Gen Interface JP"],
      });
      const normal = await browserMeasureTextLayout(mk("normal"));
      const bold = await browserMeasureTextLayout(mk("bold"));
      return {
        pathCount: document.querySelectorAll('[data-id="txt-bold"] path')
          .length,
        normalW: normal.layout.layoutPaper.w,
        boldW: bold.layout.layoutPaper.w,
      };
    });
    expect(result.pathCount).toBeGreaterThanOrEqual(2);
    expect(result.boldW).toBeGreaterThan(result.normalW * 1.02);
  });
});

test.describe("テキストアウトライン（Core Text / Node）", () => {
  test.skip(
    process.platform !== "darwin" || !fs.existsSync(nativeBin),
    "macOS + native outline-text binary required",
  );

  function bboxPaper(children, scale) {
    let minY = Infinity;
    for (const child of children) {
      for (const poly of child.contours || []) {
        for (const ring of poly) {
          for (const pt of ring) {
            const py = (pt[1] / 10) * (scale.numerator / scale.denominator);
            minY = Math.min(minY, py);
          }
        }
      }
    }
    return minY;
  }

  function alignDown(children, anchorYPaper, scale) {
    const minY = bboxPaper(children, scale);
    if (!Number.isFinite(minY)) return children;
    const dyPaper = anchorYPaper - minY;
    if (Math.abs(dyPaper) <= 0.01) return children;
    const dyReal = dyPaper * 10 * (scale.denominator / scale.numerator);
    return children.map((child) => ({
      ...child,
      contours: child.contours.map((poly) =>
        poly.map((ring) => ring.map(([x, y]) => [x, y + dyReal])),
      ),
    }));
  }

  test("Core Text: path 生成と垂直位置補正", () => {
    const { outlineText } = require("../../electron/text-outline");
    const scale = { numerator: 1, denominator: 1 };
    const anchorPaper = { x: 200, y: 200 };
    const payload = {
      shape: {
        text: "Outline",
        fontSize: 35,
        fontFamily: "Gen Interface JP",
        fontWeight: "normal",
        lineHeight: 1,
        stroke: "#1a1a2e",
        strokeWidth: "thin",
      },
      scale,
      layoutPaper: { insetTop: 0, insetLeft: 0 },
      anchorPaper,
      lines: [
        {
          text: "Outline",
          lineIndex: 0,
          xPaper: 200,
          yTopPaper: 200,
        },
      ],
      fontCandidates: ["Gen Interface JP", "Gen Interface JP"],
    };

    const result = outlineText(payload);
    expect(result.children?.length).toBeGreaterThan(0);
    expect(result.engine).toBe("coretext");
    expect(result.children[0].stroke).toBe("none");

    const beforeY = bboxPaper(result.children, scale);
    const aligned = alignDown(result.children, anchorPaper.y, scale);
    const afterY = bboxPaper(aligned, scale);

    expect(Number.isFinite(beforeY)).toBe(true);
    expect(Math.abs(afterY - anchorPaper.y)).toBeLessThan(2);
  });

  test("Core Text: layout mode と lines 省略 outline", () => {
    const {
      outlineText,
      measureTextLayout,
    } = require("../../electron/text-outline");
    const scale = { numerator: 1, denominator: 1 };
    const anchorPaper = { x: 200, y: 200 };
    const basePayload = {
      shape: {
        text: "Outline",
        fontSize: 35,
        fontFamily: "Gen Interface JP",
        fontWeight: "normal",
        textAlign: "left",
        lineHeight: 1,
        stroke: "#1a1a2e",
        strokeWidth: "thin",
      },
      scale,
      anchorPaper,
      paperWidth: null,
      fontCandidates: ["Gen Interface JP", "Gen Interface JP"],
    };

    const layoutResult = measureTextLayout(basePayload);
    expect(layoutResult.layout?.lines?.length).toBeGreaterThan(0);
    expect(layoutResult.layout.lines[0].yTopPaper).toBeCloseTo(
      anchorPaper.y,
      1,
    );
    expect(layoutResult.layout.layoutPaper.insetTop).toBe(0);

    const outlineResult = outlineText(basePayload);
    expect(outlineResult.children?.length).toBeGreaterThan(0);
    expect(outlineResult.layout?.lines?.length).toBeGreaterThan(0);
    expect(outlineResult.engine).toBe("coretext");
  });
});
