"use strict";

/**
 * Part 種別ごとの純幾何（mm → real units rings / rects）
 * State 構築は app/js/part-builders.js
 */

type PartGeometryPoint = [number, number];
type PartGeometryRing = PartGeometryPoint[];

interface PartGeometryScale {
  numerator: number;
  denominator: number;
}

interface PartGeometryPaperMm {
  width: number;
  height: number;
}

interface LinearPatternOptions {
  count?: number;
  pitch_mm?: number;
  pitchMm?: number;
  start_mm?: { x: number; y: number };
  startMm?: { x: number; y: number };
  axis?: "x" | "y" | string;
}

function _pgRealPerMm(): number {
  if (typeof require !== "undefined") {
    try {
      return require("./agent-intent").REAL_PER_MM;
    } catch {
      /* browser */
    }
  }
  return typeof window !== "undefined" ? ((window as any).REAL_PER_MM ?? 10) : 10;
}

function mmToReal(mm: number): number {
  return mm * _pgRealPerMm();
}

/** 矩形穴 ring（real units、中心指定） */
function rectHoleRing(
  cx: number,
  cy: number,
  width: number,
  height: number,
): PartGeometryRing {
  const hw = width / 2;
  const hh = height / 2;
  return [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ];
}

/** L 字ブラケット上面外周 ring（原点基準、A×B バウンディング内） */
function lBracketTopOuterRing(
  mmA: number,
  mmB: number,
  mmT: number,
): PartGeometryRing {
  const a = mmToReal(mmA);
  const b = mmToReal(mmB);
  const t = mmToReal(mmT);
  return [
    [0, 0],
    [a, 0],
    [a, t],
    [t, t],
    [t, b],
    [0, b],
  ];
}

/** ring の bbox（real units） */
function ringBBox(ring: PartGeometryRing) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** ring 群を用紙中央に配置するオフセット */
function centerRingsOnPaper(
  rings: PartGeometryRing[],
  paperMm: PartGeometryPaperMm,
  scale?: PartGeometryScale,
): PartGeometryRing[] {
  scale = scale || { numerator: 1, denominator: 10 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const bw = maxX - minX;
  const bh = maxY - minY;
  const rpm = _pgRealPerMm();
  const wPaper = (bw / rpm) * (scale.numerator / scale.denominator);
  const hPaper = (bh / rpm) * (scale.numerator / scale.denominator);
  const xPaper = (paperMm.width - wPaper) / 2;
  const yPaper = (paperMm.height - hPaper) / 2;
  const ox = xPaper * rpm * (scale.denominator / scale.numerator) - minX;
  const oy = yPaper * rpm * (scale.denominator / scale.numerator) - minY;
  return rings.map((ring) => ring.map(([x, y]) => [x + ox, y + oy]));
}

/** 線形パターンの円穴中心（mm、profile 左下基準） */
function linearPatternCentersMm(opts: LinearPatternOptions = {}) {
  const count = Math.max(1, opts.count! | 0);
  const pitch = opts.pitch_mm ?? opts.pitchMm ?? 20;
  const start = opts.start_mm ?? opts.startMm ?? { x: 10, y: 10 };
  const axis = opts.axis ?? "x";
  const centers = [];
  for (let i = 0; i < count; i++) {
    if (axis === "y") {
      centers.push({ x: start.x, y: start.y + i * pitch });
    } else {
      centers.push({ x: start.x + i * pitch, y: start.y });
    }
  }
  return centers;
}

/** part 種別ごとのビュー寸法（mm） */
function partViewSizesMm(part: string, params: Record<string, number>) {
  switch (part) {
    case "panel":
      return {
        top: { w: params.W, h: params.H ?? params.D },
      };
    case "l_bracket":
      return {
        top: { w: params.A, h: params.B },
        front: { w: params.A, h: params.H },
      };
    case "enclosure":
    case "box":
    default:
      return null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mmToReal,
    rectHoleRing,
    lBracketTopOuterRing,
    ringBBox,
    centerRingsOnPaper,
    linearPatternCentersMm,
    partViewSizesMm,
  };
}

if (typeof window !== "undefined") {
  Object.assign(window, {
    mmToReal,
    rectHoleRing,
    lBracketTopOuterRing,
    ringBBox,
    centerRingsOnPaper,
    linearPatternCentersMm,
    partViewSizesMm,
  });
}
