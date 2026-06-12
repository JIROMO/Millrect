"use strict";

/**
 * Part parametric Solver — param_bind 拘束の解決（Tier 2）
 * 幾何 Solver (constraints.js) とは別レイヤー。解決後に applyConstraints を呼ぶ。
 */

function _deps() {
  if (typeof require !== "undefined") {
    try {
      return require("./agent-intent");
    } catch {
      /* browser script tag */
    }
  }
  return {
    REAL_PER_MM: typeof window !== "undefined" ? window.REAL_PER_MM : 10,
    boxViewSizesMm:
      typeof window !== "undefined" ? window.boxViewSizesMm : null,
    normalizeViewType:
      typeof window !== "undefined" ? window.normalizeViewType : (t) => t,
  };
}

function _partMmToReal(mm) {
  const { REAL_PER_MM } = _deps();
  return mm * (REAL_PER_MM ?? 10);
}

/** 矩形を中心固定でリサイズ */
function resizeRectCentered(rect, newWidth, newHeight) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  rect.width = newWidth;
  rect.height = newHeight;
  rect.x = cx - newWidth / 2;
  rect.y = cy - newHeight / 2;
}

/** box / enclosure 各ビューの param 対応 */
const BOX_VIEW_PARAM_MAP = {
  top: { widthParam: "W", heightParam: "D" },
  bottom: { widthParam: "W", heightParam: "D" },
  front: { widthParam: "W", heightParam: "H" },
  back: { widthParam: "W", heightParam: "H" },
  right: { widthParam: "D", heightParam: "H" },
  left: { widthParam: "D", heightParam: "H" },
};

const PANEL_VIEW_PARAM_MAP = {
  top: { widthParam: "W", heightParam: "H" },
};

const L_BRACKET_VIEW_PARAM_MAP = {
  top: { widthParam: "A", heightParam: "B", profile: "l_path" },
  front: { widthParam: "A", heightParam: "H" },
};

function _viewParamMap(partKind) {
  if (partKind === "panel") return PANEL_VIEW_PARAM_MAP;
  if (partKind === "l_bracket") return L_BRACKET_VIEW_PARAM_MAP;
  return BOX_VIEW_PARAM_MAP;
}

function _partGeometry() {
  if (typeof require !== "undefined") {
    try {
      return require("./part-geometry");
    } catch {
      /* browser */
    }
  }
  return {
    lBracketTopOuterRing:
      typeof window !== "undefined" ? window.lBracketTopOuterRing : null,
    centerRingsOnPaper:
      typeof window !== "undefined" ? window.centerRingsOnPaper : null,
  };
}

/**
 * param_bind 拘束の mm 値を params から同期
 */
function syncParamBindConstraints(paramConstraints, params) {
  return (paramConstraints || []).map((c) => {
    if (c.kind !== "param_bind") return c;
    const val = params[c.param];
    return {
      ...c,
      value: val,
      binds: (c.binds || []).map((b) => ({ ...b, mm: val })),
    };
  });
}

/**
 * state.pages から profile shape の bindings を構築
 */
function buildProfileBindings(pages, partKind = "box") {
  const normalizeViewType = _deps().normalizeViewType || ((t) => t);
  const map = _viewParamMap(partKind);
  const bindings = {};
  for (const page of pages || []) {
    const view = normalizeViewType(page.viewDefinition?.type);
    if (!view || !map[view]) continue;
    const shape = page.layers?.[0]?.shapes?.[0];
    if (!shape) continue;
    bindings[view] = {
      view,
      shapeId: shape.id,
      pageId: page.id,
      ...map[view],
    };
  }
  return bindings;
}

/**
 * params から各ビューの target real サイズ
 */
