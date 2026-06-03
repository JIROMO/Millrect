"use strict";

/** real units: 1 mm = 10 paper units（state.js の REAL_PER_MM と同値） */
const AGENT_REAL_PER_MM = 10;

/** 用紙中央に mm 指定の矩形を配置（real units で返す） */
function layoutCenteredRectMm(mmW, mmH, paperMm, scale) {
  scale = scale || { numerator: 1, denominator: 1 };
  const width = mmW * AGENT_REAL_PER_MM;
  const height = mmH * AGENT_REAL_PER_MM;
  const wPaper = mmW * (scale.numerator / scale.denominator);
  const hPaper = mmH * (scale.numerator / scale.denominator);
  const xPaper = (paperMm.width - wPaper) / 2;
  const yPaper = (paperMm.height - hPaper) / 2;
  const x = xPaper * AGENT_REAL_PER_MM * (scale.denominator / scale.numerator);
  const y = yPaper * AGENT_REAL_PER_MM * (scale.denominator / scale.numerator);
  return { x, y, width, height };
}

/** 直方体の各ビューに対応する mm 寸法 */
function boxViewSizesMm(sizeMm) {
  const w = sizeMm.width;
  const d = sizeMm.depth;
  const h = sizeMm.height;
  return {
    top: { w, h: d },
    bottom: { w, h: d },
    front: { w, h },
    back: { w, h },
    right: { w: d, h },
    left: { w: d, h },
  };
}

const VIEW_AXIS = {
  top: "y",
  bottom: "y",
  front: "z",
  back: "z",
  right: "x",
  left: "x",
  section: "y",
  detail: "y",
};

function normalizeViewType(type) {
  if (type === "section" || type === "detail") return "top";
  return type ?? null;
}

/**
 * 3D 生成準備状況を分析（ページ要約の配列を受け取る純関数）
 * @param {{ pageId, name, viewType, profileCount }[]} pageSummaries
 */
function analyzeMultiviewReadiness(pageSummaries) {
  const axes = new Set();
  const issues = [];
  let pagesWithView = 0;
  let pagesWithProfiles = 0;

  for (const p of pageSummaries) {
    const norm = normalizeViewType(p.viewType);
    if (!norm) {
      issues.push({
        code: "MISSING_VIEW_TYPE",
        pageId: p.pageId,
        name: p.name,
        message: `ページ「${p.name}」に viewDefinition.type がありません`,
      });
      continue;
    }
    pagesWithView++;
    const axis = VIEW_AXIS[p.viewType] || VIEW_AXIS[norm];
    if (axis) axes.add(axis);
    if (p.profileCount > 0) {
      pagesWithProfiles++;
    } else {
      issues.push({
        code: "NO_CLOSED_CONTOURS",
        pageId: p.pageId,
        name: p.name,
        viewType: p.viewType,
        message: `ページ「${p.name}」(${p.viewType}) に 3D 用の閉じた輪郭がありません`,
      });
    }
  }

  if (axes.size < 2) {
    issues.unshift({
      code: "NEED_TWO_AXES",
      axisCount: axes.size,
      message:
        "3D 生成には直交する 2 軸以上のビューが必要です（例: 上面 top + 正面 front）",
    });
  }

  return {
    ok: issues.length === 0,
    ready: axes.size >= 2 && pagesWithProfiles >= 2,
    axisCount: axes.size,
    pagesWithView,
    pagesWithProfiles,
    issues,
  };
}

