"use strict";

// ── Shape visual transform (rotation / flip) ───────────────────
//
// rotation / flipH / flipV は座標値を変えず SVG transform でも描画するが、
// 幾何計算（bbox / Profile / 3D）ではここで同じ順序（回転 → 反転）を適用する。
// SVG renderer.js の pivot（未変換 bbox 中心）と一致させる。

const _UNIT_SCALE = { numerator: 1, denominator: 1 };
const _shapePivotRealCache = new Map();
let _shapePivotRealCacheDocVersion = -1;

function aabbFromPoints(points) {
  if (!points.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getShapePivotReal(shape) {
  const docv =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : -1;
  if (docv !== _shapePivotRealCacheDocVersion) {
    _shapePivotRealCache.clear();
    _shapePivotRealCacheDocVersion = docv;
  }
  const tlv =
    shape?.type === "text" && typeof textLayoutCacheVersion === "function"
      ? textLayoutCacheVersion()
      : 0;
  const rv =
    shape?.id && typeof getShapeRenderVersion === "function"
      ? getShapeRenderVersion(shape.id)
      : 0;
  const cacheKey =
    shape?.id && shape.type === "group" ? `${shape.id}|${rv}|${tlv}` : null;
  if (cacheKey) {
    const hit = _shapePivotRealCache.get(cacheKey);
    if (hit) return hit;
  }
  let pivot;
  if (shape && shape.type === "group") {
    // renderer.js の getGroupLocalPivotPaper と同じ規約:
    // 子それぞれの変換（子自身の rotation/flip）を適用した点群の AABB 中心
    const pts = [];
    for (const child of shape.children || []) {
      pts.push(...collectWorldPointsReal(child, []));
    }
    const bb = aabbFromPoints(pts);
    pivot = bb ? { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 } : { x: 0, y: 0 };
  } else {
    const sample = sampleShapePointsReal(shape);
    if (!sample.length) {
      pivot = { x: 0, y: 0 };
    } else {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of sample) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
  }
  if (cacheKey) _shapePivotRealCache.set(cacheKey, pivot);
  return pivot;
}

function hasVisualTransform(shape) {
  return Boolean(
    shape &&
    ((shape.rotation && shape.rotation % 360 !== 0) ||
      shape.flipH ||
      shape.flipV),
  );
}

function applyVisualTransformReal(
  x,
  y,
  rotation,
  flipH,
  flipV,
  pivotX,
  pivotY,
) {
  let px = x;
  let py = y;
  const deg = rotation || 0;
  if (deg % 360 !== 0) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - pivotX;
    const dy = py - pivotY;
    px = pivotX + dx * cos - dy * sin;
    py = pivotY + dx * sin + dy * cos;
  }
  if (flipH) px = pivotX - (px - pivotX);
  if (flipV) py = pivotY - (py - pivotY);
  return [px, py];
}

function applyShapeTransformReal(x, y, shape) {
  const pivot = getShapePivotReal(shape);
  return applyVisualTransformReal(
    x,
    y,
    shape.rotation,
    shape.flipH,
    shape.flipV,
    pivot.x,
    pivot.y,
  );
}

function applyWorldTransformReal(x, y, shape, ancestorGroups = []) {
  let pt = applyShapeTransformReal(x, y, shape);
  for (let i = ancestorGroups.length - 1; i >= 0; i--) {
    pt = applyShapeTransformReal(pt[0], pt[1], ancestorGroups[i]);
  }
  return pt;
}

function sampleShapePointsReal(shape) {
  if (!shape) return [];
  switch (shape.type) {
    case "line":
      return [
        [shape.x1, shape.y1],
        [shape.x2, shape.y2],
      ];
    case "rect":
    case "image":
      return [
        [shape.x, shape.y],
        [shape.x + shape.width, shape.y],
        [shape.x + shape.width, shape.y + shape.height],
        [shape.x, shape.y + shape.height],
      ];
    case "circle": {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = (2 * Math.PI * i) / 16;
        pts.push([
          shape.cx + shape.r * Math.cos(a),
          shape.cy + shape.r * Math.sin(a),
        ]);
      }
      return pts;
    }
    case "text": {
      const scale =
        typeof getCurrentPage === "function"
          ? getCurrentPage()?.scale || _UNIT_SCALE
          : _UNIT_SCALE;
      if (typeof getTextLayoutBoxPaper === "function") {
        const bb = getTextLayoutBoxPaper(shape, scale);
        const toReal = (px, py) => [
          paperToRealDist(px, scale),
          paperToRealDist(py, scale),
        ];
        const [x1, y1] = toReal(bb.x, bb.y);
        const [x2, y2] = toReal(bb.x + bb.w, bb.y + bb.h);
        return [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
        ];
      }
      const fs = shape.fontSize ?? 3.5;
      const lineCount = Math.max(1, (shape.text || "").split("\n").length);
      const h =
        typeof measureTextHeight === "function"
          ? measureTextHeight(shape)
          : fs * lineCount;
      const w =
        typeof measureTextWidth === "function"
          ? measureTextWidth(shape, scale)
          : Math.max(
              10,
              (shape.text || "").length * (shape.fontSize ?? 3.5) * 0.6,
            );
      const wReal = paperToRealDist(w, scale);
      const hReal = paperToRealDist(h, scale);
      return [
        [shape.x, shape.y],
        [shape.x + wReal, shape.y],
        [shape.x + wReal, shape.y + hReal],
        [shape.x, shape.y + hReal],
      ];
    }
    case "bezier": {
      const pts = [];
      for (const n of shape.nodes || []) {
        pts.push([n.x, n.y]);
        if (n.h1) pts.push([n.h1.x, n.h1.y]);
        if (n.h2) pts.push([n.h2.x, n.h2.y]);
      }
      return pts;
    }
    case "path": {
      const pts = [];
      for (const polygon of shape.contours || []) {
        for (const ring of polygon) {
          for (const [x, y] of ring) pts.push([x, y]);
        }
      }
      return pts;
    }
    case "pencil":
      return (shape.points || []).map((pt) => [pt.x, pt.y]);
    case "dimension":
      return [
        [shape.from.x, shape.from.y],
        [shape.to.x, shape.to.y],
      ];
    default:
      return [];
  }
}

function transformRingsReal(rings, shape, ancestorGroups = []) {
  return rings.map((ring) =>
    ring.map(([x, y]) => applyWorldTransformReal(x, y, shape, ancestorGroups)),
  );
}

function collectWorldPointsReal(shape, ancestorGroups = []) {
  if (shape.type === "group") {
    const stack = [...ancestorGroups, shape];
    const pts = [];
    for (const child of shape.children || []) {
      pts.push(...collectWorldPointsReal(child, stack));
    }
    return pts;
  }
  return sampleShapePointsReal(shape).map(([x, y]) =>
    applyWorldTransformReal(x, y, shape, ancestorGroups),
  );
}

function* iterProfileSourcesFromPage(page) {
  function* walk(shapes, ancestors) {
    for (const shape of shapes) {
      if (shape.ghost) continue;
      if (shape.type === "group" && Array.isArray(shape.children)) {
        yield* walk(shape.children, [...ancestors, shape]);
        continue;
      }
      yield { shape, ancestorGroups: ancestors };
    }
  }
  for (const layer of page.layers) {
    if (!layer.visible || layer.locked) continue;
    yield* walk(layer.shapes, []);
  }
}
