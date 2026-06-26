"use strict";

// ── Constants ────────────────────────────────────────────────
const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
};

const SCALES = [
  { label: "1/1", numerator: 1, denominator: 1 },
  { label: "1/2", numerator: 1, denominator: 2 },
  { label: "1/5", numerator: 1, denominator: 5 },
  { label: "1/10", numerator: 1, denominator: 10 },
  { label: "1/20", numerator: 1, denominator: 20 },
  { label: "1/50", numerator: 1, denominator: 50 },
  { label: "1/100", numerator: 1, denominator: 100 },
];

// Legacy named widths (kept for backward compat with existing documents).
const LINE_WIDTHS = { thin: 0.2, medium: 0.5, thick: 1.0 };
// ISO 128 technical-drawing line weights (mm on the physical sheet).
const STROKE_WIDTH_PRESETS = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0];
// Resolve a shape.strokeWidth (number mm, ISO string "0.35", or legacy
// "thin"/"medium"/"thick") to a width in mm.
function resolveStrokeWidthMm(v) {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    if (v in LINE_WIDTHS) return LINE_WIDTHS[v];
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return LINE_WIDTHS.medium;
}
// Line styles (dash patterns). solid = no dash.
const LINE_STYLES = ["solid", "dashed", "dotted", "dashdot"];

// ── ID generator ─────────────────────────────────────────────
let _idCounter = 1;
function genId(prefix = "obj") {
  return `${prefix}-${Date.now()}-${_idCounter++}`;
}

// ── History / State ──────────────────────────────────────────
const MAX_HISTORY = 100;
let _history = [];
let _histIdx = -1;
let _state = null;
let _documentRenderVersion = 0;
const _shapeRenderVersions = new Map();
const _pendingRenderableDirtyIds = new Set();
let _pendingDocumentDirty = false;

function deepClone(o) {
  return typeof structuredClone === "function"
    ? structuredClone(o)
    : JSON.parse(JSON.stringify(o));
}

function initState() {
  _state = defaultState();
  _imageStore.clear();
  _history = [_serializeDoc()]; // _state が確定した後に呼ぶ
  _historyLabels = ["初期状態"];
  _histIdx = 0;
  _resetRenderableVersions(_history[0]);
  return _state;
}

function getState() {
  // selectedShapeIds は配列であることが renderer/interaction/ui の前提。
  // 外部コマンド等で undefined/非配列になっても落ちないよう自己修復する。
  if (_state && !Array.isArray(_state.selectedShapeIds)) {
    _state.selectedShapeIds = [];
  }
  return _state;
}

// ── Doc vs UI state ──────────────────────────────────────────
// History snapshots only the "document" fields (the editable 2D drawing).
// UI state (zoom, pan, tool, selection) is intentionally excluded:
//   - Undo should never revert the viewport or the active tool.
//   - Export only needs document fields.
const DOC_KEYS = [
  "projectName",
  "unit",
  "fonts",
  "pages",
  "partIntent",
];

// ── 参照画像の de-dup ────────────────────────────────────────
// referenceImage.dataUrl（base64 の下絵）は読み込み後に内容が変わらないのに、
// 素直に履歴へ含めると最大 MAX_HISTORY コピーが文字列で複製されメモリを食う。
// そこでセッション内に dataUrl を imageId 単位で 1 コピーだけ持ち、履歴文字列には
// imageId だけを載せる（_historyReplacer）。復元時に _rehydrateImages で戻す。
// 保存 / エクスポートは _historyReplacer を通さない別経路なのでファイルは自己完結。
const _imageStore = new Map(); // imageId -> dataUrl

function _ensureImageIds() {
  for (const page of _state.pages || []) {
    const img = page.referenceImage;
    if (img && img.dataUrl) {
      if (!img.imageId)
        img.imageId = "img-" + Math.random().toString(36).slice(2, 10);
      _imageStore.set(img.imageId, img.dataUrl);
    }
  }
}

function _historyReplacer(key, value) {
  // imageId で復元できる referenceImage は dataUrl を履歴文字列から外す
  if (key === "referenceImage" && value && value.dataUrl && value.imageId) {
    const { dataUrl, ...rest } = value;
    return rest;
  }
  return value;
}

function _rehydrateImages(snap) {
  for (const page of snap?.pages || []) {
    const img = page.referenceImage;
    if (img && !img.dataUrl && img.imageId) {
      const data = _imageStore.get(img.imageId);
      if (data) img.dataUrl = data;
    }
  }
}

// 現 _state のドキュメント部分を、画像 dataUrl を抜いた履歴文字列に直列化する。
function _serializeDoc() {
  _ensureImageIds();
  const snapRef = Object.fromEntries(DOC_KEYS.map((k) => [k, _state[k]]));
  return JSON.stringify(snapRef, _historyReplacer);
}

