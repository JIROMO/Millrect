"use strict";

// ── AI / MCP 向け Intent API（mm 第一級・高レベル作図）────────

function _collectPageSummaries() {
  const state = getState();
  return state.pages.map((p) => ({
    pageId: p.id,
    name: p.name,
    viewType: p.viewDefinition?.type ?? null,
    profileCount: extractProfilesFromPage(p).length,
  }));
}

/** 3D 生成準備状況を構造化して返す（描画前チェック用） */
function validate3DReadiness() {
  const summaries = _collectPageSummaries();
  const analysis = analyzeMultiviewReadiness(summaries);
  const sceneStatus =
    typeof get3DSceneStatus === "function" ? get3DSceneStatus() : null;
  return {
    ...analysis,
    pages: summaries,
    meshCount: sceneStatus?.meshCount ?? 0,
    sceneMessage: sceneStatus?.message ?? null,
  };
}

function _addDimensionsToPage(page, rectShape, opts = {}) {
  if (!page.dimensions) page.dimensions = [];
  for (const spec of buildRectDimensionSpecs(rectShape, opts)) {
    page.dimensions.push({ id: genId("dim"), ...spec });
  }
}

function _findPageByView(state, viewType) {
  const target = normalizeViewType(viewType);
  return state.pages.find(
    (p) =>
      normalizeViewType(p.viewDefinition?.type) === target ||
      p.viewDefinition?.type === viewType,
  );
}

function _getProfileShapeOnPage(page) {
  const layer = page.layers?.[0];
  if (!layer) return null;
  const shape = layer.shapes.find(
    (s) => s.type === "rect" || s.type === "path",
  );
  if (!shape) return null;
  return { shape, layer, idx: layer.shapes.indexOf(shape) };
}

function _rectProxyFromShape(shape, page) {
  if (shape.type === "rect") {
    return {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    };
  }
  if (shape.type === "path" && typeof getShapeBBox === "function") {
    const bb = getShapeBBox(shape, page.scale);
    return { x: bb.x, y: bb.y, width: bb.w, height: bb.h };
  }
  return null;
}

function _applyFilletFeature(state, feature) {
  const view = feature.view ?? "top";
  const page = _findPageByView(state, view);
  if (!page) return { ok: false, view, error: `View "${view}" not found` };
  const found = _getProfileShapeOnPage(page);
  if (!found || found.shape.type !== "rect") {
    return { ok: false, view, error: "Fillet requires rect profile" };
  }
  found.shape.rx = mmToAgentReal(feature.radius_mm ?? 3);
  found.shape.ry = found.shape.rx;
  return {
    ok: true,
    view,
    shapeId: found.shape.id,
    radius_mm: feature.radius_mm,
  };
}

function _applySlotFeature(state, feature) {
  const view = feature.view ?? "top";
  const page = _findPageByView(state, view);
  if (!page) return { ok: false, view, error: `View "${view}" not found` };
  const found = _getProfileShapeOnPage(page);
  if (!found) return { ok: false, view, error: "No profile shape" };

  const proxy = _rectProxyFromShape(found.shape, page);
  if (!proxy) return { ok: false, view, error: "Cannot resolve profile bbox" };

  const cx = proxy.x + mmToAgentReal(feature.x_mm);
  const cy = proxy.y + proxy.height - mmToAgentReal(feature.y_mm);
  const hole = rectHoleRing(
    cx,
    cy,
    mmToAgentReal(feature.width_mm),
    mmToAgentReal(feature.height_mm),
  );

  const baseRect =
    found.shape.type === "rect"
      ? found.shape
      : {
          id: found.shape.id,
          type: "rect",
          ...proxy,
          stroke: found.shape.stroke,
          fill: found.shape.fill,
          strokeWidth: found.shape.strokeWidth,
        };

  const pathShape = buildRectWithHolesPathShape(baseRect, [hole], {
    id: found.shape.id,
  });
  found.layer.shapes[found.idx] = pathShape;
  return { ok: true, view, shapeId: pathShape.id, slot: feature };
}

