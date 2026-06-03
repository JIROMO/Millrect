/**
 * pages-layers.spec.js — ページ・レイヤー管理テスト
 *
 * 検証する設計原則:
 *   - ページ追加・削除・切り替え
 *   - viewDefinition がページに紐付く
 *   - レイヤー追加・削除・表示/非表示・ロック
 *   - 各ページの shapes が独立している
 */

const { appUrl } = require("./app-url");
const { test, expect } = require("@playwright/test");

async function openNewProject(page, name = "Pages Test") {
  await page.goto(appUrl);
  await page.getByRole("button", { name: /新規プロジェクト/ }).click();
  await page.locator("#startup-project-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.locator("#main-svg")).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
}

test.describe("ページ管理", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("初期状態でページが1枚ある", async ({ page }) => {
    const count = await page.evaluate(() => getState().pages.length);
    expect(count).toBe(1);
  });

  test("addPage でページが追加される", async ({ page }) => {
    const count = await page.evaluate(() => {
      addPage();
      return getState().pages.length;
    });
    expect(count).toBe(2);
  });

  test("addPage → Undo でページが戻る", async ({ page }) => {
    const count = await page.evaluate(() => {
      addPage();
      undo();
      return getState().pages.length;
    });
    expect(count).toBe(1);
  });

  test("deletePage でページが削除される", async ({ page }) => {
    const count = await page.evaluate(() => {
      addPage();
      const id = getState().pages[1].id;
      deletePage(id);
      return getState().pages.length;
    });
    expect(count).toBe(1);
  });

  test("最後の1ページは削除できない", async ({ page }) => {
    const count = await page.evaluate(() => {
      const id = getState().pages[0].id;
      deletePage(id);
      return getState().pages.length;
    });
    expect(count).toBe(1);
  });

  test("switchPage でカレントページが切り替わる", async ({ page }) => {
    const result = await page.evaluate(() => {
      addPage();
      const newId = getState().pages[1].id;
      switchPage(newId);
      return getCurrentPage().id;
    });
    const pages = await page.evaluate(() => getState().pages.map((p) => p.id));
    expect(result).toBe(pages[1]);
  });

  test("表示ページドロップダウンで実際のページが切り替わる", async ({
    page,
  }) => {
    const ids = await page.evaluate(() => {
      const state = getState();
      const topPage = state.pages[0];
      topPage.name = "上面図";
      topPage.viewDefinition = {
        type: "top",
        normal: [0, 0, 1],
        up: [0, 1, 0],
      };
      addPage();
      const frontPage = getCurrentPage();
      frontPage.name = "正面図";
      frontPage.viewDefinition = {
        type: "front",
        normal: [0, -1, 0],
        up: [0, 0, 1],
      };
      switchPage(topPage.id);
      render();
      updateAll();
      return { topId: topPage.id, frontId: frontPage.id };
    });

    await page
      .locator('.panel-split-bottom .panel-tab[data-tab="pages"]')
      .click();
    await expect(
      page.locator("#page-current .custom-select-label"),
    ).toContainText("上面図");
    await page.locator("#page-current").click();
    await page
      .locator(
        `#page-current .custom-select-option[data-value="${ids.frontId}"]`,
      )
      .click();

    await expect
      .poll(() => page.evaluate(() => getCurrentPage().id))
      .toBe(ids.frontId);
    await expect(
      page.locator("#page-current .custom-select-label"),
    ).toContainText("正面図");
  });

  test("ページ追加ドロップダウンで面の向きを選んでページ追加できる", async ({
    page,
  }) => {
    await page
      .locator('.panel-split-bottom .panel-tab[data-tab="pages"]')
      .click();
    await expect(page.locator("#pages-list .add-btn")).toHaveCount(0);
    await expect(
      page.locator("label", { hasText: "ページ追加" }),
    ).toBeVisible();
    await page.locator("#page-add-view").click();
    await page
      .locator('#page-add-view .custom-select-option[data-value="right"]')
      .click();

    const result = await page.evaluate(() => ({
      count: getState().pages.length,
      currentName: getCurrentPage().name,
      currentView: getCurrentPage().viewDefinition.type,
      pageNames: getState().pages.map((p) => p.name),
    }));
    expect(result.count).toBe(2);
    expect(result.currentName).toBe("右側面図");
    expect(result.currentView).toBe("right");
    expect(result.pageNames).toContain("右側面図");
    await expect(
      page.locator("#page-current .custom-select-label"),
    ).toContainText("右側面図");
    await expect(
      page.locator("#page-add-view .custom-select-label"),
    ).toContainText("面の向きを選択");
  });

  test("すでに存在する面のページは追加できない", async ({ page }) => {
    await page
      .locator('.panel-split-bottom .panel-tab[data-tab="pages"]')
      .click();

    await page.locator("#page-add-view").click();
    const topOption = page.locator(
      '#page-add-view .custom-select-option[data-value="top"]',
    );
    await expect(topOption).toHaveAttribute("aria-disabled", "true");
    await topOption.click();
    await expect
      .poll(() => page.evaluate(() => getState().pages.length))
      .toBe(1);

    await page
      .locator('#page-add-view .custom-select-option[data-value="front"]')
      .click();
    await expect
      .poll(() => page.evaluate(() => getState().pages.length))
      .toBe(2);

    await page.locator("#page-add-view").click();
    await expect(
      page.locator('#page-add-view .custom-select-option[data-value="front"]'),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("各ページの shapes は独立している", async ({ page }) => {
    const result = await page.evaluate(() => {
      // page-1 に rect を追加
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
      // page-2 に切り替え
      addPage();
      switchPage(getState().pages[1].id);
      // page-2 には shapes がない
      const p2shapes = getAllShapesOnPage(getCurrentPage());
      // page-1 に戻る
      switchPage(getState().pages[0].id);
      const p1shapes = getAllShapesOnPage(getCurrentPage());
      return { p1count: p1shapes.length, p2count: p2shapes.length };
    });
    expect(result.p1count).toBe(1);
    expect(result.p2count).toBe(0);
  });

  // ── viewDefinition ────────────────────────────────────────────

  test("新規ページに viewDefinition が設定される", async ({ page }) => {
    const vd = await page.evaluate(() => {
      addPage();
      return getState().pages[1].viewDefinition;
    });
    expect(vd).toBeTruthy();
    expect(vd.type).toBeDefined();
  });

  test("既存ページの viewDefinition.type を変更できる", async ({ page }) => {
    const type = await page.evaluate(() => {
      const pg = getCurrentPage();
      pg.viewDefinition = { type: "front", normal: [0, -1, 0], up: [0, 0, 1] };
      pushHistory();
      return getCurrentPage().viewDefinition.type;
    });
    expect(type).toBe("front");
  });

  test("ページ追加UIは3D再生成エラーで止まらない", async ({ page }) => {
    await page.evaluate(() => {
      const state = getState();
      const current = getCurrentPage();
      current.layers[0].shapes = [
        {
          id: "valid-top-profile",
          type: "rect",
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          stroke: "#000",
          fill: "none",
          strokeWidth: "medium",
        },
      ];
      state.pages.push({
        id: "page-bad-front",
        name: "Bad front",
        paper: "A4",
        orientation: "landscape",
        scale: { numerator: 1, denominator: 1 },
        viewDefinition: { type: "front", normal: [0, -1, 0], up: [0, 0, 1] },
        dimensions: [],
        constraints: [],
        layers: [
          {
            id: "layer-bad-front",
            name: "bad",
            visible: true,
            locked: false,
            // Malformed path shape: should not prevent the page view UI from updating.
            shapes: [
              {
                id: "bad-profile",
                type: "path",
                contours: [
                  [
                    [0, 0],
                    [100, 0],
                    [100, 100],
                  ],
                ],
                stroke: "#000",
                fill: "none",
                strokeWidth: "medium",
              },
            ],
          },
        ],
      });
      const canvas = document.getElementById("canvas-3d");
      if (!window._3scene && canvas) init3DView(canvas);
      render();
      updateAll();
    });

    await page
      .locator('.panel-split-bottom .panel-tab[data-tab="pages"]')
      .click();
    await page.locator("#page-add-view").click();
    await page
      .locator('#page-add-view .custom-select-option[data-value="right"]')
      .click();

    await expect
      .poll(() => page.evaluate(() => getCurrentPage().viewDefinition.type))
      .toBe("right");
    await expect(
      page.locator("#page-current .custom-select-label"),
    ).toContainText("右側面図");
  });

  test("viewDefinition は Undo で巻き戻らない（DOC_KEYS 内の pages の一部として巻き戻る）", async ({
    page,
  }) => {
    // viewDefinition は pages に含まれるため Undo対象
    const result = await page.evaluate(() => {
      const pg = getCurrentPage();
      pg.viewDefinition = { type: "front", normal: [0, -1, 0], up: [0, 0, 1] };
      pushHistory();
      // 次の操作をして Undo
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
      undo();
      return getCurrentPage().viewDefinition.type;
    });
    // Undo後は viewDefinition も元に戻る（pages の中にあるため）
    expect(result).toBe("front");
  });
});

test.describe("レイヤー管理", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      throw err;
    });
    await openNewProject(page);
  });

  test("初期状態でレイヤーが存在する", async ({ page }) => {
    const count = await page.evaluate(() => getCurrentPage().layers.length);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("addLayer でレイヤーが追加される", async ({ page }) => {
    const count = await page.evaluate(() => {
      addLayer();
      return getCurrentPage().layers.length;
    });
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("addLayer → Undo でレイヤーが戻る", async ({ page }) => {
    const result = await page.evaluate(() => {
      const before = getCurrentPage().layers.length;
      addLayer();
      undo();
      return { before, after: getCurrentPage().layers.length };
    });
    expect(result.after).toBe(result.before);
  });

  test("レイヤーの visible=false で shapes が非表示になる", async ({
    page,
  }) => {
    // SVG から確認するのではなく getAllShapesOnPage が返すかを確認（visible は filter 的に機能）
    // extractProfilesFromPage では除外される
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
      const pg = getCurrentPage();
      pg.layers[0].visible = false;
      // getAllShapesOnPage は visible に関係なく全 shapes を返す
      const allShapes = getAllShapesOnPage(pg);
      // extractProfilesFromPage は visible=false を除外
      const profiles = extractProfilesFromPage(pg);
      return { shapeCount: allShapes.length, profileCount: profiles.length };
    });
    expect(result.shapeCount).toBe(1); // getAllShapesOnPage は全て返す
    expect(result.profileCount).toBe(0); // Profile抽出は除外
  });

  test("レイヤーの locked=true で addShape が拒否される", async ({ page }) => {
    const result = await page.evaluate(() => {
      const pg = getCurrentPage();
      pg.layers[0].locked = true;
      const ok = addShape({
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
      return { ok, count: getAllShapesOnPage(getCurrentPage()).length };
    });
    expect(result.ok).toBe(false);
    expect(result.count).toBe(0);
  });

  test("レイヤーの locked=true で updateShape が拒否される", async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      addShape({
        id: "locked-update",
        type: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        stroke: "#000",
        fill: "#111111",
        strokeWidth: "medium",
      });
      const pg = getCurrentPage();
      pg.layers[0].locked = true;
      const ok = updateShape("locked-update", { fill: "#ff0000" });
      return {
        ok,
        fill: findShapeById("locked-update").shape.fill,
      };
    });
    expect(result.ok).toBe(false);
    expect(result.fill).toBe("#111111");
  });
});
