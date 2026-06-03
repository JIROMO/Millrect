/**
 * state.spec.js — State管理・Undo/Redo テスト
 *
 * 検証する設計原則:
 *   - Undo/Redo はドキュメント（pages/shapes）のみ巻き戻す
 *   - zoom / pan / activeTool は Undo で変化しない
 *   - pushHistory() が正しいタイミングで呼ばれる
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "State Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("State / Undo / Redo", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  // ── Undo/Redo の基本 ─────────────────────────────────────────

  test("addShape → Undo でシェイプが消える", async ({ page }) => {
    const count = await page.evaluate(() => {
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
      undo();
      return getAllShapesOnPage(getCurrentPage()).length;
    });
    expect(count).toBe(0);
  });

  test("Undo → Redo でシェイプが復元される", async ({ page }) => {
    const result = await page.evaluate(() => {
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
      undo();
      redo();
      return getAllShapesOnPage(getCurrentPage()).map((s) => s.id);
    });
    expect(result).toContain("s1");
  });

  test("Undo は zoom を変化させない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const before = getState().zoom;
      getState().zoom = 5.0; // UIでzoom変更（Undo対象外）
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
      undo();
      return { before, after: getState().zoom };
    });
    // Undo後もzoomは5.0のまま（Undoで巻き戻らない）
    expect(result.after).toBe(5.0);
  });

  test("Undo は activeTool を変化させない", async ({ page }) => {
    const result = await page.evaluate(() => {
      getState().activeTool = "rect";
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
      undo();
      return getState().activeTool;
    });
    expect(result).toBe("rect");
  });

  test("Undo は selectedShapeIds を変化させない", async ({ page }) => {
    const result = await page.evaluate(() => {
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
      getState().selectedShapeIds = ["s1"];
      addShape({
        id: "s2",
        type: "circle",
        cx: 200,
        cy: 200,
        r: 50,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      undo(); // s2追加を Undo
      return getState().selectedShapeIds;
    });
    // selectedShapeIds はUndoで変化しない
    expect(result).toEqual(["s1"]);
  });

  test("Undo 後に autosave が IndexedDB を更新する", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "autosave-s1",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
    });
    await expect(
      page.locator('#status-autosave[data-state="unsaved"]'),
    ).toBeVisible();
    await expect(
      page.locator('#status-autosave[data-state="saved"]'),
    ).toBeVisible({
      timeout: 5000,
    });

    const withShape = await page.evaluate(async () => {
      const proj = await dbLoadProject(getCurrentProjectId());
      const data = JSON.parse(proj.data);
      return data.pages.flatMap((p) =>
        p.layers.flatMap((l) => (l.shapes || []).map((s) => s.id)),
      );
    });
    expect(withShape).toContain("autosave-s1");

    await page.evaluate(() => undo());
    await expect(
      page.locator('#status-autosave[data-state="unsaved"]'),
    ).toBeVisible();
    await expect(
      page.locator('#status-autosave[data-state="saved"]'),
    ).toBeVisible({
      timeout: 5000,
    });

    const afterUndo = await page.evaluate(async () => {
      const proj = await dbLoadProject(getCurrentProjectId());
      const data = JSON.parse(proj.data);
      return data.pages.flatMap((p) =>
        p.layers.flatMap((l) => (l.shapes || []).map((s) => s.id)),
      );
    });
    expect(afterUndo).not.toContain("autosave-s1");
  });

  test("canUndo / canRedo が正しい状態を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      const init = { canUndo: canUndo(), canRedo: canRedo() };
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
      const after = { canUndo: canUndo(), canRedo: canRedo() };
      undo();
      const undone = { canUndo: canUndo(), canRedo: canRedo() };
      return { init, after, undone };
    });
    expect(result.init.canUndo).toBe(false);
    expect(result.after.canUndo).toBe(true);
    expect(result.after.canRedo).toBe(false);
    expect(result.undone.canUndo).toBe(false);
    expect(result.undone.canRedo).toBe(true);
  });

  // ── ドキュメント状態の整合性 ─────────────────────────────────

  test("replaceState でドキュメントが置き換わり Undo 履歴がリセットされる", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
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
      const newState = getState();
      newState.projectName = "Replaced";
      replaceState(newState);
      return { name: getState().projectName, canUndo: canUndo() };
    });
    expect(result.name).toBe("Replaced");
    expect(result.canUndo).toBe(false);
  });
});