function _iterRenderableSnapshots(doc, cb) {
  for (const page of doc?.pages || []) {
    for (const layer of page.layers || []) {
      for (const shape of layer.shapes || []) cb(shape);
    }
    for (const dim of page.dimensions || []) cb(dim);
  }
}

function _renderableSnapshotMap(doc) {
  const out = new Map();
  _iterRenderableSnapshots(doc, (shape) => {
    if (shape?.id) out.set(shape.id, JSON.stringify(shape));
  });
  return out;
}

function _bumpShapeRenderVersion(id) {
  if (!id) return;
  _shapeRenderVersions.set(id, (_shapeRenderVersions.get(id) || 0) + 1);
}

function _clearPendingRenderableDirty() {
  _pendingRenderableDirtyIds.clear();
  _pendingDocumentDirty = false;
}

function _syncRenderableVersions(prevStr, nextStr) {
  if (!nextStr) return;
  if (_pendingDocumentDirty || _pendingRenderableDirtyIds.size > 0) {
    _clearPendingRenderableDirty();
    _documentRenderVersion++;
    return;
  }
  const prev = prevStr
    ? _renderableSnapshotMap(JSON.parse(prevStr))
    : new Map();
  const next = _renderableSnapshotMap(JSON.parse(nextStr));
  const ids = new Set([...prev.keys(), ...next.keys()]);
  for (const id of ids) {
    if (prev.get(id) !== next.get(id)) _bumpShapeRenderVersion(id);
  }
  _documentRenderVersion++;
}

function _resetRenderableVersions(snapStr) {
  _shapeRenderVersions.clear();
  _clearPendingRenderableDirty();
  if (snapStr) {
    const snap = JSON.parse(snapStr);
    _iterRenderableSnapshots(snap, (shape) =>
      _bumpShapeRenderVersion(shape?.id),
    );
  }
  _documentRenderVersion++;
}

function getDocumentRenderVersion() {
  return _documentRenderVersion;
}

function getShapeRenderVersion(id) {
  return _shapeRenderVersions.get(id) || 0;
}

function markShapeDirty(id) {
  if (!id) return;
  _bumpShapeRenderVersion(id);
  _pendingRenderableDirtyIds.add(id);
  for (const group of findAncestorGroups(id) || []) {
    _bumpShapeRenderVersion(group.id);
    _pendingRenderableDirtyIds.add(group.id);
  }
  _pendingDocumentDirty = true;
  _documentRenderVersion++;
}

function markDocumentDirty() {
  _pendingDocumentDirty = true;
  _documentRenderVersion++;
}

function _restoreDoc(snapOrStr) {
  const snap =
    typeof snapOrStr === "string" ? JSON.parse(snapOrStr) : snapOrStr;
  _rehydrateImages(snap);
  for (const k of DOC_KEYS) _state[k] = deepClone(snap[k]);
}

// _historyLabels: 各 history エントリの説明ラベル
let _historyLabels = ["初期状態"];

function pushHistory(label) {
  // 履歴はずっと文字列で保持するので、ここで構造化クローンする必要はない。
  // ドキュメント部分への浅い参照を一度だけ JSON 化すれば足りる（毎編集の
  // structuredClone をまるごと省く）。画像 dataUrl は _historyReplacer で除外。
  const snapStr = _serializeDoc();
  // 直前のスナップショットと同一なら何もしない（触っただけで履歴が増えるのを防ぐ）
  if (_histIdx >= 0 && _history[_histIdx] === snapStr) {
    _clearPendingRenderableDirty();
    return;
  }
  const prevStr = _histIdx >= 0 ? _history[_histIdx] : null;
  _history = _history.slice(0, _histIdx + 1);
  _historyLabels = _historyLabels.slice(0, _histIdx + 1);
  _history.push(snapStr);
  _syncRenderableVersions(prevStr, snapStr);
  _historyLabels.push(label || _inferHistoryLabel(JSON.parse(snapStr)));
  if (_history.length > MAX_HISTORY) {
    _history.shift();
    _historyLabels.shift();
  }
  _histIdx = _history.length - 1;
  if (typeof onStateChanged === "function") onStateChanged();
}

