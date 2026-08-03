/**
 * ドキュメント用: 120×80×50 mm 穴付きパネルの多ビューシナリオ
 * capture スクリプトと E2E テストで共用
 */
"use strict";

const {
  MULTIVIEW_STARTER_MM: DOC_BOX_MM,
  MULTIVIEW_STARTER_UNIT: UNIT,
  MULTIVIEW_STARTER_BOX,
} = require("../packages/multiview-starter-box.js");
const {
  DOC_DOCS_SCALE,
  DOC_DOCS_MM,
  DOC_DOCS_BOX,
  docBoxTopLayout,
  docBoxTopFeatureLayout,
  docBoxTopPathShape,
} = require("../packages/docs-box-scenario.js");

/** @deprecated use MULTIVIEW_STARTER_BOX */
const DOC_BOX = {
  ...MULTIVIEW_STARTER_BOX,
  topShapeId: "doc-top-rect",
  frontShapeId: "doc-front-rect",
  sideShapeId: "doc-side-rect",
  projectName: "Docs Scenario",
};

/** Playwright page.evaluate(box => ...) 用 — 2 ビュー（上面 + 正面） */
function applyMultiviewBoxScenario(box) {
  const state = buildMultiviewStarterState(box.projectName || "Docs Scenario", {
    paper: "A4",
    orientation: "landscape",
    scale: { numerator: 1, denominator: 10 },
  });
  state.pages[0].layers[0].shapes[0].id = box.topShapeId;
  state.pages[1].layers[0].shapes[0].id = box.frontShapeId;

  replaceState(state);
  render();
  uiUpdate();
  if (typeof fitMultiviewStarterView === "function") fitMultiviewStarterView();
  else if (typeof fitPage === "function") fitPage();
  render();
  uiUpdate();

  return {
    topPageId: state.pages[0].id,
    frontPageId: state.pages[1].id,
  };
}

/** ドキュメント用 3 ビュー（上面 + 正面 + 右側面）— 120×80×50 mm 穴付きパネル */
function applyMultiviewDocsBoxScenario(box = DOC_DOCS_BOX) {
  const state = buildMultiviewStarterState(
    box.projectName || DOC_DOCS_BOX.projectName,
    {
      paper: "A4",
      orientation: "landscape",
      scale: DOC_DOCS_SCALE,
      includeSideView: true,
    },
  );
  state.pages[0].layers[0].shapes[0] = docBoxTopPathShape(
    box.topShapeId,
    box.top,
  );
  {
    const { w, d, ox, oy, holes } = docBoxTopFeatureLayout(
      DOC_DOCS_MM,
      DOC_DOCS_SCALE,
    );
    state.pages[0].dimensions = [
      {
        id: "doc-top-dim-w",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: ox, y: oy },
        to: { x: ox + w, y: oy },
        offset: -120,
        textSize: 3,
        suffix: " mm",
      },
      {
        id: "doc-top-dim-d",
        type: "dimension",
        dimensionType: "vertical",
        from: { x: ox + w, y: oy },
        to: { x: ox + w, y: oy + d },
        offset: 120,
        textSize: 3,
        suffix: " mm",
      },
      {
        id: "doc-top-dim-hole-x",
        type: "dimension",
        dimensionType: "horizontal",
        from: { x: holes[0].cx, y: holes[0].cy },
        to: { x: holes[1].cx, y: holes[1].cy },
        offset: -56,
        textSize: 2.6,
        suffix: " mm pitch",
      },
    ];
  }
  state.pages[1].layers[0].shapes[0].id = box.frontShapeId;
  state.pages[1].layers[0].shapes[0].fill = box.front.fill;
  state.pages[1].layers[0].shapes[0].stroke = box.front.stroke;
  if (state.pages[2]) {
    state.pages[2].layers[0].shapes[0].id = box.sideShapeId;
    state.pages[2].layers[0].shapes[0].fill = box.side.fill;
    state.pages[2].layers[0].shapes[0].stroke = box.side.stroke;
  }

  replaceState(state);
  render();
  uiUpdate();

  return {
    topPageId: state.pages[0].id,
    frontPageId: state.pages[1].id,
    sidePageId: state.pages[2]?.id ?? null,
  };
}

