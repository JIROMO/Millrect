"use strict";

/**
 * ドキュメント用 — 120×80×50 mm 穴付きパネル（上面 + 正面 + 右側面）
 * A4 横・1:2 スケール（ドキュメント用。図面上で見やすいサイズ）
 */
const DOC_DOCS_SCALE = { numerator: 1, denominator: 2 };

const DOC_REAL_PER_MM = 10;
const A4_LANDSCAPE_MM = { width: 297, height: 210 };

const DOC_DOCS_MM = { width: 120, depth: 80, height: 50 };

const DOC_DOCS_BOX = {
  topShapeId: "doc-top-rect",
  frontShapeId: "doc-front-rect",
  sideShapeId: "doc-side-rect",
  projectName: "穴付きパネル",
  features: {
    cornerRadiusMm: 0,
    holeRadiusMm: 4,
    holeInsetXMm: 20,
    holeInsetYMm: 20,
  },
  // 3D の高さは直交ビューの「同じ fill 色」の輪郭から決まるため、
  // 全ビューで同じ塗り色を使う（色を変えると全高近似 + 警告になる）
  top: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
  front: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
  side: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
};

/** 上面図 — 矩形を用紙中央に配置（real units） */
function docBoxTopLayout(mm = DOC_DOCS_MM, scale = DOC_DOCS_SCALE) {
  const w = mm.width * DOC_REAL_PER_MM;
  const d = mm.depth * DOC_REAL_PER_MM;
  const wPaper = mm.width * (scale.numerator / scale.denominator);
  const hPaper = mm.depth * (scale.numerator / scale.denominator);
  const xPaper = (A4_LANDSCAPE_MM.width - wPaper) / 2;
  const yPaper = (A4_LANDSCAPE_MM.height - hPaper) / 2;
  const ox = xPaper * DOC_REAL_PER_MM * (scale.denominator / scale.numerator);
  const oy = yPaper * DOC_REAL_PER_MM * (scale.denominator / scale.numerator);
  return {
    w,
    d,
    ox,
    oy,
    outer: [
      [ox, oy],
      [ox + w, oy],
      [ox + w, oy + d],
      [ox, oy + d],
    ],
  };
}

function docRoundedRectRing(x, y, w, h, r, segments = 8) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!radius) {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  const pts = [];
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= segments; i++) {
      const a = a0 + ((a1 - a0) * i) / segments;
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  };
  arc(x + radius, y + radius, Math.PI, Math.PI * 1.5);
  arc(x + w - radius, y + radius, Math.PI * 1.5, Math.PI * 2);
  arc(x + w - radius, y + h - radius, 0, Math.PI * 0.5);
  arc(x + radius, y + h - radius, Math.PI * 0.5, Math.PI);
  return pts;
}

function docCircleRing(cx, cy, r, segments = 48) {
  return Array.from({ length: segments }, (_, i) => {
    const a = (2 * Math.PI * i) / segments;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function docBoxTopFeatureLayout(mm = DOC_DOCS_MM, scale = DOC_DOCS_SCALE) {
  const layout = docBoxTopLayout(mm, scale);
  const f = DOC_DOCS_BOX.features;
  const rpm = DOC_REAL_PER_MM;
  const hx = f.holeInsetXMm * rpm;
  const hy = f.holeInsetYMm * rpm;
  const r = f.holeRadiusMm * rpm;
  const cornerR = f.cornerRadiusMm * rpm;
  const holes = [
    { id: "tl", cx: layout.ox + hx, cy: layout.oy + hy, r },
    { id: "tr", cx: layout.ox + layout.w - hx, cy: layout.oy + hy, r },
    {
      id: "br",
      cx: layout.ox + layout.w - hx,
      cy: layout.oy + layout.d - hy,
      r,
    },
    { id: "bl", cx: layout.ox + hx, cy: layout.oy + layout.d - hy, r },
  ];
  return { ...layout, cornerR, holes };
}

function docBoxTopRings(mm = DOC_DOCS_MM, scale = DOC_DOCS_SCALE) {
  const layout = docBoxTopFeatureLayout(mm, scale);
  const outer = docRoundedRectRing(
    layout.ox,
    layout.oy,
    layout.w,
    layout.d,
    layout.cornerR,
  );
  const holes = layout.holes.map((h) =>
    docCircleRing(h.cx, h.cy, h.r).reverse(),
  );
  return { layout, rings: [outer, ...holes] };
}

function docBoxTopPathShape(id, style = DOC_DOCS_BOX.top) {
  const { rings } = docBoxTopRings();
  return {
    id,
    type: "path",
    contours: [rings],
    stroke: style.stroke,
    fill: style.fill,
    strokeWidth: "medium",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DOC_DOCS_SCALE,
    DOC_DOCS_MM,
    DOC_DOCS_BOX,
    docBoxTopLayout,
    docBoxTopFeatureLayout,
    docBoxTopRings,
    docBoxTopPathShape,
  };
}

if (typeof window !== "undefined") {
  window.DOC_DOCS_SCALE = DOC_DOCS_SCALE;
  window.DOC_DOCS_MM = DOC_DOCS_MM;
  window.DOC_DOCS_BOX = DOC_DOCS_BOX;
  window.docBoxTopLayout = docBoxTopLayout;
  window.docBoxTopFeatureLayout = docBoxTopFeatureLayout;
  window.docBoxTopRings = docBoxTopRings;
  window.docBoxTopPathShape = docBoxTopPathShape;
}