// 直前の操作からラベルを自動推定
function _inferHistoryLabel(cur) {
  // state のページ・シェイプ数の変化で大まかに推定
  if (!_history.length) return "操作";
  const prev = JSON.parse(_history[_histIdx]);
  const prevShapes =
    prev.pages?.flatMap(
      (p) => p.layers?.flatMap((l) => l.shapes || []) || [],
    ) || [];
  const curShapes =
    cur.pages?.flatMap((p) => p.layers?.flatMap((l) => l.shapes || []) || []) ||
    [];
  const prevDims = prev.pages?.flatMap((p) => p.dimensions || []) || [];
  const curDims = cur.pages?.flatMap((p) => p.dimensions || []) || [];
  if (curShapes.length > prevShapes.length)
    return `図形追加 (${curShapes.length}個)`;
  if (curShapes.length < prevShapes.length)
    return `図形削除 (${prevShapes.length - curShapes.length}個)`;
  if (curDims.length > prevDims.length) return "寸法線追加";
  if (curDims.length < prevDims.length) return "寸法線削除";
  return "編集";
}

function getHistoryLabels() {
  return _historyLabels.slice();
}

function getHistoryIndex() {
  return _histIdx;
}

function jumpToHistory(idx) {
  if (idx < 0 || idx >= _history.length) return false;
  const prevStr = _histIdx >= 0 ? _history[_histIdx] : null;
  const nextStr = _history[idx];
  _histIdx = idx;
  _syncRenderableVersions(prevStr, nextStr);
  _restoreDoc(_history[_histIdx]);
  if (typeof onStateChanged === "function") onStateChanged();
  return true;
}

function undo() {
  if (_histIdx > 0) {
    const prevStr = _history[_histIdx];
    _histIdx--;
    _syncRenderableVersions(prevStr, _history[_histIdx]);
    _restoreDoc(_history[_histIdx]);
    if (typeof onStateChanged === "function") onStateChanged();
    return true;
  }
  return false;
}
function redo() {
  if (_histIdx < _history.length - 1) {
    const prevStr = _history[_histIdx];
    _histIdx++;
    _syncRenderableVersions(prevStr, _history[_histIdx]);
    _restoreDoc(_history[_histIdx]);
    if (typeof onStateChanged === "function") onStateChanged();
    return true;
  }
  return false;
}
function canUndo() {
  return _histIdx > 0;
}
function canRedo() {
  return _histIdx < _history.length - 1;
}

function replaceState(newState) {
  _state = newState;
  _imageStore.clear(); // 履歴を作り直すので古い画像参照は破棄
  _history = [_serializeDoc()]; // ドキュメント部分のみ保存（画像 dataUrl は除外）
  _historyLabels = ["読み込み"];
  _histIdx = 0;
  _resetRenderableVersions(_history[0]);
}

// ── Accessors ────────────────────────────────────────────────
function getCurrentPage() {
  return (
    _state.pages.find((p) => p.id === _state.currentPageId) || _state.pages[0]
  );
}
function getCurrentLayer() {
  const page = getCurrentPage();
  return (
    page.layers.find((l) => l.id === _state.currentLayerId) || page.layers[0]
  );
}
// ドキュメント内の「図形」のみ返す（寸法線は含まない）
// Profile抽出・boolean演算・3D生成はこれを使う
function getAllShapesOnPage(page) {
  const out = [];
  for (const layer of page.layers) {
    for (const s of layer.shapes) out.push(s);
  }
  return out;
}

// 寸法線を含む全アノテーションを返す（ページ単位）
function getAllDimensionsOnPage(page) {
  return page.dimensions || [];
}

// 図形・寸法線どちらでも検索する汎用ルックアップ
// 戻り値: { shape, layer|null, page, isDimension }
function findShapeById(id) {
  for (const page of _state.pages) {
    // レイヤー内の図形を検索
    for (const layer of page.layers) {
      const shape = layer.shapes.find((s) => s.id === id);
      if (shape) return { shape, layer, page, isDimension: false };
      // グループ子要素を検索
      for (const s of layer.shapes) {
        if (s.type === "group") {
          const child = s.children.find((c) => c.id === id);
          if (child) return { shape: child, layer, page, isDimension: false };
        }
      }
    }
    // ページ直属の寸法線を検索
    for (const dim of page.dimensions || []) {
      if (dim.id === id)
        return { shape: dim, layer: null, page, isDimension: true };
    }
  }
  return null;
}

// If the given id belongs to a group child, return the group's id; otherwise return id as-is
function resolveToTopLevelId(id) {
  for (const page of _state.pages)
    for (const layer of page.layers) {
      if (layer.shapes.find((s) => s.id === id)) return id;
      for (const s of layer.shapes) {
        if (s.type === "group" && s.children.find((c) => c.id === id))
          return s.id;
      }
    }
  return id;
}

function findAncestorGroups(id) {
  const groups = [];
  for (const page of _state.pages) {
    for (const layer of page.layers) {
      function walk(shapes, stack) {
        for (const shape of shapes) {
          if (shape.id === id) {
            groups.push(...stack);
            return true;
          }
          if (shape.type === "group" && Array.isArray(shape.children)) {
            if (walk(shape.children, [...stack, shape])) return true;
          }
        }
        return false;
      }
      if (walk(layer.shapes, [])) return groups;
    }
  }
  return groups;
}

