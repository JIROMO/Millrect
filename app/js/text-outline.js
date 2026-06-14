"use strict";

// ── Text → per-glyph path (Electron: Core Text / fontkit) ─────────────
// Figma 式: 表示プレビューとアウトライン化で同じ glyph path を使う
// 輪郭ネスト: packages/text-contour-grouping.js（Swift も同期）

function isTextOutlineAvailable() {
  return Boolean(
    window.electronAPI?.outlineTextShape ||
    typeof ensureBrowserTextEngine === "function",
  );
}

function isTextNativePreviewEnabled() {
  return isTextOutlineAvailable();
}

/** native path プレビュー有効時は CSS foreignObject を出さない */
function shouldShowTextForeignObject(shape) {
  if (!isTextNativePreviewEnabled()) return true;
  if (!shape?.text || !/\S/.test(shape.text)) return true;
  return false;
}

function isTextNativeLayoutEnabled() {
  return Boolean(
    window.electronAPI?.measureTextLayout ||
    typeof ensureBrowserTextEngine === "function",
  );
}

async function _invokeMeasureTextLayout(payload) {
  if (window.electronAPI?.measureTextLayout) {
    return window.electronAPI.measureTextLayout(payload);
  }
  return browserMeasureTextLayout(payload);
}

async function _invokeOutlineText(payload) {
  if (window.electronAPI?.outlineTextShape) {
    return window.electronAPI.outlineTextShape(payload);
  }
  return browserOutlineText(payload);
}

const _textPreviewCache = new Map();
const _textPreviewTimers = new Map();
const _textPreviewFailures = new Map();
const _textLayoutCache = new Map();
const _textLayoutTimers = new Map();
const _textLiveTransformIds = new Set();

// テキストレイアウトは非同期（HarfBuzz）で後から確定する。renderer.js の
// #shape-root キャッシュはこのバージョンを署名に含めることで、図形 JSON が
// 同じでもレイアウト更新時に確実に作り直される。
let _textLayoutCacheVer = 0;
function textLayoutCacheVersion() {
  return _textLayoutCacheVer;
}
function _tlcSet(k, v) {
  _textLayoutCacheVer++;
  return _textLayoutCache.set(k, v);
}
function _tlcDel(k) {
  _textLayoutCacheVer++;
  return _textLayoutCache.delete(k);
}

function _parsePreviewKey(key) {
  try {
    return JSON.parse(key);
  } catch (_) {
    return null;
  }
}

function _scaleOutlineChildrenFromAnchor(children, anchorX, anchorY, sx, sy) {
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return children;
  return children.map((child) => ({
    ...child,
    contours: (child.contours || []).map((poly) =>
      poly.map((ring) =>
        ring.map(([x, y]) => [
          anchorX + (x - anchorX) * sx,
          anchorY + (y - anchorY) * sy,
        ]),
      ),
    ),
  }));
}

function _previewChildrenLiveTransform(entry, shape, scale) {
  const currentKey = _textPreviewKey(shape, scale);
  let children = entry.children;

  const old = _parsePreviewKey(entry.key);
  const cur = _parsePreviewKey(currentKey);
  if (old && cur) {
    const oldFs = old.fontSize ?? 3.5;
    const newFs = cur.fontSize ?? 3.5;
    const fontScale = newFs / oldFs;
    if (Math.abs(fontScale - 1) > 0.001) {
      children = _scaleOutlineChildrenFromAnchor(
        children,
        entry.originX ?? shape.x ?? 0,
        entry.originY ?? shape.y ?? 0,
        fontScale,
        fontScale,
      );
    }
  }

  return _colorizePreviewChildren(
    _previewChildrenForShape({ ...entry, children }, shape),
    shape,
  );
}