function targetSizesReal(partKind, params) {
  if (partKind === "panel") {
    return {
      top: {
        width: _partMmToReal(params.W),
        height: _partMmToReal(params.H),
      },
    };
  }
  const boxViewSizesMm = _deps().boxViewSizesMm;
  const mm = boxViewSizesMm({
    width: params.W,
    depth: params.D,
    height: params.H,
  });
  const out = {};
  for (const [view, s] of Object.entries(mm)) {
    out[view] = { width: _partMmToReal(s.w), height: _partMmToReal(s.h) };
  }
  return out;
}

function _rebuildLBracketProfiles(state, partIntent, helpers) {
  const pg = _partGeometry();
  const { lBracketTopOuterRing, centerRingsOnPaper } = pg;
  if (!lBracketTopOuterRing || !centerRingsOnPaper) {
    return { ok: false, error: "L-bracket geometry helpers unavailable" };
  }

  const params = partIntent.dsl.params;
  const updated = [];

  for (const [view, binding] of Object.entries(partIntent.bindings)) {
    const page = state.pages.find((p) => p.id === binding.pageId);
    if (!page) continue;
    const found = _psFindShapeOnPage(binding.shapeId, page);
    if (!found) continue;
    const { shape, layer } = found;
    const idx = layer.shapes.indexOf(shape);

    if (view === "top" && shape.type === "path") {
      const paperMm =
        typeof getPaperDimensions === "function"
          ? getPaperDimensions(page)
          : { width: 297, height: 210 };
      const outer = lBracketTopOuterRing(params.A, params.B, params.T);
      const [topRing] = centerRingsOnPaper([outer], paperMm, page.scale);
      layer.shapes[idx] = {
        ...shape,
        type: "path",
        contours: [[topRing]],
      };
      updated.push({ view, shapeId: shape.id, type: "l_path" });
    } else if (view === "front" && shape.type === "rect") {
      resizeRectCentered(
        shape,
        _partMmToReal(params.A),
        _partMmToReal(params.H),
      );
      updated.push({ view, shapeId: shape.id, type: "rect" });
    }
  }

  partIntent.paramConstraints = syncParamBindConstraints(
    partIntent.paramConstraints,
    params,
  );
  return { ok: true, updated, params: { ...params } };
}

function _psFindShapeOnPage(id, page) {
  for (const layer of page.layers || []) {
    const s = layer.shapes.find((sh) => sh.id === id);
    if (s) return { shape: s, layer };
  }
  return null;
}

/**
 * path → rect へ戻す（穴 feature 再適用のため）
 */
function profileShapeToRect(shape, newWidth, newHeight, bbox) {
  const cx = bbox ? bbox.x + bbox.w / 2 : shape.x + shape.width / 2;
  const cy = bbox ? bbox.y + bbox.h / 2 : shape.y + shape.height / 2;
  return {
    id: shape.id,
    type: "rect",
    x: cx - newWidth / 2,
    y: cy - newHeight / 2,
    width: newWidth,
    height: newHeight,
    stroke: shape.stroke,
    fill: shape.fill,
    strokeWidth: shape.strokeWidth,
  };
}

/**
 * param_bind Solver — 既存 state 上の profile を params に合わせてリサイズ
 * @param {object} state — Millrect state（pages 含む）
 * @param {object} partIntent — bindings + dsl
 * @param {object} [helpers] — { getShapeBBox(scale) } browser 用
 */