function defaultState() {
  return {
    projectName: typeof t === "function" ? t("default.untitled") : "Untitled",
    unit: "mm",
    fonts: [],
    partIntent: null,
    currentPageId: "page-1",
    currentLayerId: "layer-1",
    selectedShapeIds: [],
    activeTool: "select",
    appMode: "2d", // "2d" | "3d"（UI 専用・Undo/export 非対象。DOC_KEYS に含めない）
    zoom: 2.0,
    panX: 40,
    panY: 40,
    showGrid: true,
    showViewGuides: true, // 他ビュー輪郭の見通し線（UI 専用・Undo 非対象）
    gridSize: 1,
    snapEnabled: true,
    drawFill: "none",
    drawStroke: "#1a1a2e",
    penWidth: 1.5, // 鉛筆の線幅（用紙 mm）。UI 専用・Undo 非対象
    pages: [
      {
        id: "page-1",
        name: typeof t === "function" ? t("default.planPage") : "平面図",
        paper: "A4",
        orientation: "landscape",
        scale: { numerator: 1, denominator: 10 },
        // ViewDefinition: 3D座標系との対応。2D図面を編集すれば、3Dはここから再生成される。
        // type: "top"|"front"|"right"|"section"|"detail"|null
        // normal: 3D法線ベクトル（Z-up系）、null = 未定義
        viewDefinition: { type: "top", normal: [0, 0, 1], up: [0, 1, 0] },
        // dimensions: ページ直属の寸法線アノテーション（layer.shapes には含まれない）
        // これにより Profile抽出・boolean演算・3D生成が寸法線を無視できる
        dimensions: [],
        // constraints: 幾何拘束リスト（layer.shapes には含まれない）
        // applyConstraints() によって shapes の座標が強制される
        constraints: [],
        layers: [
          {
            id: "layer-1",
            name: typeof t === "function" ? t("default.bodyLayer") : "本体",
            visible: true,
            locked: false,
            shapes: [],
          },
        ],
      },
    ],
  };
}

// ── Units (1 mm = 10 real units) ─────────────────────────────
const REAL_PER_MM = 10;
function realToMM(v) {
  return v / REAL_PER_MM;
}
function mmToReal(v) {
  return v * REAL_PER_MM;
}

// ── Page helpers ─────────────────────────────────────────────
function getPaperSizeMm(page) {
  const s = PAPER_SIZES[page.paper] || PAPER_SIZES.A4;
  return page.orientation === "landscape"
    ? { width: s.height, height: s.width }
    : { width: s.width, height: s.height };
}

/** real units → 用紙上 mm（物理シート上の長さ） */
function realToPaperDist(real, scale) {
  scale = scale || { numerator: 1, denominator: 1 };
  return (real / REAL_PER_MM) * (scale.numerator / scale.denominator);
}

/** 用紙上 mm → real units（実寸） */
function paperToRealDist(paper, scale) {
  scale = scale || { numerator: 1, denominator: 1 };
  return paper * REAL_PER_MM * (scale.denominator / scale.numerator);
}

function paperDeltaToReal(dPaper, scale) {
  return paperToRealDist(dPaper, scale);
}

/** 用紙キャンバスは常に物理用紙サイズ（mm） */
function getPaperDimensions(page) {
  return getPaperSizeMm(page);
}

/** ページが表す実世界の範囲（real units）。3D 生成で使用。 */
function getPageCanvasMM(page) {
  const { width, height } = getPaperSizeMm(page);
  const sc = page.scale || { numerator: 1, denominator: 1 };
  const toRealMm = (mm) => mm * (sc.denominator / sc.numerator);
  return { w: mmToReal(toRealMm(width)), h: mmToReal(toRealMm(height)) };
}
function createPage(opts = {}) {
  return {
    id: opts.id || genId("page"),
    name:
      opts.name ||
      (typeof t === "function" ? t("default.page", { n: 1 }) : "ページ 1"),
    paper: opts.paper || "A4",
    orientation: opts.orientation || "landscape",
    scale: opts.scale || { numerator: 1, denominator: 10 },
    viewDefinition: opts.viewDefinition || {
      type: null,
      normal: null,
      up: null,
    },
    dimensions: opts.dimensions || [],
    constraints: opts.constraints || [],
    referenceImage: opts.referenceImage ?? null,
    layers: opts.layers || [
      {
        id: genId("layer"),
        name: typeof t === "function" ? t("default.bodyLayer") : "本体",
        visible: true,
        locked: false,
        shapes: [],
      },
    ],
  };
}
function createLayer(opts = {}) {
  return {
    id: opts.id || genId("layer"),
    name:
      opts.name ||
      (typeof t === "function" ? t("default.layer", { n: 1 }) : "レイヤー 1"),
    visible: true,
    locked: false,
    shapes: [],
  };
}