function _layoutMetricsLiveTransform(entry, shape, scale) {
  const metrics = entry.metrics;
  if (!metrics) return null;

  const old = _parsePreviewKey(entry.key);
  const cur = _parsePreviewKey(_textPreviewKey(shape, scale));
  const anchorPaper = {
    x: realToPaper(shape.x, scale),
    y: realToPaper(shape.y, scale),
  };
  const baseAnchor = metrics.anchorPaper || anchorPaper;
  const dxPaper = anchorPaper.x - baseAnchor.x;
  const dyPaper = anchorPaper.y - baseAnchor.y;

  let fontScale = 1;
  if (old && cur) {
    fontScale = (cur.fontSize ?? 3.5) / (old.fontSize ?? 3.5);
  }

  let layoutPaper = { ...metrics.layoutPaper };
  if (Math.abs(fontScale - 1) > 0.001) {
    layoutPaper = {
      ...layoutPaper,
      w: layoutPaper.w * fontScale,
      h: layoutPaper.h * fontScale,
    };
  }
  if (textHasFixedWidth(shape)) {
    layoutPaper = { ...layoutPaper, w: realToPaper(shape.width, scale) };
  }

  const lines = (metrics.lines || []).map((line) => {
    const relX = (line.xPaper ?? baseAnchor.x) - baseAnchor.x;
    const relY = (line.yTopPaper ?? baseAnchor.y) - baseAnchor.y;
    return {
      ...line,
      xPaper: anchorPaper.x + relX * fontScale,
      yTopPaper: anchorPaper.y + relY * fontScale,
    };
  });

  return { anchorPaper, layoutPaper, lines };
}

function isTextNativeLiveTransform(shapeId) {
  return _textLiveTransformIds.has(shapeId);
}

function setTextNativeLiveTransform(shapeId, active) {
  if (!shapeId) return;
  if (active) {
    _textLiveTransformIds.add(shapeId);
    const previewTimer = _textPreviewTimers.get(shapeId);
    if (previewTimer) {
      clearTimeout(previewTimer);
      _textPreviewTimers.delete(shapeId);
    }
    const layoutTimer = _textLayoutTimers.get(shapeId);
    if (layoutTimer) {
      clearTimeout(layoutTimer);
      _textLayoutTimers.delete(shapeId);
    }
    return;
  }

  _textLiveTransformIds.delete(shapeId);
  scheduleTextNativeLayout(shapeId, 0);
  scheduleTextNativePreview(shapeId, 0);
}

function _colorizePreviewChildren(children, shape) {
  const color = textShapeInkColor(shape);
  return children.map((child) => ({
    ...child,
    fill: color,
    stroke: "none",
  }));
}

function _contourGrouping() {
  const api = window.__millrectTextContourGrouping;
  if (!api?.groupRingsIntoPolygons) {
    throw new Error(
      "packages/text-contour-grouping.js must load before text-outline.js",
    );
  }
  return api;
}

function _flattenContourRings(contours) {
  const rings = [];
  for (const poly of contours || []) {
    for (const ring of poly || []) {
      if (ring?.length > 2) rings.push(ring);
    }
  }
  return rings;
}

/** フラットな輪郭を親子ネストした compound path に再構成 */
function _groupContourRings(contours) {
  const rings = _flattenContourRings(contours);
  if (rings.length <= 1) return contours;
  return _contourGrouping().groupRingsIntoPolygons(rings);
}

function _flattenToSingleRingPolys(contours) {
  const polys = [];
  for (const poly of contours || []) {
    for (const ring of poly || []) {
      if (ring?.length > 2) polys.push([ring]);
    }
  }
  return polys;
}

/** 離れた stroke 分解のみ union。ネスト grouping は subpath の向きを壊すので行わない */
function _unionGlyphContours(contours) {
  if (!contours?.length) return contours || [];
  if (typeof polygonClipping !== "object" || !polygonClipping?.union) {
    return contours;
  }

  const flatPolys = _flattenToSingleRingPolys(contours);
  const rings = flatPolys.map((poly) => poly[0]);
  if (
    _contourGrouping().shouldUnionStrokeFragments(flatPolys) &&
    _contourGrouping().shouldUnionOverlappingPositiveRings(rings)
  ) {
    try {
      const united = polygonClipping.union(...flatPolys);
      if (united?.length) return united;
    } catch (err) {
      console.warn("[text-outline] stroke fragment union failed", err);
    }
  }

  return contours;
}

