/**
 * shapes.spec.js — 図形CRUD・dimension分離・ID安定性 テスト
 *
 * 検証する設計原則:
 *   - dimension は layer.shapes に混入しない（page.dimensions[] に格納される）
 *   - ID重複時は自動再生成される
 *   - findShapeById が shapes / dimensions 両方を検索する
 *   - deleteShape が dimension も正しく削除する
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Shapes Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("図形CRUD", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  // ── 基本 CRUD ────────────────────────────────────────────────

  test("rect を追加・更新・削除できる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 10,
        y: 10,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      updateShape("r1", { fill: "#ff0000" });
      const after = findShapeById("r1");
      deleteShape("r1");
      const deleted = findShapeById("r1");
      return { fill: after?.shape.fill, deleted: deleted === null };
    });
    expect(result.fill).toBe("#ff0000");
    expect(result.deleted).toBe(true);
  });

  test("circle / line / text を追加できる", async ({ page }) => {
    const types = await page.evaluate(() => {
      addShape({
        id: "c1",
        type: "circle",
        cx: 100,
        cy: 100,
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
        x2: 100,
        y2: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      addShape({
        id: "t1",
        type: "text",
        x: 50,
        y: 50,
        text: "Hello",
        stroke: "#000",
        fill: "#000",
        strokeWidth: "thin",
      });
      return getAllShapesOnPage(getCurrentPage()).map((s) => s.type);
    });
    expect(types).toContain("circle");
    expect(types).toContain("line");
    expect(types).toContain("text");
  });

  // ── dimension の分離 ─────────────────────────────────────────

  test("dimension は layer.shapes に混入せず page.dimensions に格納される", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 100 },
        to: { x: 200, y: 100 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      const page = getCurrentPage();
      const inShapes = getAllShapesOnPage(page).some((s) => s.id === "d1");
      const inDims = (page.dimensions || []).some((d) => d.id === "d1");
      return { inShapes, inDims };
    });
    expect(result.inShapes).toBe(false); // shapes には入らない
    expect(result.inDims).toBe(true); // dimensions に入る
  });

  test("getAllShapesOnPage は dimension を返さない", async ({ page }) => {
    const result = await page.evaluate(() => {
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
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 200 },
        to: { x: 100, y: 200 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      return {
        shapes: getAllShapesOnPage(getCurrentPage()).map((s) => s.id),
        dims: getAllDimensionsOnPage(getCurrentPage()).map((d) => d.id),
      };
    });
    expect(result.shapes).toContain("r1");
    expect(result.shapes).not.toContain("d1");
    expect(result.dims).toContain("d1");
  });

  test("findShapeById は dimension も検索して isDimension=true を返す", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "vertical",
        from: { x: 0, y: 0 },
        to: { x: 0, y: 200 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      const res = findShapeById("d1");
      return {
        found: res !== null,
        isDimension: res?.isDimension,
        layerIsNull: res?.layer === null,
      };
    });
    expect(result.found).toBe(true);
    expect(result.isDimension).toBe(true);
    expect(result.layerIsNull).toBe(true); // dimension は layer に属さない
  });

  test("deleteShape で dimension を削除できる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 100 },
        to: { x: 200, y: 100 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      deleteShape("d1");
      return getAllDimensionsOnPage(getCurrentPage()).some(
        (d) => d.id === "d1",
      );
    });
    expect(result).toBe(false);
  });

  test("dimension 削除が Undo/Redo できる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 100 },
        to: { x: 200, y: 100 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      deleteShape("d1");
      undo();
      const afterUndo = getAllDimensionsOnPage(getCurrentPage()).some(
        (d) => d.id === "d1",
      );
      redo();
      const afterRedo = getAllDimensionsOnPage(getCurrentPage()).some(
        (d) => d.id === "d1",
      );
      return { afterUndo, afterRedo };
    });
    expect(result.afterUndo).toBe(true); // Undo で復元される
    expect(result.afterRedo).toBe(false); // Redo で再削除される
  });

  // ── ID安定性 ─────────────────────────────────────────────────

  test("applyDrawingCommands でID重複時は再生成される", async ({ page }) => {
    const result = await page.evaluate(() => {
      // まず s1 を追加
      addShape({
        id: "s1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      // 同じIDで再度追加（重複）
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "s1",
            type: "circle",
            cx: 200,
            cy: 200,
            r: 50,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
      ]);
      render();
      const shapes = getAllShapesOnPage(getCurrentPage());
      return {
        count: shapes.length,
        ids: shapes.map((s) => s.id),
        hasCircle: shapes.some((s) => s.type === "circle"),
      };
    });
    expect(result.count).toBe(2); // 2つ追加されている
    const uniqueIds = new Set(result.ids);
    expect(uniqueIds.size).toBe(2); // IDが重複していない
    expect(result.hasCircle).toBe(true); // circle は追加されている
  });

  // ── applyDrawingCommands ─────────────────────────────────────

  test("applyDrawingCommands バッチ操作が正しく動作する", async ({ page }) => {
    const result = await page.evaluate(() => {
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "b1",
            type: "rect",
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            stroke: "#000",
            fill: "none",
            strokeWidth: "medium",
          },
        },
        {
          action: "addShape",
          shape: {
            id: "b2",
            type: "circle",
            cx: 300,
            cy: 200,
            r: 80,
            stroke: "#000",
            fill: "#aabbcc",
            strokeWidth: "thin",
          },
        },
        { action: "updateShape", id: "b1", values: { fill: "#ff0000" } },
        { action: "selectShapes", ids: ["b1", "b2"] },
      ]);
      render();
      const b1 = findShapeById("b1")?.shape;
      return {
        count: getAllShapesOnPage(getCurrentPage()).length,
        b1fill: b1?.fill,
        selected: getState().selectedShapeIds,
      };
    });
    expect(result.count).toBe(2);
    expect(result.b1fill).toBe("#ff0000");
    expect(result.selected).toEqual(["b1", "b2"]);
  });

  test("addDimension アクションが page.dimensions に格納される", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      applyDrawingCommands([
        {
          action: "addDimension",
          dimension: {
            id: "dim1",
            dimensionType: "horizontal",
            from: { x: 0, y: 300 },
            to: { x: 400, y: 300 },
            offset: 40,
            stroke: "#000",
            fill: "none",
            strokeWidth: "thin",
          },
        },
      ]);
      return {
        inShapes: getAllShapesOnPage(getCurrentPage()).some(
          (s) => s.id === "dim1",
        ),
        inDims: getAllDimensionsOnPage(getCurrentPage()).some(
          (d) => d.id === "dim1",
        ),
      };
    });
    expect(result.inShapes).toBe(false);
    expect(result.inDims).toBe(true);
  });
});