function paperDistToReal(paperDist, scale) {
  return paperToRealDist(paperDist, scale);
}
function paperDistToMM(paperDist, scale) {
  return realToMM(paperDistToReal(paperDist, scale));
}
function shapeBBoxMM(shape, pageScale) {
  const bb = getShapeBBox(shape, pageScale);
  if (!bb) return null;
  return {
    x: paperDistToMM(bb.x, pageScale),
    y: paperDistToMM(bb.y, pageScale),
    w: paperDistToMM(bb.w, pageScale),
    h: paperDistToMM(bb.h, pageScale),
  };
}
function dimensionRealDistance(dim) {
  return dim.dimensionType === "horizontal"
    ? Math.abs(dim.to.x - dim.from.x)
    : Math.abs(dim.to.y - dim.from.y);
}
// value: mm 上書き。旧データで real units が入っている場合は自動値にフォールバック
function dimensionValueMM(dim) {
  const autoMM = realToMM(dimensionRealDistance(dim));
  if (dim.value === undefined) return autoMM;
  if (Math.abs(dim.value - dimensionRealDistance(dim)) < 0.5) return autoMM;
  return dim.value;
}

// ── Snapping ─────────────────────────────────────────────────
function snapPoint(pt, gridMm = 1) {
  const step = gridMm;
  if (!(step > 0)) return pt;
  return {
    x: Math.round(pt.x / step) * step,
    y: Math.round(pt.y / step) * step,
  };
}

// ── スナップ候補ジオメトリ収集（snapToShapes / snapDragPoints 共用）──
// 各 shape のキーポイントとセグメントを paper 座標でコールバックに渡す。
//   onPoint(x, y, snapType, priority)
//   onSegment({ x1, y1, x2, y2 })
// rotation/flipH/flipV は表示変換だが、スナップは表示位置に合わせる必要が
// あるため renderer と同じ変換（applyWorldTransformReal）を候補点にも適用する
// グループのスナップ用 world-AABB（real 単位）。子が多いグループで毎フレーム
// 全頂点を walk しないよう、ドキュメント版数をキーにキャッシュする。
const _groupSnapAABBCache = new Map(); // id -> { ver, aabb }
function _groupSnapAABB(group, ancestors) {
  const ver =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : -1;
  const cached = _groupSnapAABBCache.get(group.id);
  if (cached && cached.ver === ver) return cached.aabb;
  let aabb = null;
  if (typeof collectWorldPointsReal === "function") {
    const pts = collectWorldPointsReal(group, ancestors);
    if (pts && pts.length) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      aabb = { minX, minY, maxX, maxY };
    }
  }
  _groupSnapAABBCache.set(group.id, { ver, aabb });
  return aabb;
}