/** 指定 shape がキャンバス中央付近に入るよう pan/zoom 調整 */
function focusShapeInView(shapeId) {
  const page = getCurrentPage();
  const found = findShapeById(shapeId);
  if (!found?.shape) return false;

  const bb = getShapeBBox(found.shape, page.scale);
  const state = getState();
  const toolbarH = 44;
  const statusH = 24;
  const sidebar = document.getElementById("sidebar-right");
  const leftOff = 72;
  const rightOff = (sidebar?.offsetWidth || 260) + 16;
  const margin = 48;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const availW = cw - leftOff - rightOff - margin * 2;
  const availH = ch - toolbarH - statusH - margin * 2;
  const zoom = Math.min(availW / bb.w, availH / bb.h) * 0.94;
  state.zoom = Math.max(0.2, Math.min(zoom, 15));
  state.panX =
    leftOff + margin + (availW - bb.w * state.zoom) / 2 - bb.x * state.zoom;
  state.panY =
    toolbarH + margin + (availH - bb.h * state.zoom) / 2 - bb.y * state.zoom;
  render();
  uiUpdate();
  return true;
}

/** ページ内の図形・寸法線全体が見えるよう pan/zoom 調整 */
function focusDrawingContent() {
  const page = getCurrentPage();
  const sc = page.scale || { numerator: 1, denominator: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of getAllShapesOnPage(page)) {
    const b = getShapeBBox(s, sc);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const d of page.dimensions || []) {
    minX = Math.min(minX, d.from.x, d.to.x);
    minY = Math.min(minY, d.from.y, d.to.y);
    maxX = Math.max(maxX, d.from.x, d.to.x);
    maxY = Math.max(maxY, d.from.y, d.to.y);
  }
  if (!Number.isFinite(minX)) {
    fitPage?.();
    render();
    uiUpdate();
    return false;
  }

  const bb = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  const state = getState();
  const toolbarH = 44;
  const statusH = 24;
  const sidebar = document.getElementById("sidebar-right");
  const leftOff = 72;
  const rightOff = (sidebar?.offsetWidth || 260) + 16;
  const margin = 56;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const availW = cw - leftOff - rightOff - margin * 2;
  const availH = ch - toolbarH - statusH - margin * 2;
  const zoom = Math.min(availW / bb.w, availH / bb.h) * 0.82;
  state.zoom = Math.max(0.2, Math.min(zoom, 15));
  state.panX =
    leftOff + margin + (availW - bb.w * state.zoom) / 2 - bb.x * state.zoom;
  state.panY =
    toolbarH + margin + (availH - bb.h * state.zoom) / 2 - bb.y * state.zoom;
  render();
  uiUpdate();
  return true;
}

