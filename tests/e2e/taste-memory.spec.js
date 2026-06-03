// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Taste Memory — projectBrief", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/index.html");
    await page.waitForFunction(() => typeof getState === "function");
  });

  test("updateProjectBrief and undo restore", async ({ page }) => {
    const result = await page.evaluate(() => {
      updateProjectBrief({
        intent: "スマホケース",
        designPrinciples: [{ statement: "日用品感を優先", polarity: "prefer" }],
      });
      const beforeUndo = getState().projectBrief?.intent;
      undo();
      const afterUndo = getState().projectBrief;
      return { beforeUndo, afterUndo };
    });
    expect(result.beforeUndo).toBe("スマホケース");
    expect(result.afterUndo).toBeNull();
  });

  test("export JSON includes projectBrief", async ({ page }) => {
    const json = await page.evaluate(() => {
      updateProjectBrief({ intent: "test part" });
      return exportProjectJsonString();
    });
    const data = JSON.parse(json);
    expect(data.projectBrief).toBeTruthy();
    expect(data.projectBrief.intent).toBe("test part");
  });

  test("recordDecision appends judgment", async ({ page }) => {
    const count = await page.evaluate(() => {
      recordDecision({ outcome: "reject", reason: "角が丸すぎる" });
      return getState().projectBrief?.decisions?.length ?? 0;
    });
    expect(count).toBe(1);
  });

  test("recordCaptureArtifactLog appends artifactLog", async ({ page }) => {
    const count = await page.evaluate(() => {
      recordCaptureArtifactLog(
        {
          ok: true,
          relativePath: "docs/images/test.png",
          width: 100,
          height: 80,
        },
        { pushHistory: false },
      );
      return getState().projectBrief?.artifactLog?.length ?? 0;
    });
    expect(count).toBe(1);
  });

  test("requireBriefBeforeMake blocks applyPartDsl when enabled", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      localStorage.setItem("millrect-require-brief-before-make", "1");
      setProjectPhase("discover", { pushHistory: false });
      return applyPartDsl({
        part: "box",
        params: { W: 50, D: 40, H: 30 },
      });
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BRIEF_REQUIRED");
    await page.evaluate(() => {
      localStorage.removeItem("millrect-require-brief-before-make");
    });
  });
});
