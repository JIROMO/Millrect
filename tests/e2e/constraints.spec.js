/**
 * constraints.spec.js — 幾何拘束システムテスト
 *
 * 検証する設計原則:
 *   - 拘束は page.constraints[] に格納される（shapes に混入しない）
 *   - applyConstraints() が各拘束タイプを正しく解く
 *   - updateShape / moveShapeToPosition 後に拘束が自動適用される
 *   - 拘束の追加・削除が Undo/Redo できる
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Constraints Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("拘束の格納", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("addConstraint が page.constraints[] に格納される", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 10,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      const pg = getCurrentPage();
      return {
        count: pg.constraints?.length,
        type: pg.constraints?.[0]?.type,
        inShapes: getAllShapesOnPage(pg).some((s) => s.type === "horizontal"),
      };
    });
    expect(result.count).toBe(1);
    expect(result.type).toBe("horizontal");
    expect(result.inShapes).toBe(false); // shapes に混入しない
  });

  test("addConstraint → Undo で拘束が消える", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 10,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      undo();
      return getCurrentPage().constraints?.length;
    });
    expect(result).toBe(0);
  });

  test("removeConstraint で拘束が削除される", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 10,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      const id = addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      removeConstraint(id);
      return getCurrentPage().constraints?.length;
    });
    expect(result).toBe(0);
  });

  test("getConstraintsForShape が対象 shape の拘束を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 10,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "l2",
        type: "line",
        x1: 200,
        y1: 0,
        x2: 300,
        y2: 10,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      addConstraint({ type: "vertical", shapeIds: ["l2"] });
      const c1 = getConstraintsForShape("l1");
      const c2 = getConstraintsForShape("l2");
      return { c1types: c1.map((c) => c.type), c2types: c2.map((c) => c.type) };
    });
    expect(result.c1types).toContain("horizontal");
    expect(result.c1types).not.toContain("vertical");
    expect(result.c2types).toContain("vertical");
  });
});

test.describe("horizontal 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("applyConstraints が line を水平にする", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      applyConstraints();
      const s = findShapeById("l1")?.shape;
      return { y1: s?.y1, y2: s?.y2 };
    });
    expect(result.y1).toBeCloseTo(result.y2, 3);
  });

  test("updateShape 後に horizontal 拘束が自動適用される", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      // y2 を動かして拘束違反を作る
      updateShape("l1", { y2: 30 });
      const s = findShapeById("l1")?.shape;
      return { y1: s?.y1, y2: s?.y2 };
    });
    // updateShape 後に自動で水平化される
    expect(result.y1).toBeCloseTo(result.y2, 3);
  });
});

test.describe("vertical 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("applyConstraints が line を垂直にする", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 20,
        y2: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "vertical", shapeIds: ["l1"] });
      applyConstraints();
      const s = findShapeById("l1")?.shape;
      return { x1: s?.x1, x2: s?.x2 };
    });
    expect(result.x1).toBeCloseTo(result.x2, 3);
  });
});

test.describe("parallel 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("2本の line が平行になる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "l2",
        type: "line",
        x1: 0,
        y1: 50,
        x2: 100,
        y2: 80,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "parallel", shapeIds: ["l1", "l2"] });
      applyConstraints();
      const s1 = findShapeById("l1")?.shape;
      const s2 = findShapeById("l2")?.shape;
      // 平行なら方向ベクトルの外積が0に近い
      const dx1 = s1.x2 - s1.x1,
        dy1 = s1.y2 - s1.y1;
      const dx2 = s2.x2 - s2.x1,
        dy2 = s2.y2 - s2.y1;
      const cross = dx1 * dy2 - dy1 * dx2;
      return cross;
    });
    expect(Math.abs(result)).toBeLessThan(1);
  });
});

test.describe("equal_length 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("2本の line が等長になる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "l2",
        type: "line",
        x1: 200,
        y1: 0,
        x2: 250,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "equal_length", shapeIds: ["l1", "l2"] });
      applyConstraints();
      const s1 = findShapeById("l1")?.shape;
      const s2 = findShapeById("l2")?.shape;
      const len1 = Math.hypot(s1.x2 - s1.x1, s1.y2 - s1.y1);
      const len2 = Math.hypot(s2.x2 - s2.x1, s2.y2 - s2.y1);
      return { len1, len2, diff: Math.abs(len1 - len2) };
    });
    expect(result.diff).toBeLessThan(0.1);
  });
});

test.describe("coincident 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("2本の line の端点が一致する", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "l2",
        type: "line",
        x1: 105,
        y1: 5,
        x2: 200,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      // l1 の end と l2 の start を一致させる
      addConstraint({
        type: "coincident",
        shapeIds: ["l1", "l2"],
        params: { point1: "end", point2: "start" },
      });
      applyConstraints();
      const s1 = findShapeById("l1")?.shape;
      const s2 = findShapeById("l2")?.shape;
      return {
        dist: Math.hypot(s1.x2 - s2.x1, s1.y2 - s2.y1),
      };
    });
    expect(result.dist).toBeLessThan(0.1);
  });
});

test.describe("fixed 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("fixed 拘束が shape を元の位置に戻す", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      // 固定位置として x=100, y=100 を記録
      addConstraint({
        type: "fixed",
        shapeIds: ["r1"],
        params: { x: 100, y: 100 },
      });
      // 移動して違反させる
      updateShape("r1", { x: 200, y: 200 });
      const s = findShapeById("r1")?.shape;
      return { x: s?.x, y: s?.y };
    });
    // updateShape 後に applyConstraints が自動実行され元の位置に戻る
    expect(result.x).toBeCloseTo(100, 0);
    expect(result.y).toBeCloseTo(100, 0);
  });
});

test.describe("symmetric 拘束", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("2つの rect が Y 軸に対して対称になる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 50,
        y: 50,
        width: 40,
        height: 40,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      addShape({
        id: "r2",
        type: "rect",
        x: 50,
        y: 200,
        width: 40,
        height: 40,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      addConstraint({
        type: "symmetric",
        shapeIds: ["r1", "r2"],
        params: { axis: "y", value: 150 },
      });
      applyConstraints();
      const realScale = { numerator: 10, denominator: 1 };
      const centerY = (id) => {
        const shape = findShapeById(id)?.shape;
        const bb = getShapeBBox(shape, realScale);
        return bb.y + bb.h / 2;
      };
      return { cy1: centerY("r1"), cy2: centerY("r2") };
    });
    expect(result.cy1 + result.cy2).toBeCloseTo(300, 0);
    expect(Math.abs(result.cy1 - 150)).toBeCloseTo(
      Math.abs(result.cy2 - 150),
      0,
    );
  });
});

test.describe("moveShapeToPosition", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("移動後に horizontal 拘束が自動適用される", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addConstraint({ type: "horizontal", shapeIds: ["l1"] });
      moveShapeToPosition("l1", 50, 80);
      const s = findShapeById("l1")?.shape;
      return { y1: s?.y1, y2: s?.y2 };
    });
    expect(result.y1).toBeCloseTo(result.y2, 3);
  });
});

test.describe("applyDrawingCommands — 拘束コマンド", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("addConstraint アクションが page.constraints に格納される", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "l1",
            type: "line",
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 20,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
        {
          action: "addConstraint",
          constraint: { id: "cst1", type: "horizontal", shapeIds: ["l1"] },
        },
      ]);
      const pg = getCurrentPage();
      return {
        count: pg.constraints?.length,
        id: pg.constraints?.[0]?.id,
      };
    });
    expect(result.count).toBe(1);
    expect(result.id).toBe("cst1");
  });

  test("removeConstraint アクションが拘束を削除する", async ({ page }) => {
    const result = await page.evaluate(() => {
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "l1",
            type: "line",
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 20,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
        {
          action: "addConstraint",
          constraint: { id: "cst1", type: "horizontal", shapeIds: ["l1"] },
        },
      ]);
      applyDrawingCommands([{ action: "removeConstraint", id: "cst1" }]);
      return getCurrentPage().constraints?.length;
    });
    expect(result).toBe(0);
  });

  test("applyConstraints アクションが拘束を解く", async ({ page }) => {
    const result = await page.evaluate(() => {
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "l1",
            type: "line",
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 30,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
        {
          action: "addConstraint",
          constraint: { id: "cst1", type: "horizontal", shapeIds: ["l1"] },
        },
        { action: "applyConstraints" },
      ]);
      const s = findShapeById("l1")?.shape;
      return { y1: s?.y1, y2: s?.y2 };
    });
    expect(result.y1).toBeCloseTo(result.y2, 3);
  });
});