function _applyPatternLinearFeature(state, feature) {
  const view = feature.view ?? "top";
  const page = _findPageByView(state, view);
  if (!page) return { ok: false, view, error: `View "${view}" not found` };
  const found = _getProfileShapeOnPage(page);
  if (!found) return { ok: false, view, error: "No profile shape" };

  const proxy = _rectProxyFromShape(found.shape, page);
  if (!proxy) return { ok: false, view, error: "Cannot resolve profile bbox" };

  const centers = linearPatternCentersMm({
    count: feature.count,
    pitch_mm: feature.pitch_mm,
    start_mm: feature.start_mm,
    axis: feature.axis,
  });
  const r = mmToAgentReal((feature.diameter_mm ?? 3) / 2);
  const holeRings = centers.map(({ x, y }) =>
    circleRing(
      proxy.x + mmToAgentReal(x),
      proxy.y + proxy.height - mmToAgentReal(y),
      r,
    ),
  );

  const baseRect =
    found.shape.type === "rect"
      ? found.shape
      : {
          id: found.shape.id,
          type: "rect",
          ...proxy,
          stroke: found.shape.stroke,
          fill: found.shape.fill,
          strokeWidth: found.shape.strokeWidth,
        };

  const pathShape = buildRectWithHolesPathShape(baseRect, holeRings, {
    id: found.shape.id,
  });
  found.layer.shapes[found.idx] = pathShape;
  return {
    ok: true,
    view,
    shapeId: pathShape.id,
    holeCount: holeRings.length,
  };
}

function _applyHoleGridFeature(state, feature) {
  const view = feature.view ?? "top";
  const page = _findPageByView(state, view);
  if (!page) {
    return { ok: false, view, error: `View "${view}" not found` };
  }
  const found = _getProfileShapeOnPage(page);
  if (!found) {
    return { ok: false, view, error: "No profile shape" };
  }
  const proxy = _rectProxyFromShape(found.shape, page);
  if (!proxy) {
    return { ok: false, view, error: "Cannot resolve profile for holes" };
  }
  const rect =
    found.shape.type === "rect"
      ? found.shape
      : {
          id: found.shape.id,
          type: "rect",
          ...proxy,
          stroke: found.shape.stroke,
          fill: found.shape.fill,
          strokeWidth: found.shape.strokeWidth,
        };
  const holeRings = buildHoleGridHoleRings(rect, {
    diameterMm: feature.diameter_mm ?? feature.diameterMm ?? 3,
    insetMm: feature.inset_mm ?? feature.insetMm ?? 5,
    count: feature.count ?? [2, 2],
  });
  const pathShape = buildRectWithHolesPathShape(rect, holeRings, {
    id: found.shape.id,
  });
  found.layer.shapes[found.idx] = pathShape;
  return {
    ok: true,
    view,
    shapeId: pathShape.id,
    holeCount: holeRings.length,
  };
}

function _applyPartFeatures(state, features) {
  const applied = [];
  const ordered = [...(features || [])].sort((a, b) => {
    const order = { fillet: 0, slot: 1, pattern_linear: 2, hole_grid: 3 };
    return (order[a.type] ?? 9) - (order[b.type] ?? 9);
  });
  for (const feature of ordered) {
    switch (feature.type) {
      case "hole_grid":
        applied.push(_applyHoleGridFeature(state, feature));
        break;
      case "fillet":
        applied.push(_applyFilletFeature(state, feature));
        break;
      case "slot":
        applied.push(_applySlotFeature(state, feature));
        break;
      case "pattern_linear":
        applied.push(_applyPatternLinearFeature(state, feature));
        break;
      default:
        applied.push({
          ok: false,
          type: feature.type,
          error: `Unknown feature type: ${feature.type}`,
        });
    }
  }
  return applied;
}