function _prepareGlyphOutlineChild(child, fillColor) {
  let contours = _unionGlyphContours(child.contours || []);
  contours = _groupContourRings(contours);
  const fillRule = "nonzero";
  return {
    type: "path",
    contours,
    fill: fillColor,
    stroke: "none",
    fillRule,
  };
}

function _outlineChildHasArea(child) {
  for (const poly of child?.contours || []) {
    for (const ring of poly) {
      if (ring?.length > 2) return true;
    }
  }
  return false;
}

async function _projectFontFilesForPayload(shape) {
  if (typeof findProjectFontByFamily !== "function") return [];
  if (typeof fetchProjectFontBytes !== "function") return [];

  const files = [];
  const seen = new Set();
  const wantBold = shape.fontWeight === "bold";
  const addEntry = async (entry) => {
    if (!entry?.family || seen.has(entry.family.toLowerCase())) return;
    try {
      const bytes = await fetchProjectFontBytes(entry, wantBold);
      if (!bytes?.length) return;
      seen.add(entry.family.toLowerCase());
      files.push({
        family: entry.family,
        bold: wantBold,
        data: Array.from(bytes),
      });
    } catch (err) {
      console.warn(
        "[text-outline] project font bytes failed",
        entry.family,
        err,
      );
    }
  };

  await addEntry(findProjectFontByFamily(shape?.fontFamily));
  const primary = textEnginePrimaryFontFamily(shape);
  if (primary !== normalizeTextFontFamily(shape?.fontFamily)) {
    await addEntry(findProjectFontByFamily(primary));
  }
  return files;
}

function _textPreviewKey(shape, scale) {
  return JSON.stringify({
    text: shape.text ?? "",
    width: shape.width ?? null,
    fontSize: shape.fontSize ?? 3.5,
    fontFamily: shape.fontFamily ?? "",
    fontWeight: shape.fontWeight ?? "normal",
    textAlign: shape.textAlign ?? "left",
    lineHeight: shape.lineHeight ?? textShapeLineHeight(shape),
    fill: shape.fill ?? "",
    stroke: shape.stroke ?? "",
    scale,
  });
}

function _translateOutlineChildrenXY(children, dxReal, dyReal) {
  if (Math.abs(dxReal) < 1e-9 && Math.abs(dyReal) < 1e-9) return children;
  return children.map((child) => ({
    ...child,
    contours: (child.contours || []).map((poly) =>
      poly.map((ring) => ring.map(([x, y]) => [x + dxReal, y + dyReal])),
    ),
  }));
}

function _previewChildrenForShape(entry, shape) {
  const dx = (shape.x ?? 0) - (entry.originX ?? shape.x ?? 0);
  const dy = (shape.y ?? 0) - (entry.originY ?? shape.y ?? 0);
  return _translateOutlineChildrenXY(entry.children, dx, dy);
}