function applyParamBindSolver(state, partIntent, helpers = {}) {
  if (!partIntent?.bindings || !partIntent?.dsl?.params) {
    return { ok: false, error: "Missing partIntent bindings or params" };
  }

  const partKind = partIntent.dsl?.part ?? "box";
  const params = partIntent.dsl.params;

  if (partKind === "l_bracket") {
    return _rebuildLBracketProfiles(state, partIntent, helpers);
  }

  const sizes = targetSizesReal(partKind, params);
  const updated = [];
  const getBBox = helpers.getShapeBBox;

  for (const [view, binding] of Object.entries(partIntent.bindings)) {
    const page = state.pages.find((p) => p.id === binding.pageId);
    if (!page) {
      return { ok: false, error: `Page not found for view ${view}` };
    }
    const found = _psFindShapeOnPage(binding.shapeId, page);
    if (!found) {
      return { ok: false, error: `Profile shape missing on view ${view}` };
    }

    const target = sizes[view];
    if (!target) continue;

    const { shape, layer } = found;
    const idx = layer.shapes.indexOf(shape);

    if (shape.type === "rect") {
      resizeRectCentered(shape, target.width, target.height);
      updated.push({ view, shapeId: shape.id, type: "rect" });
    } else if (shape.type === "path" && typeof getBBox === "function") {
      const bb = getBBox(shape, page.scale);
      layer.shapes[idx] = profileShapeToRect(
        shape,
        target.width,
        target.height,
        bb,
      );
      updated.push({ view, shapeId: shape.id, type: "path→rect" });
    } else {
      return {
        ok: false,
        error: `Unsupported profile type on ${view}: ${shape.type}`,
      };
    }
  }

  partIntent.paramConstraints = syncParamBindConstraints(
    partIntent.paramConstraints,
    params,
  );

  return { ok: true, updated, params: { ...params } };
}

/**
 * DSL 幾何拘束 → page.constraints[]（param_bind は除外）
 * shapeIds 直接指定、または view + shapeRole:"profile"
 */
function installDslConstraints(state, constraints, bindings, genId) {
  const installed = [];
  const idGen = genId || (() => `cst-${Date.now()}`);

  for (const c of constraints || []) {
    if (c.kind === "param_bind") continue;
    const type = c.type;
    if (!type) continue;

    let shapeIds = c.shapeIds ? [...c.shapeIds] : [];
    if (!shapeIds.length && c.view && bindings?.[c.view]) {
      shapeIds = [bindings[c.view].shapeId];
    }
    if (!shapeIds.length) continue;

    let page = null;
    for (const p of state.pages) {
      if (shapeIds.every((id) => _psFindShapeOnPage(id, p))) {
        page = p;
        break;
      }
    }
    if (!page) continue;

    if (!page.constraints) page.constraints = [];
    const entry = {
      id: c.id || idGen("cst"),
      type,
      shapeIds,
      params: c.params,
    };
    page.constraints.push(entry);
    installed.push({ pageId: page.id, constraint: entry });
  }

  return installed;
}

/** partIntent レコードを組み立て */
function buildPartIntentRecord(dsl, compiled, state, buildOptions) {
  return {
    version: 1,
    dsl: compiled.dsl,
    features: compiled.features || [],
    buildOptions: {
      paper: buildOptions.paper,
      orientation: buildOptions.orientation,
      scale: buildOptions.scale,
      views: buildOptions.views,
      includeSideView: buildOptions.includeSideView,
    },
    bindings: buildProfileBindings(state.pages, compiled.dsl.part),
    paramConstraints: syncParamBindConstraints(
      (compiled.constraints || []).filter((c) => c.kind === "param_bind"),
      compiled.dsl.params,
    ),
    geometricConstraints: (compiled.constraints || []).filter(
      (c) => c.kind !== "param_bind",
    ),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    partMmToReal: _partMmToReal,
    resizeRectCentered,
    BOX_VIEW_PARAM_MAP,
    PANEL_VIEW_PARAM_MAP,
    syncParamBindConstraints,
    buildProfileBindings,
    targetSizesReal,
    applyParamBindSolver,
    installDslConstraints,
    buildPartIntentRecord,
    profileShapeToRect,
  };
}

if (typeof window !== "undefined") {
  window.resizeRectCentered = resizeRectCentered;
  window.buildProfileBindings = buildProfileBindings;
  window.syncParamBindConstraints = syncParamBindConstraints;
  window.applyParamBindSolver = applyParamBindSolver;
  window.installDslConstraints = installDslConstraints;
  window.buildPartIntentRecord = buildPartIntentRecord;
}
