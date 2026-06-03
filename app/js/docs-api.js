"use strict";

// ── ドキュメント用シナリオ + MCP キャプチャ準備 API ─────────────

function _docLocalized(ja, en) {
  try {
    if (typeof getLocale === "function" && getLocale() === "en") return en;
  } catch (_e) {
    /* browser only */
  }
  return ja;
}

function listDocsScenarios() {
  const catalog = DOCS_SCENARIO_CATALOG || {};
  return Object.entries(catalog).map(([id, meta]) => ({
    id,
    description: meta.description,
    tags: meta.tags || [],
  }));
}

function _applyDrawingRectScenario() {
  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy } = docBoxTopLayout(mm, scale);
  const page = getCurrentPage();
  page.scale = { ...scale };
  page.name = _docLocalized("上面図", "Top view");
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].name = _docLocalized("輪郭", "Contour");
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
  state.projectName = _docLocalized("直方体", "Box");
  state.selectedShapeIds = ["doc-rect"];
  replaceState(state);
  render();
  uiUpdate();
  return { shapeId: "doc-rect" };
}

function _applyDrawingFeaturesScenario() {
  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy } = docBoxTopLayout(mm, scale);
  const page = getCurrentPage();
  page.scale = { ...scale };
  page.name = _docLocalized("上面図", "Top view");
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].shapes = [
    {
      id: "feat-top",
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
  ];
  page.layers.length = 1;
  replaceState(getState());
  render();
  uiUpdate();
  return { shapeId: "feat-top" };
}

function _applyEditingDemoScenario() {
  _applyDrawingRectScenario();
  getState().selectedShapeIds = ["doc-rect"];
  render();
  uiUpdate();
  return { shapeId: "doc-rect" };
}

const _DOC_REF_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function _applySketchDigitizeDemoScenario() {
  const mm = DOC_DOCS_MM;
  const scale = DOC_DOCS_SCALE;
  const { w, d, ox, oy } = docBoxTopLayout(mm, scale);
  const page = getCurrentPage();
  page.scale = { ...scale };
  page.name = _docLocalized("スケッチ取り込み", "Sketch import");
  page.viewDefinition = { type: "top", normal: null, up: null };
  page.layers[0].name = _docLocalized("輪郭", "Contour");
  page.layers[0].shapes = [];
  page.dimensions = [];
  page.referenceImage = {
    dataUrl: _DOC_REF_IMAGE_DATA_URL,
    x: ox - 50,
    y: oy - 50,
    width: w + 100,
    height: d + 100,
    opacity: 0.45,
  };

  const normalized = normalizeDigitizeProposals(
    [
      {
        type: "rect",
        id: "doc-ghost-rect",
        x_mm: realToMM(ox),
        y_mm: realToMM(oy),
        width_mm: realToMM(w),
        height_mm: realToMM(d),
      },
    ],
    { genId: () => "doc-ghost-rect" },
  );
  if (normalized.shapes?.[0]) {
    page.layers[0].shapes.push(normalized.shapes[0]);
  }

  const state = getState();
  state.projectName = _docLocalized("スケッチ取り込み", "Sketch import");
  state.selectedShapeIds = ["doc-ghost-rect"];
  replaceState(state);
  render();
  uiUpdate();
  return { ghostShapeId: "doc-ghost-rect", hasReferenceImage: true };
}

function runDocsScenario(scenarioId, opts = {}) {
  if (opts.locale && typeof setLocale === "function") {
    setLocale(opts.locale);
  }

  let result = { ok: true, scenarioId };

  switch (scenarioId) {
    case "multiview_box_3view": {
      const r = createMultiviewBox({
        projectName: _docLocalized("直方体", "Box"),
        sizeMm: { ...DOC_DOCS_MM },
        views: ["top", "front", "right"],
        scale: { ...DOC_DOCS_SCALE },
        update3d: opts.update3d !== false,
      });
      result = { ...result, ...r, topShapeId: "starter-top-rect" };
      break;
    }
    case "drawing_rect":
      result.meta = _applyDrawingRectScenario();
      break;
    case "drawing_features":
      result.meta = _applyDrawingFeaturesScenario();
      break;
    case "editing_demo":
      result.meta = _applyEditingDemoScenario();
      break;
    case "intent_part_holes": {
      const r = createPart({
        kind: "box",
        projectName: _docLocalized("直方体（穴）", "Box (holes)"),
        sizeMm: { ...DOC_DOCS_MM },
        views: ["top", "front", "right"],
        scale: { ...DOC_DOCS_SCALE },
        features: [
          {
            type: "hole_grid",
            view: "top",
            diameter_mm: 4,
            inset_mm: 8,
            count: [2, 2],
          },
        ],
        update3d: opts.update3d !== false,
      });
      result = { ...result, ...r };
      break;
    }
    case "sketch_digitize_demo":
      result.meta = _applySketchDigitizeDemoScenario();
      break;
    default:
      return {
        ok: false,
        error: `Unknown scenario: ${scenarioId}`,
        available: listDocsScenarios().map((s) => s.id),
      };
  }

  return result;
}

function prepareDocsCaptureView(opts = {}) {
  const state = getState();

  if (opts.pageId) {
    switchPage(opts.pageId);
  } else if (opts.viewType) {
    const found = state.pages.find(
      (p) => p.viewDefinition?.type === opts.viewType,
    );
    if (found) switchPage(found.id);
  }

  if (
    opts.fit === "drawing_features" &&
    typeof focusDrawingFeaturesView === "function"
  ) {
    focusDrawingFeaturesView(
      opts.focusOpts || { zoomFactor: 0.94, margin: 32, pad: 40 },
    );
  } else if (opts.shapeId && typeof focusShapeInView === "function") {
    focusShapeInView(opts.shapeId);
  } else if (opts.fit === "page") {
    fitPage?.();
  } else {
    fitPage?.();
  }

  if (opts.open3d) {
    const panel = document.getElementById("panel-3d");
    if (panel && !panel.classList.contains("visible")) {
      panel.classList.add("visible");
    }
    const canvas = document.getElementById("canvas-3d");
    if (canvas && typeof init3DView === "function" && !window._3scene) {
      init3DView(canvas);
    }
    update3DScene?.();
  } else {
    const panel = document.getElementById("panel-3d");
    if (panel && panel.classList.contains("visible")) {
      panel.classList.remove("visible");
    }
  }

  render();
  uiUpdate();

  return {
    ok: true,
    currentPageId: getCurrentPage().id,
    currentPageName: getCurrentPage().name,
    viewType: getCurrentPage().viewDefinition?.type ?? null,
  };
}

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
  const leftOff = 72;
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

function getCaptureRectForTarget(target) {
  const selectors = {
    viewport: "#workspace",
    canvas: "#canvas-area",
    toolbar: "#toolbar",
    sidebar: "#sidebar-right",
    tools: "#tools-float",
    panel_3d: "#panel-3d",
    svg: "#main-svg",
  };
  const sel = selectors[target] || target;
  const el = document.querySelector(sel);
  if (!el) return { ok: false, error: `Element not found: ${sel}` };
  const r = el.getBoundingClientRect();
  return {
    ok: true,
    selector: sel,
    rect: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    },
  };
}
