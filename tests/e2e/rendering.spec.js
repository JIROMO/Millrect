/**
 * rendering.spec.js — SVGレンダリング正確性テスト
 *
 * 検証する設計原則:
 *   - render() が state から正しく SVG 要素を生成する
 *   - dimension-root グループが shapes レイヤーの上に描画される
 *   - shapes が削除されると SVG から消える
 *   - fill / stroke 属性が shape.fill / shape.stroke に一致する
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Rendering Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("SVGレンダリング", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  // ── 基本的な描画 ──────────────────────────────────────────────

  test("rect を追加すると SVG に rect 要素が追加される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 10,
        y: 10,
        width: 200,
        height: 100,
        stroke: "#000000",
        fill: "#ff0000",
        strokeWidth: "medium",
      });
      render();
    });
    const rect = page.locator(`[data-id="r1"]`);
    await expect(rect).toBeVisible();
  });

  test("rect の fill 属性が shape.fill に一致する", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        stroke: "#000000",
        fill: "#ff0000",
        strokeWidth: "medium",
      });
      render();
    });
    const fill = await page.locator(`[data-id="r1"]`).getAttribute("fill");
    expect(fill).toBe("#ff0000");
  });

  test("circle を追加すると SVG に circle 要素が追加される", async ({
    page,
  }) => {
    await page.evaluate(() => {
      addShape({
        id: "c1",
        type: "circle",
        cx: 200,
        cy: 200,
        r: 80,
        stroke: "#000000",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    const circle = page.locator(`[data-id="c1"]`);
    await expect(circle).toBeVisible();
  });

  test("image を追加すると SVG に image 要素が追加される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "img1",
        type: "image",
        dataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        x: 20,
        y: 30,
        width: 200,
        height: 120,
        opacity: 0.75,
      });
      getState().selectedShapeIds = ["img1"];
      render();
      updatePropertiesPanel();
    });
    const image = page.locator(`[data-id="img1"] image`);
    await expect(image).toBeVisible();
    await expect(page.locator("#sel-handles")).toBeVisible();
    await expect(image).toHaveAttribute("opacity", "0.75");
    await expect(page.locator("#properties-panel")).toContainText("画像");
  });

  test("shape を削除すると SVG から消える", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      render();
    });
    await expect(page.locator(`[data-id="r1"]`)).toBeVisible();

    await page.evaluate(() => {
      deleteShape("r1");
      render();
    });
    await expect(page.locator(`[data-id="r1"]`)).not.toBeVisible();
  });

  test("updateShape 後に render() すると属性が更新される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      updateShape("r1", { fill: "#00ff00" });
      render();
    });
    const fill = await page.locator(`[data-id="r1"]`).getAttribute("fill");
    expect(fill).toBe("#00ff00");
  });

  // ── dimension-root ────────────────────────────────────────────

  test("SVG に dimension-root グループが存在する", async ({ page }) => {
    await page.evaluate(() => render());
    const dimRoot = page.locator("#dimension-root");
    await expect(dimRoot).toBeAttached();
  });

  test("dimension を追加すると dimension-root 内に描画される", async ({
    page,
  }) => {
    await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 200 },
        to: { x: 300, y: 200 },
        offset: 30,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    // dimension-root 内に d1 関連要素が存在する
    const dimRoot = page.locator("#dimension-root");
    await expect(dimRoot).toBeAttached();
    await expect(dimRoot.locator("*").first()).toBeAttached();
    // dimension-root が空でないこと
    const children = await dimRoot.locator("*").count();
    expect(children).toBeGreaterThan(0);
  });

  test("dimension が shape レイヤーに描画されない（layer-group 内に data-id=d1 がない）", async ({
    page,
  }) => {
    await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 200 },
        to: { x: 300, y: 200 },
        offset: 30,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    // shape レイヤーの中に d1 が入っていないこと
    const inLayers = await page.locator(`.layer-group [data-id="d1"]`).count();
    expect(inLayers).toBe(0);
  });

  // ── 複数 shape の描画順序 ─────────────────────────────────────

  test("複数 shape が全て SVG に描画される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      addShape({
        id: "c1",
        type: "circle",
        cx: 200,
        cy: 200,
        r: 50,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 300,
        y2: 300,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      render();
    });
    await expect(page.locator(`[data-id="r1"]`)).toBeVisible();
    await expect(page.locator(`[data-id="c1"]`)).toBeVisible();
    await expect(page.locator(`[data-id="l1"]`)).toBeVisible();
  });

  // ── Undo後の再描画 ────────────────────────────────────────────

  test("Undo → render() で SVG が正しく更新される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      render();
    });
    await expect(page.locator(`[data-id="r1"]`)).toBeVisible();

    await page.evaluate(() => {
      undo();
      render();
    });
    await expect(page.locator(`[data-id="r1"]`)).not.toBeVisible();
  });

  test("Design パネルに塗り・線色コントロールが表示される", async ({
    page,
  }) => {
    await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#14213d",
        fill: "#ef4444",
        strokeWidth: "medium",
      });
      getState().selectedShapeIds = ["r1"];
      updatePropertiesPanel();
    });
    await expect(page.locator('[data-key="fill"]')).toHaveValue("#ef4444");
    await expect(page.locator('[data-key="stroke"]')).toHaveValue("#14213d");
    await expect(page.locator(".prop-color-swatch")).toHaveCount(16);
  });
});
