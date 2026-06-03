/**
 * reference-image + docs-api E2E
 */
"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Ref Image Test");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(
      window.setReferenceImage &&
      window.listDocsScenarios &&
      window.applyDigitizeProposals,
    ),
  );
}

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test.describe("参照画像 + docs-api", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
  });

  test("setReferenceImage — SVG に reference-image が描画される", async ({
    page,
  }) => {
    await openNewProject(page);
    await page.evaluate(
      (dataUrl) =>
        setReferenceImage(null, {
          dataUrl,
          widthMm: 50,
          heightMm: 30,
          opacity: 0.5,
        }),
      TINY_PNG,
    );
    await expect(page.locator("#reference-image")).toHaveCount(1);
  });

  test("setReferenceImageScaleAnchor — 幅がスケールされる", async ({
    page,
  }) => {
    await openNewProject(page);
    const before = await page.evaluate((dataUrl) => {
      setReferenceImage(null, {
        dataUrl,
        x: 0,
        y: 0,
        width: 1000,
        height: 500,
      });
      return getReferenceImage().width;
    }, TINY_PNG);
    await page.evaluate(() =>
      setReferenceImageScaleAnchor(
        null,
        { x: 100, y: 100 },
        { x: 600, y: 100 },
        100,
      ),
    );
    const after = await page.evaluate(() => getReferenceImage().width);
    expect(after).toBe(2000);
  });

  test("listDocsScenarios — 6 シナリオ以上", async ({ page }) => {
    await openNewProject(page);
    const list = await page.evaluate(() => listDocsScenarios());
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.some((s) => s.id === "multiview_box_3view")).toBe(true);
    expect(list.some((s) => s.id === "sketch_digitize_demo")).toBe(true);
  });

  test("runDocsScenario — sketch_digitize_demo", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      runDocsScenario("sketch_digitize_demo", { locale: "ja" }),
    );
    expect(result.ok).toBe(true);
    await expect(page.locator("#reference-image")).toHaveCount(1);
    await expect(page.locator('[data-ghost="true"]')).toHaveCount(1);
  });

  test("runDocsScenario — drawing_rect", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      runDocsScenario("drawing_rect", { locale: "ja" }),
    );
    expect(result.ok).toBe(true);
    const shape = await page.evaluate(() => findShapeById("doc-rect"));
    expect(shape?.shape?.type).toBe("rect");
  });

  test("beginReferenceScaleAnchor — 2 点 + mm でスケール", async ({ page }) => {
    await openNewProject(page);
    await page.evaluate(
      (dataUrl) =>
        setReferenceImage(null, {
          dataUrl,
          x: 0,
          y: 0,
          width: 1000,
          height: 500,
        }),
      TINY_PNG,
    );
    await page.evaluate(() => beginReferenceScaleAnchor(null));
    await page.evaluate(() =>
      handleReferenceScaleAnchorClick({ x: 100, y: 100 }),
    );
    await page.evaluate(() =>
      handleReferenceScaleAnchorClick({ x: 600, y: 100 }),
    );
    await page.evaluate(() => completeReferenceScaleAnchor(100));
    const after = await page.evaluate(() => getReferenceImage().width);
    expect(after).toBe(2000);
    await expect(page.locator("#reference-scale-anchor")).toHaveCount(0);
  });

  test("applyDigitizeProposals — ゴースト rect + 確定", async ({ page }) => {
    await openNewProject(page);
    const apply = await page.evaluate(() =>
      applyDigitizeProposals(null, [
        { type: "rect", x_mm: 10, y_mm: 10, width_mm: 40, height_mm: 20 },
      ]),
    );
    expect(apply.ok).toBe(true);
    expect(apply.shapeIds.length).toBe(1);

    const ghost = await page.evaluate(
      (id) => findShapeById(id)?.shape?.ghost,
      apply.shapeIds[0],
    );
    expect(ghost).toBe(true);
    await expect(page.locator('[data-ghost="true"]')).toHaveCount(1);

    const profileBefore = await page.evaluate(
      () => extractProfilesFromPage(getCurrentPage()).length,
    );
    expect(profileBefore).toBe(0);

    const confirm = await page.evaluate(() => confirmDigitizeProposals(null));
    expect(confirm.ok).toBe(true);

    const profileAfter = await page.evaluate(
      () => extractProfilesFromPage(getCurrentPage()).length,
    );
    expect(profileAfter).toBe(1);
  });
});
