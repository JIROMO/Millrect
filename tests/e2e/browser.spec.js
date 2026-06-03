const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "E2E Project") {
  await page.goto(appUrl);
  await expect(page.locator(".toolbar-logo")).toHaveText("MILLRECT");
  await expect(
    page.locator("text=このアプリはデスクトップアプリとして起動してください"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();

  await expect(page.locator("#startup-overlay")).toHaveCount(0);
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("browser E2E", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => {
      throw error;
    });
  });

  test("loads in a regular browser and creates a project", async ({ page }) => {
    await openNewProject(page, "Browser E2E");

    await expect(page.locator("#project-name")).toHaveValue("Browser E2E");
    await expect(page.locator("#status-tool")).toHaveText("SELECT");
    await expect(page.locator("#status-scale")).toHaveText("1/10");
  });

  test("AI can drive the drawing API end to end", async ({ page }) => {
    await openNewProject(page, "AI E2E");

    const result = await page.evaluate(async () => {
      applyDrawingCommands([
        {
          action: "addShape",
          shape: {
            id: "e2e-rect",
            type: "rect",
            x: 100,
            y: 100,
            width: 500,
            height: 300,
            stroke: "#1a1a2e",
            fill: "none",
            strokeWidth: "medium",
          },
        },
        {
          action: "selectShapes",
          ids: ["e2e-rect"],
        },
      ]);
      render();
      uiUpdate();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const page = getCurrentPage();
      return {
        shapeCount: getAllShapesOnPage(page).length,
        selectedShapeIds: getState().selectedShapeIds,
        svg: buildPageSVG(page).outerHTML,
      };
    });

    expect(result.shapeCount).toBe(1);
    expect(result.selectedShapeIds).toEqual(["e2e-rect"]);
    expect(result.svg).toContain("e2e-rect");
    await expect(page.locator('#main-svg [data-id="e2e-rect"]')).toBeVisible();
  });
});