function _collectSnapGeometry(shapes, scale, excludeIds, onPoint, onSegment) {
  const rtp = (v) => realToPaperDist(v, scale);

  function makeXf(s, ancestors) {
    const needsXf =
      typeof applyWorldTransformReal === "function" &&
      typeof hasVisualTransform === "function" &&
      (hasVisualTransform(s) || ancestors.some(hasVisualTransform));
    if (!needsXf) return (x, y) => [rtp(x), rtp(y)];
    return (x, y) => {
      const [wx, wy] = applyWorldTransformReal(x, y, s, ancestors);
      return [rtp(wx), rtp(wy)];
    };
  }

  function collect(s, ancestors) {
    if (excludeIds && excludeIds.has(s.id)) return;
    if (s.type === "group") {
      // グループはスナップ上「1 つの塊」として扱い、内部の全頂点を展開しない。
      // 子が多い/複雑なグループでも毎フレームのスナップ計算を bbox（9 点 + 4 辺）
      // に抑え、「グループが在るだけで全体がもっさり」を防ぐ。
      if (excludeIds && excludeIds.has(s.id)) return;
      const aabb = _groupSnapAABB(s, ancestors);
      if (!aabb) return;
      const x1 = rtp(aabb.minX),
        y1 = rtp(aabb.minY),
        x2 = rtp(aabb.maxX),
        y2 = rtp(aabb.maxY);
      const cx = (x1 + x2) / 2,
        cy = (y1 + y2) / 2;
      onPoint(x1, y1, "endpoint", 1);
      onPoint(x2, y1, "endpoint", 1);
      onPoint(x1, y2, "endpoint", 1);
      onPoint(x2, y2, "endpoint", 1);
      onPoint(cx, y1, "midpoint", 3);
      onPoint(cx, y2, "midpoint", 3);
      onPoint(x1, cy, "midpoint", 3);
      onPoint(x2, cy, "midpoint", 3);
      onPoint(cx, cy, "center", 4);
      onSegment({ x1, y1, x2, y2: y1 });
      onSegment({ x1: x2, y1, x2, y2 });
      onSegment({ x1, y1: y2, x2, y2 });
      onSegment({ x1, y1, x2: x1, y2 });
      return;
    }
    const xf = makeXf(s, ancestors);
    const addPt = (x, y, snapType, priority) => {
      const [px, py] = xf(x, y);
      onPoint(px, py, snapType, priority);
    };
    const seg = (ax, ay, bx, by) => {
      const [x1, y1] = xf(ax, ay);
      const [x2, y2] = xf(bx, by);
      onSegment({ x1, y1, x2, y2 });
    };

    if (s.type === "line") {
      addPt(s.x1, s.y1, "endpoint", 1);
      addPt(s.x2, s.y2, "endpoint", 1);
      addPt((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, "midpoint", 3);
      seg(s.x1, s.y1, s.x2, s.y2);
    } else if (s.type === "rect") {
      const x = s.x,
        y = s.y,
        w = s.width,
        h = s.height;
      // 4コーナー
      addPt(x, y, "endpoint", 1);
      addPt(x + w, y, "endpoint", 1);
      addPt(x, y + h, "endpoint", 1);
      addPt(x + w, y + h, "endpoint", 1);
      // 辺の中点
      addPt(x + w / 2, y, "midpoint", 3);
      addPt(x + w / 2, y + h, "midpoint", 3);
      addPt(x, y + h / 2, "midpoint", 3);
      addPt(x + w, y + h / 2, "midpoint", 3);
      // 中心
      addPt(x + w / 2, y + h / 2, "center", 4);
      // 辺をセグメントとして登録（交点・垂線用）
      seg(x, y, x + w, y);
      seg(x + w, y, x + w, y + h);
      seg(x + w, y + h, x, y + h);
      seg(x, y + h, x, y);
    } else if (s.type === "circle") {
      addPt(s.cx, s.cy, "center", 4);
      addPt(s.cx + s.r, s.cy, "endpoint", 1);
      addPt(s.cx - s.r, s.cy, "endpoint", 1);
      addPt(s.cx, s.cy + s.r, "endpoint", 1);
      addPt(s.cx, s.cy - s.r, "endpoint", 1);
    } else if (s.type === "ellipse") {
      addPt(s.cx, s.cy, "center", 4);
      addPt(s.cx + s.rx, s.cy, "endpoint", 1);
      addPt(s.cx - s.rx, s.cy, "endpoint", 1);
      addPt(s.cx, s.cy + s.ry, "endpoint", 1);
      addPt(s.cx, s.cy - s.ry, "endpoint", 1);
    } else if (s.type === "bezier" && s.nodes) {
      for (const node of s.nodes) {
        addPt(node.x, node.y, "endpoint", 1);
      }
      // open bezier の辺もセグメント化（直線近似）
      for (let i = 0; i < s.nodes.length - 1; i++) {
        seg(s.nodes[i].x, s.nodes[i].y, s.nodes[i + 1].x, s.nodes[i + 1].y);
      }
      if (s.closed && s.nodes.length > 1) {
        const last = s.nodes[s.nodes.length - 1];
        const first = s.nodes[0];
        seg(last.x, last.y, first.x, first.y);
      }
    } else if (s.type === "path" && s.contours) {
      // path の各リングの頂点
      for (const contour of s.contours) {
        for (const ring of contour) {
          for (let i = 0; i < ring.length; i++) {
            addPt(ring[i][0], ring[i][1], "endpoint", 1);
            if (i > 0) {
              seg(ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]);
            }
          }
        }
      }
    }
  }

  for (const s of shapes) collect(s, []);
}

// スナップ候補（キーポイント＋線分）をドキュメント版数でキャッシュする。
// hover / transform-only ドラッグ中は図面が変わらないため毎フレーム再構築せず
// 再利用でき、複雑な path を含む図面でもマウス移動が O(候補数) のフィルタだけで済む。
let _snapGeomCache = null;
function _snapGeometryFor(shapes, scale, excludeIds) {
  const build = () => {
    const points = [];
    const segments = [];
    _collectSnapGeometry(
      shapes,
      scale,
      excludeIds || null,
      (x, y, snapType, priority) => points.push({ x, y, snapType, priority }),
      (seg) => segments.push(seg),
    );
    return { points, segments };
  };
  const ver =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : -1;
  const pageId =
    typeof getCurrentPage === "function" ? getCurrentPage()?.id : "";
  const sc = scale ? `${scale.numerator}/${scale.denominator}` : "1/1";
  const excludeKey =
    excludeIds && excludeIds.size ? [...excludeIds].sort().join(",") : "";
  const key = `${ver}|${pageId}|${sc}|${excludeKey}`;
  if (_snapGeomCache && _snapGeomCache.key === key) return _snapGeomCache;
  const g = build();
  _snapGeomCache = { key, points: g.points, segments: g.segments };
  return _snapGeomCache;
}

