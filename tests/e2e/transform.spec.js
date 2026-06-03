/**
 * transform.spec.js — rotation / flip の幾何反映
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Transform Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("rotation / flip 幾何反映", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("getShapeBBox は rotation 後の AABB を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      const scale = { numerator: 10, denominator: 1 };
      const base = {
        id: "r0",
        type: "rect",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const flat = getShapeBBox({ ...base }, scale);
      const rotated = getShapeBBox({ ...base, rotation: 45 }, scale);
      return { flat, rotated };
    });
    expect(result.flat.w).toBeCloseTo(100, 1);
    expect(result.rotated.w).toBeGreaterThan(130);
    expect(result.rotated.h).toBeGreaterThan(130);
  });

  test("shapeToProfileRings は rotation を座標に反映する", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "r90",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 90,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const rings = shapeToProfileRings(shape);
      const xs = rings[0].map(([x]) => x);
      const ys = rings[0].map(([, y]) => y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    });
    expect(result.maxX - result.minX).toBeCloseTo(50, 1);
    expect(result.maxY - result.minY).toBeCloseTo(100, 1);
  });

  test("shapeToProfileRings は flipH を座標に反映する", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "flip-h",
        type: "rect",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        flipH: true,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const rings = shapeToProfileRings(shape);
      const xs = rings[0].map(([x]) => x);
      return { minX: Math.min(...xs), maxX: Math.max(...xs) };
    });
    expect(result.minX).toBeCloseTo(10, 1);
    expect(result.maxX).toBeCloseTo(110, 1);
  });

  test("collectWorldPointsReal は flipV で line の Y 座標を反転する", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const base = {
        id: "line-v",
        type: "line",
        x1: 10,
        y1: 20,
        x2: 80,
        y2: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const plain = collectWorldPointsReal(base);
      const flipped = collectWorldPointsReal({ ...base, flipV: true });
      return {
        plainY2: plain[1][1],
        flippedY2: flipped[1][1],
      };
    });
    expect(result.flippedY2).not.toBeCloseTo(result.plainY2, 0);
  });
});
