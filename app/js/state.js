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

const LINE_WIDTHS = { thin: 0.2, medium: 0.5, thick: 1.0 };

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

function deepClone(o) {
  return typeof structuredClone === "function"
    ? structuredClone(o)
    : JSON.parse(JSON.stringify(o));
}

function initState() {
  _state = defaultState();
  _history = [JSON.stringify(_snapshotDoc())]; // _state が確定した後に呼ぶ
  _historyLabels = ["初期状態"];
  _histIdx = 0;
  return _state;
}

function getState() {
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
  "projectBrief",
];

function _snapshotDoc() {
  return deepClone(Object.fromEntries(DOC_KEYS.map((k) => [k, _state[k]])));
}
function _restoreDoc(snapOrStr) {
  const snap =
    typeof snapOrStr === "string" ? JSON.parse(snapOrStr) : snapOrStr;
  for (const k of DOC_KEYS) _state[k] = deepClone(snap[k]);
}

// _historyLabels: 各 history エントリの説明ラベル
let _historyLabels = ["初期状態"];

function pushHistory(label) {
  const snap = _snapshotDoc();
  // 直前のスナップショットと同一なら何もしない（触っただけで履歴が増えるのを防ぐ）
  const snapStr = JSON.stringify(snap);
  if (_histIdx >= 0 && _history[_histIdx] === snapStr) return;
  _history = _history.slice(0, _histIdx + 1);
  _historyLabels = _historyLabels.slice(0, _histIdx + 1);
  _history.push(snapStr);
  _historyLabels.push(label || _inferHistoryLabel());
  if (_history.length > MAX_HISTORY) {
    _history.shift();
    _historyLabels.shift();
  }
  _histIdx = _history.length - 1;
  if (typeof onStateChanged === "function") onStateChanged();
}

// 直前の操作からラベルを自動推定
function _inferHistoryLabel() {
  // state のページ・シェイプ数の変化で大まかに推定
  if (!_history.length) return "操作";
  const prev = JSON.parse(_history[_histIdx]);
  const cur = _snapshotDoc();
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
  _histIdx = idx;
  _restoreDoc(_history[_histIdx]);
  if (typeof onStateChanged === "function") onStateChanged();
  return true;
}

