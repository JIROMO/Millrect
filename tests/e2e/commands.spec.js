/**
 * commands.spec.js — 整列・配分・グループ・コピー/ペースト
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Commands Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
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
    },
    { id, x, y, width, height },
  );
}

function selectShapes(page, ids) {
  return page.evaluate((ids) => {
    getState().selectedShapeIds = ids;
  }, ids);
}

test.describe("整列・配分", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("alignShapes(left) で選択図形の左端が揃う", async ({ page }) => {
    await addRect(page, "a", 10, 20, 50, 50);
    await addRect(page, "b", 120, 80, 30, 40);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      alignShapes("left");
      const scale = { numerator: 10, denominator: 1 };
      const bbA = getShapeBBox(findShapeById("a").shape, scale);
      const bbB = getShapeBBox(findShapeById("b").shape, scale);
      return { leftA: bbA.x, leftB: bbB.x };
    });

    expect(result.leftA).toBeCloseTo(result.leftB, 1);
    expect(result.leftA).toBeCloseTo(10, 1);
  });

  test("alignShapes(centerH) で選択図形の水平中心が揃う", async ({ page }) => {
    await addRect(page, "a", 0, 0, 100, 40);
    await addRect(page, "b", 200, 100, 60, 60);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      alignShapes("centerH");
      const scale = { numerator: 10, denominator: 1 };
      const bbA = getShapeBBox(findShapeById("a").shape, scale);
      const bbB = getShapeBBox(findShapeById("b").shape, scale);
      const cA = bbA.x + bbA.w / 2;
      const cB = bbB.x + bbB.w / 2;
      return { cA, cB };
    });

    expect(result.cA).toBeCloseTo(result.cB, 1);
  });

  test("distributeShapes(h) で 3 図形の水平間隔が均等になる", async ({
    page,
  }) => {
    await addRect(page, "a", 0, 0, 40, 40);
    await addRect(page, "b", 80, 0, 40, 40);
    await addRect(page, "c", 200, 0, 40, 40);
    await selectShapes(page, ["a", "b", "c"]);

    const result = await page.evaluate(() => {
      distributeShapes("h");
      const scale = { numerator: 10, denominator: 1 };
      const bbs = ["a", "b", "c"].map((id) =>
        getShapeBBox(findShapeById(id).shape, scale),
      );
      bbs.sort((x, y) => x.x - y.x);
      const gap1 = bbs[1].x - (bbs[0].x + bbs[0].w);
      const gap2 = bbs[2].x - (bbs[1].x + bbs[1].w);
      return { gap1, gap2 };
    });

    expect(result.gap1).toBeCloseTo(result.gap2, 1);
    expect(result.gap1).toBeGreaterThan(0);
  });
});

test.describe("グループ操作", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("groupSelectedShapes で 2 図形が 1 グループになる", async ({ page }) => {
    await addRect(page, "a", 0, 0, 50, 50);
    await addRect(page, "b", 60, 0, 50, 50);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      groupSelectedShapes();
      const layer = getCurrentLayer();
      const group = layer.shapes.find((s) => s.type === "group");
      return {
        count: layer.shapes.length,
        groupType: group?.type,
        childCount: group?.children?.length ?? 0,
        selected: getState().selectedShapeIds,
      };
    });

    expect(result.count).toBe(1);
    expect(result.groupType).toBe("group");
    expect(result.childCount).toBe(2);
    expect(result.selected).toHaveLength(1);
  });

  test("ungroupSelectedShapes でグループが解除される", async ({ page }) => {
    await addRect(page, "a", 0, 0, 50, 50);
    await addRect(page, "b", 60, 0, 50, 50);
    await selectShapes(page, ["a", "b"]);

    const result = await page.evaluate(() => {
      groupSelectedShapes();
      const groupId = getState().selectedShapeIds[0];
      ungroupSelectedShapes();
      const layer = getCurrentLayer();
      return {
        count: layer.shapes.length,
        types: layer.shapes.map((s) => s.type),
        selected: getState().selectedShapeIds.sort(),
      };
    });

    expect(result.count).toBe(2);
    expect(result.types).toEqual(["rect", "rect"]);
    expect(result.selected).toEqual(["a", "b"]);
  });
});

test.describe("コピー / ペースト", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("copyShapes → pasteShapes で複製がオフセット付きで追加される", async ({
    page,
  }) => {
    await addRect(page, "src", 100, 100, 80, 60);
    await selectShapes(page, ["src"]);

    const result = await page.evaluate(() => {
      const pageObj = getCurrentPage();
      const mmPerUnit = pageObj.scale.denominator / pageObj.scale.numerator;
      const expectedOffset = 10 * mmPerUnit;
      const scale = { numerator: 10, denominator: 1 };
      const before = getShapeBBox(findShapeById("src").shape, scale);
      copyShapes();
      pasteShapes();
      const layer = getCurrentLayer();
      const cloneId = getState().selectedShapeIds[0];
      const clone = findShapeById(cloneId).shape;
      const after = getShapeBBox(clone, scale);
      return {
        count: layer.shapes.length,
        expectedOffset,
        dx: after.x - before.x,
        dy: after.y - before.y,
        cloneId,
      };
    });

    expect(result.count).toBe(2);
    expect(result.dx).toBeCloseTo(result.expectedOffset, 1);
    expect(result.dy).toBeCloseTo(result.expectedOffset, 1);
    expect(result.cloneId).not.toBe("src");
  });

  test("コンテキストメニューのコピー → 貼り付けが動作する", async ({
    page,
  }) => {
    await page.evaluate(() => {
      addShape({
        id: "ctx-copy",
        type: "rect",
        x: 120,
        y: 120,
        width: 100,
        height: 80,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      render();
    });

    const box = await page.locator('[data-id="ctx-copy"]').boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      button: "right",
    });
    const menu = page.locator("#ctx-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "コピー" }).click();

    await page.mouse.click(box.x + box.width + 40, box.y + box.height + 40, {
      button: "right",
    });
    await expect(menu).toBeVisible();
    const pasteBtn = menu.getByRole("button", { name: "貼り付け" });
    await expect(pasteBtn).toBeEnabled();
    await pasteBtn.click();

    const count = await page.evaluate(() => getCurrentLayer().shapes.length);
    expect(count).toBe(2);
  });
});