function _textNeedsCjk(text) {
  return /[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test(text || "");
}

function _fontCandidatesForOutline(shape) {
  const out = [];
  const seen = new Set();
  const add = (name) => {
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push(name);
  };
  const primary = textEnginePrimaryFontFamily(shape);
  add(primary);
  if (typeof findProjectFontByFamily === "function") {
    const project = findProjectFontByFamily(shape?.fontFamily);
    if (project?.family) add(project.family);
  }
  if (_textNeedsCjk(shape.text) && !isBuiltinFontFamily(primary)) {
    add(BUILTIN_FONT_GEN);
  }
  return out;
}

function textNativePreviewBBoxPaper(children, scale) {
  return _outlineChildrenBBoxPaper(children, scale);
}

function _outlineChildrenBBoxPaper(children, scale) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const child of children) {
    for (const poly of child.contours || []) {
      for (const ring of poly) {
        for (const pt of ring) {
          if (!pt || pt.length < 2) continue;
          const px = realToPaper(pt[0], scale);
          const py = realToPaper(pt[1], scale);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function _alignOutlineChildrenVertically(children, anchorYPaper, scale) {
  const pathBb = _outlineChildrenBBoxPaper(children, scale);
  if (!pathBb || !Number.isFinite(anchorYPaper)) return children;

  const dyPaper = anchorYPaper - pathBb.y;
  if (Math.abs(dyPaper) <= 0.01) return children;

  const dyReal = paperToRealDist(dyPaper, scale);

  return children.map((child) => ({
    ...child,
    contours: (child.contours || []).map((poly) =>
      poly.map((ring) => ring.map(([x, y]) => [x, y + dyReal])),
    ),
  }));
}

function _buildLayoutPayload(shape, scale) {
  return {
    shape: {
      text: shape.text,
      fontSize: shape.fontSize ?? 3.5,
      fontFamily: shape.fontFamily,
      fontWeight: shape.fontWeight,
      textAlign: shape.textAlign,
      lineHeight: shape.lineHeight ?? textShapeLineHeight(shape),
      stroke:
        typeof textShapeInkColor === "function"
          ? textShapeInkColor(shape)
          : shape.stroke || "#1a1a2e",
      strokeWidth: shape.strokeWidth,
    },
    scale,
    anchorPaper: {
      x: realToPaper(shape.x, scale),
      y: realToPaper(shape.y, scale),
    },
    paperWidth: textHasFixedWidth(shape)
      ? realToPaper(shape.width, scale)
      : null,
    fontCandidates: _fontCandidatesForOutline(shape),
  };
}

function _buildOutlinePayload(shape, scale, metrics) {
  const anchorPaper = {
    x: realToPaper(shape.x, scale),
    y: realToPaper(shape.y, scale),
  };
  const base = _buildLayoutPayload(shape, scale);

  if (metrics?.lines?.length) {
    return {
      payload: {
        ...base,
        layoutPaper: {
          insetTop: metrics.layoutPaper?.insetTop ?? 0,
          insetLeft: metrics.layoutPaper?.insetLeft ?? 0,
        },
        lines: metrics.lines,
      },
      anchorPaper,
    };
  }

  if (isTextOutlineAvailable()) {
    return { payload: base, anchorPaper };
  }

  const m = measureTextOutlineMetricsDom(shape, scale);
  return {
    payload: {
      ...base,
      layoutPaper: {
        insetTop: m.layoutPaper?.insetTop ?? 0,
        insetLeft: m.layoutPaper?.insetLeft ?? 0,
      },
      lines: m.lines,
    },
    anchorPaper,
  };
}

async function _fetchOutlineChildren(shape, scale) {
  const { payload, anchorPaper } = _buildOutlinePayload(shape, scale);
  payload.projectFontFiles = await _projectFontFilesForPayload(shape);
  const result = await _invokeOutlineText(payload);

  if (result?.error) throw new Error(result.error);
  if (!result?.children?.length) {
    throw new Error("アウトライン化できるグリフがありませんでした");
  }

  if (result.layout) {
    _tlcSet(shape.id, {
      key: _textPreviewKey(shape, scale),
      metrics: result.layout,
    });
  }

  const fillColor =
    typeof textShapeInkColor === "function"
      ? textShapeInkColor(shape)
      : shape.stroke || "#1a1a2e";
  let children = result.children
    .map((child) => _prepareGlyphOutlineChild(child, fillColor))
    .filter(_outlineChildHasArea);
  if (!children.length) {
    throw new Error("アウトライン化できるグリフがありませんでした");
  }
  children = _alignOutlineChildrenVertically(children, anchorPaper.y, scale);
  return children;
}

function invalidateTextNativePreview(shapeId) {
  if (!shapeId) return;
  _textPreviewCache.delete(shapeId);
  _textPreviewFailures.delete(shapeId);
  _tlcDel(shapeId);
  const timer = _textPreviewTimers.get(shapeId);
  if (timer) {
    clearTimeout(timer);
    _textPreviewTimers.delete(shapeId);
  }
  const layoutTimer = _textLayoutTimers.get(shapeId);
  if (layoutTimer) {
    clearTimeout(layoutTimer);
    _textLayoutTimers.delete(shapeId);
  }
}

function getTextNativeLayoutMetrics(shapeId, shape, scale) {
  if (!isTextNativeLayoutEnabled() || !shapeId) return null;
  const entry = _textLayoutCache.get(shapeId);
  if (!entry?.metrics) return null;
  const key = _textPreviewKey(shape, scale);
  if (entry.key !== key) {
    if (_textLiveTransformIds.has(shapeId)) {
      return _layoutMetricsLiveTransform(entry, shape, scale);
    }
    scheduleTextNativeLayout(shapeId);
    return null;
  }
  return entry.metrics;
}

function scheduleTextNativeLayout(shapeId, delay = 60) {
  if (!isTextNativeLayoutEnabled() || !shapeId) return;
  if (_textLiveTransformIds.has(shapeId)) return;
  const prev = _textLayoutTimers.get(shapeId);
  if (prev) clearTimeout(prev);
  _textLayoutTimers.set(
    shapeId,
    setTimeout(() => {
      _textLayoutTimers.delete(shapeId);
      void refreshTextNativeLayout(shapeId);
    }, delay),
  );
}

async function refreshTextNativeLayout(shapeId) {
  if (!isTextNativeLayoutEnabled()) return;
  const located = findShapeById(shapeId);
  if (!located || located.shape.type !== "text") {
    _tlcDel(shapeId);
    return;
  }

  const shape = located.shape;
  if (!shape.text || !/\S/.test(shape.text)) {
    _tlcDel(shapeId);
    return;
  }

  const scale = getCurrentPage().scale;
  const key = _textPreviewKey(shape, scale);
  const cached = _textLayoutCache.get(shapeId);
  if (cached?.key === key && cached.metrics) return;

  try {
    const payload = _buildLayoutPayload(shape, scale);
    payload.projectFontFiles = await _projectFontFilesForPayload(shape);
    const result = await _invokeMeasureTextLayout(payload);
    if (result?.error) throw new Error(result.error);
    if (result?.layout) {
      _tlcSet(shapeId, { key, metrics: result.layout });
      render();
    }
  } catch (err) {
    console.warn("[text-layout] failed", err);
    _tlcDel(shapeId);
  }
}

function refreshAllTextNativeLayouts() {
  if (!isTextNativeLayoutEnabled()) return;
  const page = getCurrentPage();
  for (const layer of page.layers || []) {
    for (const shape of layer.shapes || []) {
      if (shape.type === "text" && shape.text && /\S/.test(shape.text)) {
        scheduleTextNativeLayout(shape.id, 0);
      }
    }
  }
}

function getTextNativePreviewChildren(shapeId, shape, scale) {
  if (!isTextNativePreviewEnabled()) return null;
  const entry = _textPreviewCache.get(shapeId);
  if (!entry?.children?.length) return null;
  const key = _textPreviewKey(shape, scale);
  if (entry.key !== key) {
    if (_textLiveTransformIds.has(shapeId)) {
      return _previewChildrenLiveTransform(entry, shape, scale);
    }
    scheduleTextNativePreview(shapeId, 0);
    // 新 path 取得まで前回の path を表示（CSS への切替を避ける）
    return _colorizePreviewChildren(
      _previewChildrenForShape(entry, shape),
      shape,
    );
  }
  return _colorizePreviewChildren(
    _previewChildrenForShape(entry, shape),
    shape,
  );
}

function scheduleTextNativePreview(shapeId, delay = 120) {
  if (!isTextNativePreviewEnabled() || !shapeId) return;
  if (_textLiveTransformIds.has(shapeId)) return;
  const located = findShapeById(shapeId);
  if (!located || located.shape.type !== "text") return;
  const key = _textPreviewKey(located.shape, getCurrentPage().scale);
  if (_textPreviewFailures.get(shapeId) === key) return;
  const prev = _textPreviewTimers.get(shapeId);
  if (prev) clearTimeout(prev);
  _textPreviewTimers.set(
    shapeId,
    setTimeout(() => {
      _textPreviewTimers.delete(shapeId);
      void refreshTextNativePreview(shapeId);
    }, delay),
  );
}

async function refreshTextNativePreview(shapeId) {
  if (!isTextNativePreviewEnabled()) return;
  const located = findShapeById(shapeId);
  if (!located || located.shape.type !== "text") {
    invalidateTextNativePreview(shapeId);
    return;
  }

  const shape = located.shape;
  if (!shape.text || !/\S/.test(shape.text)) {
    invalidateTextNativePreview(shapeId);
    render();
    return;
  }

  const scale = getCurrentPage().scale;
  const key = _textPreviewKey(shape, scale);
  if (_textPreviewFailures.get(shapeId) === key) return;
  const cached = _textPreviewCache.get(shapeId);
  if (cached?.key === key && cached.children?.length) return;

  try {
    const children = await _fetchOutlineChildren(shape, scale);
    _textPreviewFailures.delete(shapeId);
    _textPreviewCache.set(shapeId, {
      key,
      children,
      originX: shape.x ?? 0,
      originY: shape.y ?? 0,
    });
    render();
  } catch (err) {
    console.warn("[text-preview] failed", err);
    _textPreviewFailures.set(shapeId, key);
    render();
  }
}

function refreshAllTextNativePreviews() {
  if (!isTextNativePreviewEnabled()) return;
  refreshAllTextNativeLayouts();
  const page = getCurrentPage();
  for (const layer of page.layers || []) {
    for (const shape of layer.shapes || []) {
      if (shape.type === "text" && shape.text && /\S/.test(shape.text)) {
        scheduleTextNativePreview(shape.id, 0);
      }
    }
  }
}

function onTextShapeDocumentChanged(shapeId, changedKeys) {
  if (!shapeId) return;
  const keys = changedKeys || [];
  const styleKeys = new Set([
    "text",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "textAlign",
    "lineHeight",
    "fill",
    "stroke",
    "width",
  ]);
  const needsRegen = keys.some((k) => styleKeys.has(k.split(".")[0]));
  if (needsRegen || !keys.length) {
    scheduleTextNativeLayout(shapeId, 0);
    scheduleTextNativePreview(shapeId, 0);
  }
}

async function outlineTextShape(shapeOrId) {
  try {
    if (!isTextOutlineAvailable()) {
      alert(t("common.alert.outlineUnavailable"));
      return;
    }

    const id = typeof shapeOrId === "string" ? shapeOrId : shapeOrId?.id;
    const located = findShapeById(id);
    if (!located || located.shape.type !== "text") return;

    const shape = located.shape;
    const { layer } = located;

    if (!shape.text || !/\S/.test(shape.text)) {
      alert(t("common.alert.outlineNoText"));
      return;
    }

    const scale = getCurrentPage().scale;
    const key = _textPreviewKey(shape, scale);
    const cached = _textPreviewCache.get(id);
    let children;

    if (cached?.key === key && cached.children?.length) {
      children = _previewChildrenForShape(cached, shape).map((child) => ({
        ...child,
        id: genId("path"),
      }));
    } else {
      children = (await _fetchOutlineChildren(shape, scale)).map((child) => ({
        ...child,
        id: genId("path"),
      }));
    }

    invalidateTextNativePreview(id);

    const group = {
      id: genId("group"),
      type: "group",
      children,
    };

    const idx = layer.shapes.findIndex((s) => s.id === shape.id);
    if (idx === -1) {
      alert(t("common.alert.textNotFound"));
      return;
    }
    layer.shapes.splice(idx, 1, group);

    getState().selectedShapeIds = [group.id];
    pushHistory();
    render();
    uiUpdate();
  } catch (err) {
    console.error("outlineTextShape failed", err);
    alert(t("common.alert.outlineFailed", { message: err.message || err }));
  }
}