function undo() {
  if (_histIdx > 0) {
    _histIdx--;
    _restoreDoc(_history[_histIdx]);
    if (typeof onStateChanged === "function") onStateChanged();
    return true;
  }
  return false;
}
function redo() {
  if (_histIdx < _history.length - 1) {
    _histIdx++;
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
  _history = [JSON.stringify(_snapshotDoc())]; // ドキュメント部分のみ保存
  _historyLabels = ["読み込み"];
  _histIdx = 0;
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
    projectBrief: null,
    currentPageId: "page-1",
    currentLayerId: "layer-1",
    selectedShapeIds: [],
    activeTool: "select",
    appMode: "2d", // "2d" | "3d"（UI 専用・Undo/export 非対象。DOC_KEYS に含めない）
    zoom: 2.0,
    panX: 40,
    panY: 40,
    showGrid: true,
    gridSize: 1,
    snapEnabled: true,
    drawFill: "none",
    drawStroke: "#1a1a2e",
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

// ── snapToShapes: オブジェクトスナップ ────────────────────────
// 戻り値: { x, y, snapType } | null
// snapType: "endpoint" | "midpoint" | "center" | "intersection" | "perpendicular"
//
// 優先順位（同距離の場合は上が優先）:
//   1. endpoint    — 線・矩形の頂点、bezier ノード
//   2. intersection— 線分同士の交点
//   3. midpoint    — 線・辺の中点
//   4. center      — circle/rect の中心
//   5. perpendicular — カーソルから線分への垂線足
//
function snapToShapes(pt, shapes, scale, threshold = 2) {
  const rtp = (v) => realToPaperDist(v, scale);

  // 候補リスト: [{ x, y, snapType, priority }]
  const candidates = [];

  function add(x, y, snapType, priority) {
    const d = Math.hypot(pt.x - x, pt.y - y);
    if (d < threshold) candidates.push({ x, y, snapType, priority, d });
  }

  // ── 各 shape からキーポイントを収集 ──────────────────────────

  // line セグメントリスト（交点・垂線計算用）
  const segments = []; // [{ x1,y1,x2,y2 }] (paper座標)

  for (const s of shapes) {
    if (s.type === "line") {
      const x1 = rtp(s.x1),
        y1 = rtp(s.y1),
        x2 = rtp(s.x2),
        y2 = rtp(s.y2);
      add(x1, y1, "endpoint", 1);
      add(x2, y2, "endpoint", 1);
      add((x1 + x2) / 2, (y1 + y2) / 2, "midpoint", 3);
      segments.push({ x1, y1, x2, y2 });
    } else if (s.type === "rect") {
      const x = rtp(s.x),
        y = rtp(s.y),
        w = rtp(s.width),
        h = rtp(s.height);
      // 4コーナー
      add(x, y, "endpoint", 1);
      add(x + w, y, "endpoint", 1);
      add(x, y + h, "endpoint", 1);
      add(x + w, y + h, "endpoint", 1);
      // 辺の中点
      add(x + w / 2, y, "midpoint", 3);
      add(x + w / 2, y + h, "midpoint", 3);
      add(x, y + h / 2, "midpoint", 3);
      add(x + w, y + h / 2, "midpoint", 3);
      // 中心
      add(x + w / 2, y + h / 2, "center", 4);
      // 辺をセグメントとして登録（交点・垂線用）
      segments.push({ x1: x, y1: y, x2: x + w, y2: y });
      segments.push({ x1: x + w, y1: y, x2: x + w, y2: y + h });
      segments.push({ x1: x + w, y1: y + h, x2: x, y2: y + h });
      segments.push({ x1: x, y1: y + h, x2: x, y2: y });
    } else if (s.type === "circle") {
      const cx = rtp(s.cx),
        cy = rtp(s.cy),
        rr = rtp(s.r);
      add(cx, cy, "center", 4);
      add(cx + rr, cy, "endpoint", 1);
      add(cx - rr, cy, "endpoint", 1);
      add(cx, cy + rr, "endpoint", 1);
      add(cx, cy - rr, "endpoint", 1);
    } else if (s.type === "ellipse") {
      const cx = rtp(s.cx),
        cy = rtp(s.cy),
        rx = rtp(s.rx),
        ry = rtp(s.ry);
      add(cx, cy, "center", 4);
      add(cx + rx, cy, "endpoint", 1);
      add(cx - rx, cy, "endpoint", 1);
      add(cx, cy + ry, "endpoint", 1);
      add(cx, cy - ry, "endpoint", 1);
    } else if (s.type === "bezier" && s.nodes) {
      for (const node of s.nodes) {
        add(rtp(node.x), rtp(node.y), "endpoint", 1);
      }
      // open bezier の辺もセグメント化（直線近似）
      for (let i = 0; i < s.nodes.length - 1; i++) {
        segments.push({
          x1: rtp(s.nodes[i].x),
          y1: rtp(s.nodes[i].y),
          x2: rtp(s.nodes[i + 1].x),
          y2: rtp(s.nodes[i + 1].y),
        });
      }
      if (s.closed && s.nodes.length > 1) {
        const last = s.nodes[s.nodes.length - 1];
        const first = s.nodes[0];
        segments.push({
          x1: rtp(last.x),
          y1: rtp(last.y),
          x2: rtp(first.x),
          y2: rtp(first.y),
        });
      }
    } else if (s.type === "path" && s.contours) {
      // path の各リングの頂点
      for (const contour of s.contours) {
        for (const ring of contour) {
          for (let i = 0; i < ring.length; i++) {
            const px = rtp(ring[i][0]);
            const py = rtp(ring[i][1]);
            add(px, py, "endpoint", 1);
            if (i > 0) {
              segments.push({
                x1: rtp(ring[i - 1][0]),
                y1: rtp(ring[i - 1][1]),
                x2: px,
                y2: py,
              });
            }
          }
        }
      }
    }
  }

  // ── 交点スナップ ─────────────────────────────────────────────
  // 全セグメントペアの交点を計算
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const ix = _segmentIntersection(segments[i], segments[j]);
      if (ix) add(ix.x, ix.y, "intersection", 2);
    }
  }

  // ── 垂線足スナップ ───────────────────────────────────────────
  for (const seg of segments) {
    const foot = _perpendicularFoot(pt, seg);
    if (foot) add(foot.x, foot.y, "perpendicular", 5);
  }

  if (candidates.length === 0) return null;

  // 優先度優先、同優先度なら距離最小
  candidates.sort((a, b) => a.priority - b.priority || a.d - b.d);
  const { x, y, snapType } = candidates[0];
  return { x, y, snapType };
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
