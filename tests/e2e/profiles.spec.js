/**
 * profiles.spec.js — Profile抽出層テスト
 *
 * 検証する設計原則:
 *   - Profile は State に保存されない（派生データ）
 *   - canBeProfile() が正しく判定する
 *   - shapeToProfile() が正しい rings / bbox / area を返す
 *   - extractProfilesFromPage() が locked/invisible layerを除外する
 *   - dimension / line / text は Profile にならない
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Profiles Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("Profile抽出層", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  // ── canBeProfile ─────────────────────────────────────────────

  test("rect は Profile になれる", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(true);
  });

  test("circle は Profile になれる", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "c1",
        type: "circle",
        cx: 100,
        cy: 100,
        r: 50,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(true);
  });

  test("closed bezier は Profile になれる", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "b1",
        type: "bezier",
        closed: true,
        nodes: [
          { x: 0, y: 0, h1: null, h2: null },
          { x: 100, y: 0, h1: null, h2: null },
          { x: 100, y: 100, h1: null, h2: null },
          { x: 0, y: 100, h1: null, h2: null },
        ],
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(true);
  });

  test("open bezier は Profile になれない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "b1",
        type: "bezier",
        closed: false,
        nodes: [
          { x: 0, y: 0, h1: null, h2: null },
          { x: 100, y: 100, h1: null, h2: null },
        ],
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(false);
  });

  test("line は Profile になれない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(false);
  });

  test("text は Profile になれない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "t1",
        type: "text",
        x: 0,
        y: 0,
        text: "Hello",
        stroke: "#000",
        fill: "#000",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(false);
  });

  test("dimension は Profile になれない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "d1",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: 0, y: 100 },
        to: { x: 200, y: 100 },
        offset: 20,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return canBeProfile(shape);
    });
    expect(result).toBe(false);
  });

  // ── shapeToProfile ────────────────────────────────────────────

  test("rect の shapeToProfile が正しい id / sourceId / pageId を返す", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "r1",
        type: "rect",
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const prof = shapeToProfile(shape, "page-1");
      return { id: prof?.id, sourceId: prof?.sourceId, pageId: prof?.pageId };
    });
    expect(result.id).toBe("profile-r1");
    expect(result.sourceId).toBe("r1");
    expect(result.pageId).toBe("page-1");
  });

  test("rect の shapeToProfile が正しい bbox を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "r1",
        type: "rect",
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const prof = shapeToProfile(shape, "page-1");
      return prof?.bbox;
    });
    expect(result.minX).toBeCloseTo(10);
    expect(result.minY).toBeCloseTo(20);
    expect(result.maxX).toBeCloseTo(210);
    expect(result.maxY).toBeCloseTo(120);
  });

  test("rect の shapeToProfile が正しい area を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      };
      const prof = shapeToProfile(shape, "page-1");
      return prof?.area;
    });
    // 200 × 100 = 20000
    expect(result).toBeCloseTo(20000, 0);
  });

  test("line の shapeToProfile は null を返す", async ({ page }) => {
    const result = await page.evaluate(() => {
      const shape = {
        id: "l1",
        type: "line",
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      };
      return shapeToProfile(shape, "page-1");
    });
    expect(result).toBeNull();
  });

  // ── extractProfilesFromPage ───────────────────────────────────

  test("extractProfilesFromPage は shape を持つレイヤーから Profile を抽出する", async ({
    page,
  }) => {
    const count = await page.evaluate(() => {
      addShape({
        id: "r1",
        type: "rect",
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        stroke: "#000",
        fill: "none",
        strokeWidth: "medium",
      });
      addShape({
        id: "c1",
        type: "circle",
        cx: 300,
        cy: 200,
        r: 50,
        stroke: "#000",
        fill: "none",
        strokeWidth: "thin",
      });
      const profiles = extractProfilesFromPage(getCurrentPage());
      return profiles.length;
    });
    expect(count).toBe(2);
  });

  test("extractProfilesFromPage は line/text を Profile に含めない", async ({
    page,
  }) => {
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
      const profiles = extractProfilesFromPage(getCurrentPage());
      return { count: profiles.length, ids: profiles.map((p) => p.sourceId) };
    });
    expect(result.count).toBe(1);
    expect(result.ids).toContain("r1");
    expect(result.ids).not.toContain("l1");
    expect(result.ids).not.toContain("t1");
  });

  test("extractProfilesFromPage は dimension を Profile に含めない", async ({
    page,
  }) => {
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
      const profiles = extractProfilesFromPage(getCurrentPage());
      return { count: profiles.length, ids: profiles.map((p) => p.sourceId) };
    });
    expect(result.count).toBe(1);
    expect(result.ids).not.toContain("d1");
  });

  test("extractProfilesFromPage は locked レイヤーを除外する", async ({
    page,
  }) => {
    const count = await page.evaluate(() => {
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
      // lock the layer
      const pg = getCurrentPage();
      pg.layers[0].locked = true;
      const profiles = extractProfilesFromPage(pg);
      return profiles.length;
    });
    expect(count).toBe(0);
  });

  test("extractProfilesFromPage は非表示レイヤーを除外する", async ({
    page,
  }) => {
    const count = await page.evaluate(() => {
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
      const pg = getCurrentPage();
      pg.layers[0].visible = false;
      const profiles = extractProfilesFromPage(pg);
      return profiles.length;
    });
    expect(count).toBe(0);
  });

  test("group 自体は Profile になれない", async ({ page }) => {
    const result = await page.evaluate(() => {
      const group = {
        id: "g1",
        type: "group",
        children: [
          {
            id: "r1",
            type: "rect",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            stroke: "#000",
            fill: "none",
            strokeWidth: "medium",
          },
        ],
      };
      return canBeProfile(group);
    });
    expect(result).toBe(false);
  });

  test("extractProfilesFromPage は group 内の子図形を展開する", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const pg = getCurrentPage();
      pg.layers[0].shapes = [
        {
          id: "g1",
          type: "group",
          children: [
            {
              id: "r1",
              type: "rect",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              stroke: "#000",
              fill: "none",
              strokeWidth: "medium",
            },
            {
              id: "r2",
              type: "rect",
              x: 200,
              y: 0,
              width: 50,
              height: 50,
              stroke: "#000",
              fill: "none",
              strokeWidth: "medium",
            },
          ],
        },
      ];
      const profiles = extractProfilesFromPage(pg);
      return profiles.map((p) => p.sourceId).sort();
    });
    expect(result).toEqual(["r1", "r2"]);
  });

  test("extractProfilesFromPage は入れ子 group も展開する", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const pg = getCurrentPage();
      pg.layers[0].shapes = [
        {
          id: "g-outer",
          type: "group",
          children: [
            {
              id: "g-inner",
              type: "group",
              children: [
                {
                  id: "c1",
                  type: "circle",
                  cx: 100,
                  cy: 100,
                  r: 50,
                  stroke: "#000",
                  fill: "none",
                  strokeWidth: "medium",
                },
              ],
            },
          ],
        },
      ];
      return extractProfilesFromPage(pg).map((p) => p.sourceId);
    });
    expect(result).toEqual(["c1"]);
  });

  // ── Profile は State に保存されない ──────────────────────────

  test("Profile は getState() に含まれない", async ({ page }) => {
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
      const stateStr = JSON.stringify(getState());
      return stateStr.includes("profile-r1");
    });
    expect(result).toBe(false);
  });
});
