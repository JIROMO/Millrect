/**
 * agent-api.spec.js — Intent API（mm 第一級・高レベル作図）
 */
"use strict";

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page) {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill("Intent API Test");
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(
      window.createMultiviewBox &&
      window.createPart &&
      window.applyPartDsl &&
      window.compilePartDslPlan &&
      window.updatePartParam &&
      window.importPartDslJson &&
      window.validatePartManufacturability &&
      window.validate3DReadiness &&
      window.layoutRectOnPageMm,
    ),
  );
}

test.describe("Intent API", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("validate3DReadiness — 空プロジェクトは NEED_TWO_AXES", async ({
    page,
  }) => {
    await openNewProject(page);
    const result = await page.evaluate(() => validate3DReadiness());
    expect(result.ok).toBe(false);
    expect(result.axisCount).toBe(1);
    expect(result.issues.some((i) => i.code === "NEED_TWO_AXES")).toBe(true);
  });

  test("createMultiviewBox — 100×60×40 mm で 3 面ページ生成・readiness OK", async ({
    page,
  }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      createMultiviewBox({
        projectName: "Box Intent",
        sizeMm: { width: 100, depth: 60, height: 40 },
        views: ["top", "front", "right"],
        scale: { numerator: 1, denominator: 1 },
        update3d: true,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.readiness.ok).toBe(true);
    expect(result.views).toEqual(["top", "front", "right"]);
    expect(result.pageIds.length).toBe(3);
  });

  test("layoutRectOnPageMm — 現在ページに 80×50 mm 矩形", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      layoutRectOnPageMm(80, 50, { addDimensions: true }),
    );
    expect(result.ok).toBe(true);
    expect(result.rect.mmW).toBe(80);
    expect(result.rect.mmH).toBe(50);

    const state = await page.evaluate(() => {
      const pageObj = getCurrentPage();
      return {
        shapeCount: pageObj.layers[0].shapes.length,
        dimCount: (pageObj.dimensions || []).length,
      };
    });
    expect(state.shapeCount).toBe(1);
    expect(state.dimCount).toBe(2);
  });

  test("createMultiviewBox — addDimensions で各ページに寸法線", async ({
    page,
  }) => {
    await openNewProject(page);
    await page.evaluate(() =>
      createMultiviewBox({
        sizeMm: { width: 120, depth: 80, height: 50 },
        views: ["top", "front"],
        addDimensions: true,
        update3d: false,
      }),
    );
    const dims = await page.evaluate(() =>
      getState().pages.map((p) => (p.dimensions || []).length),
    );
    expect(dims).toEqual([2, 2]);
  });

  test("createPart — hole_grid で上面 path に 4 穴", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      createPart({
        kind: "box",
        sizeMm: { width: 100, depth: 60, height: 40 },
        views: ["top", "front", "right"],
        features: [
          {
            type: "hole_grid",
            view: "top",
            diameter_mm: 4,
            inset_mm: 8,
            count: [2, 2],
          },
        ],
        update3d: true,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.appliedFeatures[0].holeCount).toBe(4);

    const topShape = await page.evaluate(() => {
      const topPage = getState().pages.find(
        (p) => p.viewDefinition?.type === "top",
      );
      return topPage?.layers[0]?.shapes[0];
    });
    expect(topShape.type).toBe("path");
    expect(topShape.contours[0].length).toBe(5);
  });

  test("applyPartDsl — DSL v1 で box + hole_grid", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      applyPartDsl({
        version: 1,
        part: "box",
        params: { W: 100, D: 60, H: 40 },
        views: ["top", "front", "right"],
        features: [
          {
            type: "hole_grid",
            view: "top",
            diameter_mm: 4,
            inset_mm: 8,
            count: [2, 2],
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.dsl.params.W).toBe(100);
    expect(result.compilePlan.constraints.length).toBeGreaterThan(0);
  });

  test("compilePartDslPlan — dry-run で state 不変", async ({ page }) => {
    await openNewProject(page);
    const before = await page.evaluate(() => getState().pages.length);
    const plan = await page.evaluate(() =>
      compilePartDslPlan({
        part: "box",
        params: { W: 50, D: 30, H: 20 },
      }),
    );
    const after = await page.evaluate(() => getState().pages.length);
    expect(plan.ok).toBe(true);
    expect(plan.buildOptions.sizeMm.width).toBe(50);
    expect(after).toBe(before);
  });

  test("updatePartParam — Solver 差分更新（pageIds 維持）", async ({
    page,
  }) => {
    await openNewProject(page);
    const created = await page.evaluate(() =>
      applyPartDsl({
        part: "box",
        params: { W: 100, D: 60, H: 40 },
        views: ["top", "front", "right"],
      }),
    );
    expect(created.ok).toBe(true);
    const pageIdsBefore = created.pageIds;

    const updated = await page.evaluate(() => updatePartParam("W", 150));
    expect(updated.ok).toBe(true);
    expect(updated.mode).toBe("solver");
    expect(updated.sizeMm.width).toBe(150);

    const pageIdsAfter = await page.evaluate(() =>
      getState().pages.map((p) => p.id),
    );
    expect(pageIdsAfter).toEqual(pageIdsBefore);

    const topWidth = await page.evaluate(() => {
      const st = getState();
      const top = st.pages.find((p) => p.viewDefinition.type === "top");
      const shape = top.layers[0].shapes[0];
      return shape.type === "rect" ? shape.width : null;
    });
    expect(topWidth).toBeCloseTo(1500, 0);
  });

  test("importPartDslJson — fixture から box 生成", async ({ page }) => {
    await openNewProject(page);
    const fixture = await page.evaluate(async () => {
      const res = await fetch("/tests/fixtures/sample-box.mlr-part.json");
      return res.text();
    });
    const result = await page.evaluate(
      (json) => importPartDslJson(json),
      fixture,
    );
    expect(result.ok).toBe(true);
    expect(result.dsl.params.W).toBe(80);
    expect(result.partIntent).toBeTruthy();
    const intent = await page.evaluate(() => getState().partIntent);
    expect(intent.dsl.params.D).toBe(50);
  });

  test("applyPartDsl — panel + fillet", async ({ page }) => {
    await openNewProject(page);
    const intent = await page.evaluate(() =>
      applyPartDsl({
        part: "panel",
        params: { W: 120, H: 80 },
        features: [{ type: "fillet", radius_mm: 4 }],
      }),
    );
    expect(intent.ok).toBe(true);
    expect(intent.dsl.part).toBe("panel");
    const rx = await page.evaluate(() => {
      const p = getState().pages[0];
      return p.layers[0].shapes[0].rx;
    });
    expect(rx).toBeCloseTo(40, 0);
  });

  test("applyPartDsl — l_bracket 2 ページ", async ({ page }) => {
    await openNewProject(page);
    const result = await page.evaluate(() =>
      applyPartDsl({
        part: "l_bracket",
        params: { A: 80, B: 60, T: 5, H: 40 },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.pageIds.length).toBe(2);
    const types = await page.evaluate(() =>
      getState().pages.map((p) => p.layers[0].shapes[0].type),
    );
    expect(types).toEqual(["path", "rect"]);
  });

  test("validatePartManufacturability — dry-run", async ({ page }) => {
    await openNewProject(page);
    const r = await page.evaluate(() =>
      validatePartManufacturability({
        part: "panel",
        params: { W: 100, H: 80 },
        manufacturing: { min_hole_diameter_mm: 3 },
        features: [{ type: "hole_grid", diameter_mm: 1 }],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
    const pagesBefore = await page.evaluate(() => getState().pages.length);
    expect(pagesBefore).toBe(1);
  });
});