/** 取付プレート作図デモ用 — 輪郭・寸法線のみにフィット（注記テキストは除外） */
function focusDrawingFeaturesView(opts) {
  opts = opts || {};
  const page = getCurrentPage();
  const sc = page.scale || { numerator: 1, denominator: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const contourLayer = page.layers[0];
  for (const s of contourLayer?.shapes || []) {
    const b = getShapeBBox(s, sc);
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const d of page.dimensions || []) {
    const b = getShapeBBox(d, sc);
    if (!b) continue;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  if (!Number.isFinite(minX)) return false;

  const pad = opts.pad ?? 56;
  const bb = {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
  const state = getState();
  const toolbarH = 44;
  const statusH = 24;
  const sidebar = document.getElementById("sidebar-right");
  const toolsFloat = document.getElementById("tools-float");
  const leftOff =
    toolsFloat && !toolsFloat.classList.contains("panel-hidden")
      ? Math.max(72, toolsFloat.offsetWidth + 32)
      : 72;
  const rightOff = (sidebar?.offsetWidth || 260) + 16;
  const margin = opts.margin ?? 32;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const availW = cw - leftOff - rightOff - margin * 2;
  const availH = ch - toolbarH - statusH - margin * 2;
  const zoomFactor = opts.zoomFactor ?? 0.94;
  const zoom = Math.min(availW / bb.w, availH / bb.h) * zoomFactor;
  state.zoom = Math.max(0.2, Math.min(zoom, 15));
  state.panX =
    leftOff + margin + (availW - bb.w * state.zoom) / 2 - bb.x * state.zoom;
  state.panY =
    toolbarH + margin + (availH - bb.h * state.zoom) / 2 - bb.y * state.zoom;
  render();
  uiUpdate();
  return true;
}

/** キャプチャ用 — 右下 ⊡（全体表示 / fitPage）と同じズーム */
function fitPageView() {
  if (typeof fitPage === "function") fitPage();
  render();
  uiUpdate();
  return true;
}

/** 外形だけの上面矩形（drawing-rect 用） */
function applyDrawingRectScenario() {
  function docLocalized(ja, en) {
    try {
      if (typeof getLocale === "function" && getLocale() === "en") return en;
    } catch (_e) {
      /* browser only */
    }
    return ja;
  }

  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy } = docBoxTopLayout(mm, scale);

  const page = getCurrentPage();
  page.scale = { ...scale };
  page.name = docLocalized("上面図", "Top view");
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].name = docLocalized("輪郭", "Contour");
  page.layers[0].shapes = [
    {
      id: "doc-rect",
      type: "rect",
      x: ox,
      y: oy,
      width: w,
      height: d,
      stroke: DOC_DOCS_BOX.top.stroke,
      fill: DOC_DOCS_BOX.top.fill,
      strokeWidth: "medium",
    },
  ];
  page.dimensions = [];
  while (page.layers.length > 1) page.layers.pop();

  const state = getState();
  state.projectName = docLocalized("直方体", "Box");
  state.selectedShapeIds = ["doc-rect"];
  replaceState(state);
  render();
  uiUpdate();
}

/** 作図デモ — 穴付きパネル上面 + 寸法線 + 注記 */
function applyDrawingFeaturesScenario() {
  function docLocalized(ja, en) {
    try {
      if (typeof getLocale === "function" && getLocale() === "en") return en;
    } catch (_e) {
      /* browser only */
    }
    return ja;
  }

  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy, holes } = docBoxTopFeatureLayout(mm, scale);
  const holeLeft = holes[0];
  const holeRight = holes[1];
  const holeBottom = holes[3];

  const page = getCurrentPage();
  page.scale = { ...scale };
  page.name = docLocalized("上面図", "Top view");
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].name = docLocalized("輪郭", "Contour");

  page.layers[0].shapes = [docBoxTopPathShape("feat-top", DOC_DOCS_BOX.top)];
  page.dimensions = [
    {
      id: "feat-dim-w",
      type: "dimension",
      dimensionType: "horizontal",
      from: { x: ox, y: oy },
      to: { x: ox + w, y: oy },
      offset: -120,
      textSize: 3,
      suffix: " mm",
    },
    {
      id: "feat-dim-d",
      type: "dimension",
      dimensionType: "vertical",
      from: { x: ox + w, y: oy },
      to: { x: ox + w, y: oy + d },
      offset: 120,
      textSize: 3,
      suffix: " mm",
    },
    {
      id: "feat-dim-hole-x",
      type: "dimension",
      dimensionType: "horizontal",
      from: { x: holeLeft.cx, y: holeLeft.cy },
      to: { x: holeRight.cx, y: holeRight.cy },
      offset: -56,
      textSize: 2.6,
      suffix: docLocalized(" mm ピッチ", " mm pitch"),
    },
    {
      id: "feat-dim-hole-y",
      type: "dimension",
      dimensionType: "vertical",
      from: { x: holeLeft.cx, y: holeLeft.cy },
      to: { x: holeBottom.cx, y: holeBottom.cy },
      offset: -64,
      textSize: 2.6,
      suffix: docLocalized(" mm ピッチ", " mm pitch"),
    },
  ];

  page.layers.length = 1;
  page.layers.push({
    id: genId("layer"),
    name: docLocalized("補助線", "Construction"),
    visible: true,
    locked: false,
    shapes: [
      {
        id: "feat-center-h",
        type: "line",
        x1: ox,
        y1: oy + d / 2,
        x2: ox + w,
        y2: oy + d / 2,
        stroke: "#94a3b8",
        strokeWidth: "thin",
      },
      {
        id: "feat-center-v",
        type: "line",
        x1: ox + w / 2,
        y1: oy,
        x2: ox + w / 2,
        y2: oy + d,
        stroke: "#94a3b8",
        strokeWidth: "thin",
      },
    ],
  });
  page.layers.push({
    id: genId("layer"),
    name: docLocalized("注記", "Notes"),
    visible: true,
    locked: false,
    shapes: [
      {
        id: "feat-note",
        type: "text",
        x: ox + w / 2,
        y: oy + d + 36,
        text: docLocalized("4×Ø8 貫通穴", "4×Ø8 through holes"),
        fontSize: 3.2,
        fontFamily: "Gen Interface JP",
        textAlign: "center",
        stroke: "#1a1a2e",
        strokeWidth: "medium",
        fontWeight: "bold",
      },
    ],
  });

  const state = getState();
  state.projectName = docLocalized("穴付きパネル", "Mounting plate");
  replaceState(state);
  render();
  uiUpdate();

  return {
    topId: "feat-top",
    dimWId: "feat-dim-w",
  };
}

