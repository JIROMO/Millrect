/**
 * boolean.spec.js — Figma 風ブール演算（結合/減算/交差/除外/統合）
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Boolean Test");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

function addRect(page, id, x, y, width, height) {
  return page.evaluate(
    ({ id, x, y, width, height }) => {
      addShape({
        id,
        type: "rect",
        x,
        y,
        width,
        height,
        stroke: "#000",
        fill: "#ccc",
        strokeWidth: "thin",
      });
      return findShapeById(id)?.shape.type;
    },
    { id, x, y, width, height },
  );
}

function selectShapes(page, ids) {
  return page.evaluate((ids) => {
    getState().selectedShapeIds = ids;
    return getState().selectedShapeIds;
  }, ids);
}

test.describe("ブール演算", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("結合 (union) で 2 つの rect が 1 つの path になる", async ({
    page,
  }) => {
    await addRect(page, "a", 0, 0, 100, 100);
    await addRect(page, "b", 50, 50, 100, 100);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      const ok = mergeSelectedShapes();
      const layer = getCurrentLayer();
      return {
        ok,
        count: layer.shapes.length,
        type: layer.shapes[0]?.type,
        selected: getState().selectedShapeIds.length,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.type).toBe("path");
    expect(result.selected).toBe(1);
  });

  test("減算 (subtract) で背面図形から前面を引ける", async ({ page }) => {
    await addRect(page, "base", 0, 0, 200, 200);
    await addRect(page, "cut", 50, 50, 100, 100);
    await selectShapes(page, ["base", "cut"]);

    const result = await page.evaluate(() => {
      const ok = subtractSelectedShapes();
      const shape = getCurrentLayer().shapes[0];
      return {
        ok,
        type: shape?.type,
        holeCount: shape?.contours?.[0]?.length > 1 ? 1 : 0,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.type).toBe("path");
    expect(result.holeCount).toBe(1);
  });

  test("交差 (intersect) で重なり部分だけ残る", async ({ page }) => {
    await addRect(page, "a", 0, 0, 150, 150);
    await addRect(page, "b", 100, 100, 150, 150);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      const ok = intersectSelectedShapes();
      const shape = getCurrentLayer().shapes[0];
      const ring = shape?.contours?.[0]?.[0] || [];
      let minX = Infinity,
        maxX = -Infinity;
      for (const [x] of ring) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      return { ok, width: maxX - minX };
    });

    expect(result.ok).toBe(true);
    expect(result.width).toBeCloseTo(50, 0);
  });

  test("除外 (exclude) で重なり以外が残る", async ({ page }) => {
    await addRect(page, "a", 0, 0, 120, 120);
    await addRect(page, "b", 60, 60, 120, 120);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      const ok = excludeSelectedShapes();
      const shape = getCurrentLayer().shapes[0];
      return {
        ok,
        type: shape?.type,
        polygonCount: shape?.contours?.length ?? 0,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.type).toBe("path");
    expect(result.polygonCount).toBe(2);
  });

  test("除外 (exclude) で内包図形はフレームになる", async ({ page }) => {
    await addRect(page, "outer", 0, 0, 200, 200);
    await addRect(page, "inner", 50, 50, 100, 100);
    await selectShapes(page, ["outer", "inner"]);

    const result = await page.evaluate(() => {
      const ok = excludeSelectedShapes();
      const shape = getCurrentLayer().shapes[0];
      const outer = shape?.contours?.[0]?.[0] || [];
      const hole = shape?.contours?.[0]?.[1] || [];
      let area = 0;
      const ringArea = (ring) => {
        let a = 0;
        for (let i = 0; i < ring.length; i++) {
          const [x0, y0] = ring[i];
          const [x1, y1] = ring[(i + 1) % ring.length];
          a += x0 * y1 - x1 * y0;
        }
        return a / 2;
      };
      area = Math.abs(ringArea(outer)) - Math.abs(ringArea(hole));
      return {
        ok,
        ringCount: shape?.contours?.[0]?.length ?? 0,
        area,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.ringCount).toBe(2);
    expect(result.area).toBeCloseTo(30000, -2);
  });

  test("除外 (exclude) はグループ内の図形も対象にできる", async ({ page }) => {
    await addRect(page, "a", 0, 0, 100, 100);
    await addRect(page, "b", 50, 50, 100, 100);
    await selectShapes(page, ["a", "b"]);
    await page.evaluate(() => groupSelectedShapes());
    await addRect(page, "c", 80, 80, 100, 100);

    const result = await page.evaluate(() => {
      const groupId = getCurrentLayer().shapes.find(
        (s) => s.type === "group",
      )?.id;
      getState().selectedShapeIds = [groupId, "c"];
      const ok = excludeSelectedShapes();
      return {
        ok,
        count: getCurrentLayer().shapes.length,
        type: getCurrentLayer().shapes[0]?.type,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.type).toBe("path");
  });

  test("統合 (flatten) でグループを 1 つの path にできる", async ({ page }) => {
    await addRect(page, "a", 0, 0, 80, 80);
    await addRect(page, "b", 40, 40, 80, 80);
    await selectShapes(page, ["a", "b"]);
    await page.evaluate(() => groupSelectedShapes());

    const result = await page.evaluate(() => {
      const groupId = getState().selectedShapeIds[0];
      getState().selectedShapeIds = [groupId];
      const ok = flattenSelectedShapes();
      const layer = getCurrentLayer();
      return {
        ok,
        count: layer.shapes.length,
        type: layer.shapes[0]?.type,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.type).toBe("path");
  });
});