// 近傍線分が多すぎると交点・垂線が O(n²) に膨らむため上限を設ける。
const _NEAR_SEG_CAP = 48;

// ── snapToShapes: オブジェクトスナップ ────────────────────────
// 戻り値: { x, y, snapType } | null
// snapType: "endpoint" | "midpoint" | "center" | "intersection" | "perpendicular" | "guide"
//
// 優先順位（同距離の場合は上が優先）:
//   1. endpoint    — 線・矩形の頂点、bezier ノード
//   2. intersection— 線分同士の交点 / ガイド×ガイド / ガイド×図形辺
//   3. midpoint    — 線・辺の中点
//   4. center      — circle/rect の中心
//   5. perpendicular — カーソルから線分への垂線足
//   6. guide       — ビューガイド線上（カーソルの直交射影）
//
// guides: ビューガイド（見通し線）の paper 座標。{ v: [x...], h: [y...] } | null
// opts.excludeIds: Set<shapeId> — ドラッグ中の図形を候補から除外（自己スナップ防止）
function snapToShapes(
  pt,
  shapes,
  scale,
  threshold = 2,
  guides = null,
  opts = {},
) {
  // 候補リスト: [{ x, y, snapType, priority }]
  const candidates = [];

  function add(x, y, snapType, priority) {
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < threshold) candidates.push({ x, y, snapType, priority, d });
  }

  // ── 各 shape からキーポイントを収集（hover はキャッシュ）─────────
  const geom = _snapGeometryFor(shapes, scale, opts.excludeIds || null);
  for (const p of geom.points) add(p.x, p.y, p.snapType, p.priority);
  const segments = geom.segments; // [{ x1,y1,x2,y2 }] (paper座標)

  // 交点・垂線・ガイド交点の候補はすべてセグメント上の点であり、add() は
  // threshold 以内しか採用しない。pt から threshold より遠いセグメントは
  // 候補を生めないため先に除外する。ブーリアン演算後の多頂点 path で
  // 交点総当たりが O(S²) に爆発するのを防ぐ
  let nearSegments = segments.filter(
    (seg) => _pointSegmentDist(pt, seg) < threshold,
  );
  // 近傍線分が密集していると交点計算が O(n²) になるため上限で打ち切る
  if (nearSegments.length > _NEAR_SEG_CAP) {
    nearSegments = nearSegments.slice(0, _NEAR_SEG_CAP);
  }

  // ── 交点スナップ ─────────────────────────────────────────────
  // pt 近傍セグメントペアの交点を計算
  for (let i = 0; i < nearSegments.length; i++) {
    for (let j = i + 1; j < nearSegments.length; j++) {
      const ix = _segmentIntersection(nearSegments[i], nearSegments[j]);
      if (ix) add(ix.x, ix.y, "intersection", 2);
    }
  }

  // ── 垂線足スナップ ───────────────────────────────────────────
  for (const seg of nearSegments) {
    const foot = _perpendicularFoot(pt, seg);
    if (foot) add(foot.x, foot.y, "perpendicular", 5);
  }

  // ── ビューガイド（見通し線）スナップ ─────────────────────────
  // ガイドはページ全幅/全高の無限直線として扱う
  if (guides) {
    const GUIDE_EXT = 1e7;
    const vSegs = (guides.v || []).map((gx) => ({
      x1: gx,
      y1: -GUIDE_EXT,
      x2: gx,
      y2: GUIDE_EXT,
    }));
    const hSegs = (guides.h || []).map((gy) => ({
      x1: -GUIDE_EXT,
      y1: gy,
      x2: GUIDE_EXT,
      y2: gy,
    }));
    for (const gseg of [...vSegs, ...hSegs]) {
      // ガイド × 図形辺の交点（交点は図形辺上の点なので nearSegments で十分）
      for (const seg of nearSegments) {
        const ix = _segmentIntersection(gseg, seg);
        if (ix) add(ix.x, ix.y, "guide", 2);
      }
    }
    // ガイド × ガイドの交点
    for (const vs of vSegs) {
      for (const hs of hSegs) add(vs.x1, hs.y1, "guide", 2);
    }
    // ガイド線上への直交射影（最弱: 軸方向だけ拘束）
    for (const vs of vSegs) add(vs.x1, pt.y, "guide", 6);
    for (const hs of hSegs) add(pt.x, hs.y1, "guide", 6);
  }

  if (candidates.length === 0) return null;

  // 優先度優先、同優先度なら距離最小
  candidates.sort((a, b) => a.priority - b.priority || a.d - b.d);
  const { x, y, snapType } = candidates[0];
  return { x, y, snapType };
}