/** 編集デモ — 上面矩形を選択（プロパティ領域） */
function applyEditingDemoScenario() {
  function docLocalized(ja, en) {
    try {
      if (typeof getLocale === "function" && getLocale() === "en") return en;
    } catch (_e) {
      /* browser only */
    }
    return ja;
  }

  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy } = docBoxTopLayout(mm, scale);

  const page = getCurrentPage();
  page.scale = { ...scale };
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].name = docLocalized("輪郭", "Contour");
  page.layers[0].shapes = [
    {
      id: "edit-top",
      type: "rect",
      x: ox,
      y: oy,
      width: w,
      height: d,
      stroke: DOC_DOCS_BOX.top.stroke,
      fill: DOC_DOCS_BOX.top.fill,
      strokeWidth: "medium",
    },
  ];
  page.dimensions = [];

  const state = getState();
  state.projectName = docLocalized("直方体（編集）", "Box (edit)");
  state.selectedShapeIds = ["edit-top"];
  replaceState(state);
  render();
  uiUpdate();
}

async function flushRender(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        render();
        uiUpdate();
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function waitForShapeInSvg(page, shapeId) {
  await page.waitForFunction(
    (id) => Boolean(document.querySelector(`#main-svg [data-id="${id}"]`)),
    shapeId,
    { timeout: 5000 },
  );
  await flushRender(page);
}

async function fitPageForCapture(page) {
  await page.evaluate(fitPageView);
  await flushRender(page);
}

async function switchToPage(page, pageId, shapeId) {
  await page.evaluate((id) => {
    switchPage(id);
    render();
    uiUpdate();
  }, pageId);
  if (shapeId) {
    await waitForShapeInSvg(page, shapeId);
    await page.evaluate(focusShapeInView, shapeId);
  } else {
    await fitPageForCapture(page);
  }
  await flushRender(page);
}

async function open3DPanel(page) {
  const visible = await page
    .locator("#panel-3d.visible")
    .isVisible()
    .catch(() => false);
  if (!visible) {
    await page.evaluate(() => {
      if (typeof window.setAppMode === "function") {
        window.setAppMode("3d");
      } else {
        document.getElementById("panel-3d")?.classList.add("visible");
      }
    });
    await page.locator("#panel-3d.visible").waitFor({ state: "visible" });
  }
  await page.waitForFunction(() => {
    const canvas = document.getElementById("canvas-3d");
    return canvas && canvas.clientWidth > 120 && canvas.clientHeight > 120;
  });
  await page.waitForTimeout(120);
}

async function waitFor3DMesh(page, timeout = 15000) {
  await open3DPanel(page);
  await page.waitForFunction(
    () => {
      if (!window._3scene) {
        const canvas = document.getElementById("canvas-3d");
        if (canvas) init3DView(canvas);
      } else {
        resize3DView?.();
      }
      update3DScene();
      return get3DSceneStatus().meshCount > 0;
    },
    undefined,
    { timeout },
  );
  await page.evaluate(() => {
    if (!_3meshes.length || !_3camera || !_3controls || !_3renderer) return;
    resize3DView?.();
    update3DScene();
    const box = new THREE.Box3();
    for (const mesh of _3meshes) {
      mesh.updateMatrixWorld(true);
      box.union(new THREE.Box3().setFromObject(mesh));
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const vFov = (_3camera.fov * Math.PI) / 180;
    const aspect = _3camera.aspect || 1;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distV = (size.y / 2 / Math.tan(vFov / 2)) * 1.35;
    const distH = (Math.max(size.x, size.z) / 2 / Math.tan(hFov / 2)) * 1.35;
    const dist = Math.max(distV, distH, maxDim);
    _3controls.maxDistance = Math.max(_3controls.maxDistance, dist * 3);
    _3camera.position.set(
      center.x + dist * 0.85,
      center.y + dist * 0.42,
      center.z + dist * 1.05,
    );
    _3controls.target.copy(center);
    _3controls.update();
    _3renderer.render(_3scene, _3camera);
  });
  await page.waitForTimeout(500);
}

module.exports = {
  DOC_BOX_MM,
  DOC_BOX,
  DOC_DOCS_MM,
  DOC_DOCS_BOX,
  DOC_DOCS_SCALE,
  applyMultiviewBoxScenario,
  applyMultiviewDocsBoxScenario,
  applyDrawingRectScenario,
  applyDrawingFeaturesScenario,
  applyEditingDemoScenario,
  focusShapeInView,
  focusDrawingContent,
  focusDrawingFeaturesView,
  fitPageView,
  flushRender,
  fitPageForCapture,
  waitForShapeInSvg,
  switchToPage,
  waitFor3DMesh,
  open3DPanel,
};
