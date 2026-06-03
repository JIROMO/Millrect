/**
 * snap.spec.js — オブジェクトスナップテスト
 *
 * 検証する設計原則:
 *   - snapToShapes が端点・中点・中心・交点・垂線足を正しく検出する
 *   - snapType が正しく返される
 *   - 優先順位: endpoint > midpoint > center > intersection > perpendicular
 *   - threshold 外の点はスナップしない
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Snap Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

// テスト用: 図形座標は real units（1 mm = 10 units）。用紙座標は mm。

test.describe("snapToShapes — 端点スナップ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("line の端点にスナップ (snapType=endpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 1000,
          y2: 0,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const scale = { numerator: 1, denominator: 1 };
      const snap = snapToShapes({ x: 0.5, y: 0.5 }, shapes, scale, 3);
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.snapType).toBe("endpoint");
  });

  test("rect のコーナーにスナップ (snapType=endpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "r1",
          type: "rect",
          x: 0,
          y: 0,
          width: 1000,
          height: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "medium",
        },
      ];
      const snap = snapToShapes(
        { x: 99.5, y: 0.3 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { snapType: snap?.snapType };
    });
    expect(result.snapType).toBe("endpoint");
  });

  test("circle の象限点にスナップ (snapType=endpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "c1",
          type: "circle",
          cx: 1000,
          cy: 1000,
          r: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      // 右の象限点 (150, 100)
      const snap = snapToShapes(
        { x: 151, y: 100 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(150);
    expect(result.y).toBeCloseTo(100);
    expect(result.snapType).toBe("endpoint");
  });

  test("bezier ノードにスナップ (snapType=endpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "b1",
          type: "bezier",
          closed: false,
          nodes: [
            { x: 0, y: 0, h1: null, h2: null },
            { x: 2000, y: 1000, h1: null, h2: null },
          ],
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const snap = snapToShapes(
        { x: 1, y: 0.5 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { snapType: snap?.snapType };
    });
    expect(result.snapType).toBe("endpoint");
  });
});

test.describe("snapToShapes — 中点スナップ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("line の中点にスナップ (snapType=midpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 1000,
          y2: 0,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const snap = snapToShapes(
        { x: 50, y: 0.5 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(0);
    expect(result.snapType).toBe("midpoint");
  });

  test("rect 辺の中点にスナップ (snapType=midpoint)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "r1",
          type: "rect",
          x: 0,
          y: 0,
          width: 1000,
          height: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "medium",
        },
      ];
      // 上辺の中点 (50, 0)
      const snap = snapToShapes(
        { x: 50, y: 0.5 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(50);
    expect(result.snapType).toBe("midpoint");
  });
});

test.describe("snapToShapes — 中心スナップ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("circle の中心にスナップ (snapType=center)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "c1",
          type: "circle",
          cx: 1000,
          cy: 1000,
          r: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const snap = snapToShapes(
        { x: 101, y: 100 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(100);
    expect(result.snapType).toBe("center");
  });

  test("rect の中心にスナップ (snapType=center)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "r1",
          type: "rect",
          x: 0,
          y: 0,
          width: 1000,
          height: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "medium",
        },
      ];
      const snap = snapToShapes(
        { x: 50, y: 25 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(25);
    expect(result.snapType).toBe("center");
  });
});

test.describe("snapToShapes — 交点スナップ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("2本の line が交差する点にスナップ (snapType=intersection)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 500,
          x2: 1000,
          y2: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
        {
          id: "l2",
          type: "line",
          x1: 500,
          y1: 0,
          x2: 500,
          y2: 1000,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      // 交点は (50, 50)
      const snap = snapToShapes(
        { x: 51, y: 50.5 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(50);
    expect(result.y).toBeCloseTo(50);
    expect(result.snapType).toBe("intersection");
  });
});

test.describe("snapToShapes — 垂線足スナップ", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("水平 line への垂線足にスナップ (snapType=perpendicular)", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 500,
          x2: 2000,
          y2: 500,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      // (80, 52) → 垂線足は (80, 50)
      const snap = snapToShapes(
        { x: 80, y: 52 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    expect(result.x).toBeCloseTo(80);
    expect(result.y).toBeCloseTo(50);
    expect(result.snapType).toBe("perpendicular");
  });
});

test.describe("snapToShapes — 優先順位と threshold", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("endpoint は midpoint より優先される", async ({ page }) => {
    const result = await page.evaluate(() => {
      // line: x1=0,y1=0, x2=100,y2=0 → 端点(0,0) と中点(50,0)
      // 両方が threshold 内に入る状況を作る: pt=(0.5, 0)
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 20,
          y2: 0,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      // 中点=(1,0)、端点(0,0)どちらも距離 < threshold=3
      const snap = snapToShapes(
        { x: 0.6, y: 0 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return snap?.snapType;
    });
    expect(result).toBe("endpoint");
  });

  test("threshold を超えた点はスナップしない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 1000,
          y2: 0,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const snap = snapToShapes(
        { x: 200, y: 200 },
        shapes,
        { numerator: 1, denominator: 1 },
        3,
      );
      return snap;
    });
    expect(result).toBeNull();
  });

  test("scale 1/10 のとき real 座標に比例してスナップ", async ({ page }) => {
    const result = await page.evaluate(() => {
      // real 10000 (1000 mm) → paper 100 mm @ 1/10
      const shapes = [
        {
          id: "l1",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 10000,
          y2: 0,
          stroke: "#000",
          fill: "none",
          strokeWidth: "thin",
        },
      ];
      const scale = { numerator: 1, denominator: 10 };
      // real (1000,0) → paper (100,0)
      const snap = snapToShapes({ x: 99.5, y: 0 }, shapes, scale, 3);
      return { x: snap?.x, y: snap?.y, snapType: snap?.snapType };
    });
    // paper 座標で (100, 0) に端点スナップ
    expect(result.x).toBeCloseTo(100);
    expect(result.snapType).toBe("endpoint");
  });
});