/** 矩形 shape から外周 ring */
function rectRingFromShape(rect) {
  const { x, y, width, height } = rect;
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

function mmToAgentReal(mm) {
  return mm * AGENT_REAL_PER_MM;
}

/** 円輪郭 ring（real units） */
function circleRing(cx, cy, r, segments = 128) {
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return ring;
}

/**
 * 矩形内に等ピッチ grid の穴 ring 群を生成
 * @param {{x,y,width,height}} rect — real units
 * @param {{ diameterMm, insetMm, count: [cols, rows] }} opts
 */
function buildHoleGridHoleRings(rect, opts = {}) {
  const diameterMm = opts.diameterMm ?? 3;
  const insetMm = opts.insetMm ?? 5;
  const count = opts.count ?? [2, 2];
  const cols = count[0];
  const rows = count[1];
  const inset = mmToAgentReal(insetMm);
  const r = mmToAgentReal(diameterMm / 2);
  const { x, y, width, height } = rect;
  const ux = x + inset;
  const uy = y + inset;
  const uw = width - 2 * inset;
  const uh = height - 2 * inset;
  const rings = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = cols === 1 ? x + width / 2 : ux + (uw * col) / (cols - 1);
      const cy = rows === 1 ? y + height / 2 : uy + (uh * row) / (rows - 1);
      rings.push(circleRing(cx, cy, r));
    }
  }
  return rings;
}

/** 外周矩形 + 穴 ring から path shape を生成 */
function buildRectWithHolesPathShape(rectShape, holeRings, opts = {}) {
  const outer = rectRingFromShape(rectShape);
  return {
    id: opts.id ?? rectShape.id,
    type: "path",
    contours: [[outer, ...holeRings]],
    stroke: rectShape.stroke,
    fill: rectShape.fill,
    strokeWidth: rectShape.strokeWidth,
  };
}

/** 参照画像の scaleAnchor を適用（from 点を固定して拡大縮小） */
function applyReferenceScaleAnchor(image, from, to, lengthMm) {
  if (!image || !from || !to) {
    return { ok: false, error: "Missing image or anchor points" };
  }
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d < 1e-9) {
    return { ok: false, error: "Zero anchor distance" };
  }
  const factor = mmToAgentReal(lengthMm) / d;
  const relX = (from.x - image.x) / image.width;
  const relY = (from.y - image.y) / image.height;
  const newW = image.width * factor;
  const newH = image.height * factor;
  image.x = from.x - relX * newW;
  image.y = from.y - relY * newH;
  image.width = newW;
  image.height = newH;
  return { ok: true, scaleFactor: factor };
}

/** 矩形の外周寸法線 spec（real units） */
function buildRectDimensionSpecs(rect, opts = {}) {
  const { x, y, width, height } = rect;
  const suffix = opts.suffix ?? " mm";
  const offset = opts.offset ?? 120;
  const textSize = opts.textSize ?? 3;
  return [
    {
      type: "dimension",
      dimensionType: "horizontal",
      from: { x, y },
      to: { x: x + width, y },
      offset: -offset,
      textSize,
      suffix,
    },
    {
      type: "dimension",
      dimensionType: "vertical",
      from: { x: x + width, y },
      to: { x: x + width, y: y + height },
      offset,
      textSize,
      suffix,
    },
  ];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    REAL_PER_MM: AGENT_REAL_PER_MM,
    layoutCenteredRectMm,
    boxViewSizesMm,
    VIEW_AXIS,
    normalizeViewType,
    analyzeMultiviewReadiness,
    buildRectDimensionSpecs,
    rectRingFromShape,
    mmToAgentReal,
    circleRing,
    buildHoleGridHoleRings,
    buildRectWithHolesPathShape,
    applyReferenceScaleAnchor,
  };
}

if (typeof window !== "undefined") {
  window.layoutCenteredRectMm = layoutCenteredRectMm;
  window.boxViewSizesMm = boxViewSizesMm;
  window.analyzeMultiviewReadiness = analyzeMultiviewReadiness;
  window.normalizeViewType = normalizeViewType;
  window.REAL_PER_MM = AGENT_REAL_PER_MM;
  window.buildRectDimensionSpecs = buildRectDimensionSpecs;
  window.buildHoleGridHoleRings = buildHoleGridHoleRings;
  window.buildRectWithHolesPathShape = buildRectWithHolesPathShape;
  window.applyReferenceScaleAnchor = applyReferenceScaleAnchor;
}