// ── 点から線分への最短距離（端点へのクランプあり） ────────────
function _pointSegmentDist(pt, seg) {
  const dx = seg.x2 - seg.x1,
    dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  let t =
    len2 < 1e-10 ? 0 : ((pt.x - seg.x1) * dx + (pt.y - seg.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pt.x - (seg.x1 + t * dx), pt.y - (seg.y1 + t * dy));
}

// ── snapDragPoints: ドラッグ中図形のキーポイントスナップ ──────
// dragPoints（paper 座標 [{x,y}]）のいずれかを targetShapes のスナップ点
// （endpoint/midpoint/center/intersection）へ吸着させる補正量を返す。
// 優先順位は snapToShapes と同じ（endpoint > intersection > midpoint > center）。
// 戻り値: { dx, dy, x, y, snapType } | null（paper 座標。x,y は吸着先）
function snapDragPoints(dragPoints, targetShapes, scale, threshold, opts = {}) {
  if (!dragPoints.length) return null;
  const geom = _snapGeometryFor(targetShapes, scale, opts.excludeIds || null);
  const targetPts = geom.points.slice();
  const segments = geom.segments;

  // 交点候補: いずれかの dragPoint の threshold 近傍にあるセグメントのみ対象
  // （snapToShapes と同様の O(S²) 爆発対策）
  let nearSegments = segments.filter((seg) =>
    dragPoints.some((dp) => _pointSegmentDist(dp, seg) < threshold),
  );
  if (nearSegments.length > _NEAR_SEG_CAP) {
    nearSegments = nearSegments.slice(0, _NEAR_SEG_CAP);
  }
  for (let i = 0; i < nearSegments.length; i++) {
    for (let j = i + 1; j < nearSegments.length; j++) {
      const ix = _segmentIntersection(nearSegments[i], nearSegments[j]);
      if (ix)
        targetPts.push({
          x: ix.x,
          y: ix.y,
          snapType: "intersection",
          priority: 2,
        });
    }
  }

  let best = null;
  for (const dp of dragPoints) {
    for (const tp of targetPts) {
      const d = Math.hypot(tp.x - dp.x, tp.y - dp.y);
      if (d >= threshold) continue;
      if (
        !best ||
        tp.priority < best.priority ||
        (tp.priority === best.priority && d < best.d)
      ) {
        best = {
          d,
          priority: tp.priority,
          dx: tp.x - dp.x,
          dy: tp.y - dp.y,
          x: tp.x,
          y: tp.y,
          snapType: tp.snapType,
        };
      }
    }
  }
  if (!best) return null;
  return {
    dx: best.dx,
    dy: best.dy,
    x: best.x,
    y: best.y,
    snapType: best.snapType,
  };
}

// 図形群のスナップキーポイントを paper 座標で列挙（ドラッグ側の基準点用）
function collectSnapPoints(shapes, scale) {
  const pts = [];
  _collectSnapGeometry(
    shapes,
    scale,
    null,
    (x, y, snapType, priority) => pts.push({ x, y, snapType, priority }),
    () => {},
  );
  return pts;
}

// ── 線分の交点計算（有限線分） ────────────────────────────────
function _segmentIntersection(s1, s2) {
  const dx1 = s1.x2 - s1.x1,
    dy1 = s1.y2 - s1.y1;
  const dx2 = s2.x2 - s2.x1,
    dy2 = s2.y2 - s2.y1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null; // 平行
  const t = ((s2.x1 - s1.x1) * dy2 - (s2.y1 - s1.y1) * dx2) / denom;
  const u = ((s2.x1 - s1.x1) * dy1 - (s2.y1 - s1.y1) * dx1) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: s1.x1 + t * dx1, y: s1.y1 + t * dy1 };
  }
  return null;
}

// ── 点から線分への垂線足（線分内にある場合のみ） ──────────────
function _perpendicularFoot(pt, seg) {
  const dx = seg.x2 - seg.x1,
    dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return null;
  const t = ((pt.x - seg.x1) * dx + (pt.y - seg.y1) * dy) / len2;
  if (t <= 0 || t >= 1) return null; // 端点は endpoint で拾う
  return { x: seg.x1 + t * dx, y: seg.y1 + t * dy };
}