function _buildMultiviewBoxState(options = {}) {
  const state = getState();
  const sizeMm = {
    width: options.sizeMm?.width ?? MULTIVIEW_STARTER_MM.width,
    depth: options.sizeMm?.depth ?? MULTIVIEW_STARTER_MM.depth,
    height: options.sizeMm?.height ?? MULTIVIEW_STARTER_MM.height,
  };
  const views = options.views ?? ["top", "front"];
  const includeSideView =
    views.includes("right") ||
    views.includes("left") ||
    options.includeSideView === true;

  const newState = buildMultiviewStarterState(
    (options.projectName ?? state.projectName ?? "Untitled").trim() ||
      "Untitled",
    {
      paper: options.paper ?? "A4",
      orientation: options.orientation ?? "landscape",
      scale: options.scale ?? { numerator: 1, denominator: 10 },
      includeSideView,
      sizeMm,
      styles: options.styles ?? MULTIVIEW_STARTER_BOX,
    },
  );

  if (options.addDimensions) {
    for (const page of newState.pages) {
      const shape = page.layers[0]?.shapes[0];
      if (shape?.type === "rect") {
        _addDimensionsToPage(page, shape, options.dimensionOpts);
      }
    }
  }

  return { newState, sizeMm, includeSideView };
}

function _commitAgentState(newState, options = {}) {
  replaceState(newState);
  if (typeof onStateChanged === "function") onStateChanged();
  render();
  uiUpdate();

  if (options.update3d !== false && typeof update3DScene === "function") {
    const canvas = document.getElementById("canvas-3d");
    if (canvas && typeof init3DView === "function" && !window._3scene) {
      init3DView(canvas);
    }
    update3DScene();
  }
}

/**
 * 多ビュー直方体を mm 指定で一括生成
 * @param {object} options
 * @param {string} [options.projectName]
 * @param {{width,depth,height}} [options.sizeMm]
 * @param {string} [options.paper]
 * @param {string} [options.orientation]
 * @param {{numerator,denominator}} [options.scale]
 * @param {string[]} [options.views] — 例: ['top','front','right']
 * @param {boolean} [options.addDimensions]
 * @param {boolean} [options.update3d]
 */
function createMultiviewBox(options = {}) {
  if (typeof checkBriefBeforeMake === "function") {
    const gate = checkBriefBeforeMake();
    if (!gate.allowed) {
      return { ok: false, error: gate.warning, code: gate.code };
    }
  }
  const { newState, sizeMm, includeSideView } =
    _buildMultiviewBoxState(options);
  _commitAgentState(newState, options);

  const readiness = validate3DReadiness();
  return {
    ok: true,
    sizeMm,
    views: includeSideView ? ["top", "front", "right"] : ["top", "front"],
    pageIds: newState.pages.map((p) => p.id),
    readiness,
    sceneStatus:
      typeof get3DSceneStatus === "function" ? get3DSceneStatus() : null,
  };
}

/**
 * セマンティック Part 生成（box + features）— Part DSL 経由
 * @param {object} options — legacy options または options.dsl
 */
function createPart(options = {}) {
  const raw = options.dsl ?? options;
  const runtimeOpts = { ...options };
  delete runtimeOpts.dsl;
  return applyPartDsl(raw, runtimeOpts);
}

/**
 * 現在ページに mm 指定の中央配置矩形を追加
 */
function layoutRectOnPageMm(mmW, mmH, style = {}) {
  const page = getCurrentPage();
  const layer = getCurrentLayer();
  if (layer.locked) {
    return { ok: false, error: "Current layer is locked" };
  }
  const paperMm = getPaperDimensions(page);
  const geom = layoutCenteredRectMm(mmW, mmH, paperMm, page.scale);
  const shape = {
    id: style.id || genId("shape"),
    type: "rect",
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    stroke: style.stroke ?? "#14213d",
    fill: style.fill ?? "#8fb7ff",
    strokeWidth: style.strokeWidth ?? "medium",
  };
  layer.shapes.push(shape);

  if (style.addDimensions) {
    _addDimensionsToPage(page, shape, style.dimensionOpts);
  }

  pushHistory();
  render();
  uiUpdate();

  return {
    ok: true,
    shapeId: shape.id,
    rect: {
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      mmW,
      mmH,
    },
  };
}
