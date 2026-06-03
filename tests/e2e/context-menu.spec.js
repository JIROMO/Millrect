/**
 * context-menu.spec.js — 図形右クリックの Figma 風コンテキストメニュー
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Context Menu Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("コンテキストメニュー", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("図形上で右クリックするとメニューが表示される", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "ctx-rect",
        type: "rect",
        x: 100,
        y: 100,
        width: 200,
        height: 120,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      render();
    });

    const box = await page.locator('[data-id="ctx-rect"]').boundingBox();
    expect(box).toBeTruthy();

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      button: "right",
    });

    const menu = page.locator("#ctx-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "コピー" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test("削除メニューで図形を削除できる", async ({ page }) => {
    await page.evaluate(() => {
      addShape({
        id: "ctx-del",
        type: "rect",
        x: 50,
        y: 50,
        width: 100,
        height: 80,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      render();
    });

    const box = await page.locator('[data-id="ctx-del"]').boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      button: "right",
    });
    const menu = page.locator("#ctx-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "削除" }).click();

    await expect(page.locator('[data-id="ctx-del"]')).toHaveCount(0);
  });

  test("空白右クリックでは貼り付けとすべて選択が出る", async ({ page }) => {
    const box = await page.locator("#main-svg").boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5, {
      button: "right",
    });
    const menu = page.locator("#ctx-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "貼り付け" })).toBeDisabled();
    await expect(
      menu.getByRole("button", { name: "すべて選択" }),
    ).toBeEnabled();
  });
});
