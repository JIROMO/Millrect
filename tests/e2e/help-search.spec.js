/**
 * help-search.spec.js — ヘルプ検索オーバーレイとドキュメントビューア
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Help Search Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(
      window.getState?.() &&
      window.getCurrentPage?.() &&
      window.searchHelpIndex,
    ),
  );
}

test.describe("ヘルプ検索", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("openHelpSearch でオーバーレイが開く", async ({ page }) => {
    await page.evaluate(() => openHelpSearch());
    const overlay = page.locator("#help-search-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.locator("#help-search-input")).toBeFocused();
  });

  test("キーワード検索で 3D 関連トピックがヒットする", async ({ page }) => {
    await page.evaluate(() => openHelpSearch());
    await page.locator("#help-search-input").fill("3D");
    const items = page.locator(".help-search-item");
    await expect(items.first()).toBeVisible();
    const titles = await items.allTextContents();
    expect(titles.some((t) => /3D|立体|メッシュ|サンプル/i.test(t))).toBe(true);
  });

  test("検索結果を選択するとドキュメントビューアが開く", async ({ page }) => {
    await page.evaluate(() => openHelpSearch());
    await page.locator("#help-search-input").fill("STL");
    await page.locator(".help-search-item").first().click();

    const viewer = page.locator("#docs-viewer-overlay");
    await expect(viewer).toBeVisible();
    await expect(page.locator("#docs-viewer-frame")).toHaveAttribute(
      "src",
      /docs\/.*\.html/,
    );
    await expect(page.locator("#help-search-overlay")).toBeHidden();
  });

  test("searchHelpIndex は空クエリで結果を返さない", async ({ page }) => {
    const count = await page.evaluate(() => searchHelpIndex("", 12).length);
    expect(count).toBe(0);
  });

  test("Esc でヘルプ検索を閉じられる", async ({ page }) => {
    await page.evaluate(() => openHelpSearch());
    await page.locator("#help-search-input").press("Escape");
    await expect(page.locator("#help-search-overlay")).toBeHidden();
  });

  test("英語 UI では英語キーワードと結果ラベルで検索できる", async ({
    page,
  }) => {
    await page.evaluate(() => {
      setLocale("en");
    });
    await page.evaluate(() => openHelpSearch());
    await expect(page.locator("#help-search-title")).toHaveText("Search help");
    await page.locator("#help-search-input").fill("layer");
    const first = page.locator(".help-search-item").first();
    await expect(first).toBeVisible();
    await expect(first).toContainText(/layer|page/i);
  });
});
