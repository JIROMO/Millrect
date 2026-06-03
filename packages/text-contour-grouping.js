"use strict";

// テキスト glyph 輪郭のリング→compound path 変換（単一ソース）。
// 変更時: native/macos/outline-text/main.swift の groupRingsIntoPolygons も同期すること。
// 検証: npm run verify:contours

function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

function ringCenter(ring) {
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return [x / ring.length, y / ring.length];
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizeRingByDepth(ring, depth) {
  const ccw = ringSignedArea(ring) > 0;
  const wantCcw = depth % 2 === 0;
  return ccw === wantCcw ? ring : ring.slice().reverse();
}

/** リング中心 + 最小包含親でネスト（第一頂点が外周外でも counter を穴にできる） */
function groupRingsIntoPolygons(rings) {
  if (!rings.length) return [];
  if (rings.length === 1) {
    return [[normalizeRingByDepth(rings[0], 0)]];
  }

  const meta = rings.map((ring, index) => ({
    index,
    area: Math.abs(ringSignedArea(ring)),
  }));
  const parent = new Array(rings.length).fill(-1);

  for (let i = 0; i < rings.length; i++) {
    const [cx, cy] = ringCenter(rings[i]);
    let best = -1;
    let bestArea = Infinity;
    for (let j = 0; j < rings.length; j++) {
      if (i === j) continue;
      if (meta[j].area <= meta[i].area) continue;
      if (pointInRing(cx, cy, rings[j])) {
        if (meta[j].area < bestArea) {
          bestArea = meta[j].area;
          best = j;
        }
      }
    }
    parent[i] = best;
  }

  const children = rings.map(() => []);
  for (let i = 0; i < rings.length; i++) {
    if (parent[i] >= 0) children[parent[i]].push(i);
  }

  const collect = (idx, depth, out) => {
    out.push(normalizeRingByDepth(rings[idx], depth));
    for (const child of children[idx]) collect(child, depth + 1, out);
  };

  const polys = [];
  for (let i = 0; i < rings.length; i++) {
    if (parent[i] >= 0) continue;
    const poly = [];
    collect(i, 0, poly);
    polys.push(poly);
  }
  return polys;
}

function countNegativeRings(contours) {
  let count = 0;
  for (const poly of contours || []) {
    for (const ring of poly || []) {
      if (ring?.length > 2 && ringSignedArea(ring) < 0) count++;
    }
  }
  return count;
}

function glyphFillRule(contours) {
  if (countNegativeRings(contours) > 0) return "nonzero";
  const rings = flattenRings(contours);
  if (shouldUnionOverlappingPositiveRings(rings)) return "nonzero";
  return "evenodd";
}

function flattenRings(contours) {
  const rings = [];
  for (const poly of contours || []) {
    for (const ring of poly || []) {
      if (ring?.length > 2) rings.push(ring);
    }
  }
  return rings;
}

/** 正方向リングが重なるだけでネストしていない（例: 「4」の stroke 交差）→ union 対象 */
function shouldUnionOverlappingPositiveRings(rings) {
  if (rings.length <= 1) return false;
  if (rings.some((r) => ringSignedArea(r) < 0)) return false;
  for (let i = 0; i < rings.length; i++) {
    const [cx, cy] = ringCenter(rings[i]);
    for (let j = 0; j < rings.length; j++) {
      if (i === j) continue;
      if (pointInRing(cx, cy, rings[j])) return false;
    }
  }
  return true;
}

function shouldUnionStrokeFragments(prepared) {
  return prepared?.length > 1 && prepared.every((poly) => poly?.length === 1);
}

const api = {
  ringSignedArea,
  ringCenter,
  pointInRing,
  normalizeRingByDepth,
  groupRingsIntoPolygons,
  countNegativeRings,
  flattenRings,
  glyphFillRule,
  shouldUnionOverlappingPositiveRings,
  shouldUnionStrokeFragments,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}
if (typeof window !== "undefined") {
  window.__millrectTextContourGrouping = api;
}
