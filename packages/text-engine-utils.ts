"use strict";

// Shared helpers for HarfBuzz / Core Text text engines (browser + Electron).

// builtin-fonts の各値は builtin-fonts.ts が global script スコープに同名で
// 定義しているため、分割代入で同名 local を作ると識別子が衝突する。require 結果を
// 1 つの local に受けてプロパティ参照で使う。
const builtinFonts = require("./builtin-fonts");
const contourGrouping = require("./text-contour-grouping");

/** Must match js/state.js REAL_PER_MM (1 mm on paper = 10 real drawing units). */
const TEXT_ENGINE_REAL_PER_MM = 10;

// ring/contour \u306f polygon-clipping \u540c\u69d8\u306e\u7d20\u306e\u914d\u5217\uff08point=number[]\uff09\u3067\u6271\u3046\u3002
type TERing = number[][];
type TEPolygon = TERing[];

interface TEScale {
  numerator: number;
  denominator: number;
}

// \u30c6\u30ad\u30b9\u30c8\u5f62\u72b6\u306f dynamic\uff08\u90e8\u5206\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u3082\u6e21\u308b\uff09\u305f\u3081\u6700\u5c0f\u30ad\u30fc\u306e\u307f\u898f\u5b9a\u3002
interface TETextShapeLike {
  text?: unknown;
  fontFamily?: unknown;
  fontWeight?: unknown;
  [key: string]: unknown;
}

function textEngineNeedsCjk(text: unknown): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test((text as string) || "");
}

function textEngineCharNeedsCjk(ch: string): boolean {
  if (!ch) return false;
  const cp = ch.codePointAt(0)!;
  return (
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

/** Latin / CJK などスクリプト境界でテキストを分割（混在時のフォント fallback 用） */
function textEngineSplitScriptRuns(
  text: string | null | undefined,
): { text: string; cjk: boolean | null }[] {
  if (!text) return [];
  const runs: { text: string; cjk: boolean | null }[] = [];
  let buf = "";
  let isCjk: boolean | null = null;
  for (const ch of text) {
    const cjk = textEngineCharNeedsCjk(ch);
    if (isCjk === null) {
      isCjk = cjk;
      buf = ch;
      continue;
    }
    if (isCjk === cjk) {
      buf += ch;
    } else {
      runs.push({ text: buf, cjk: isCjk });
      buf = ch;
      isCjk = cjk;
    }
  }
  if (buf) runs.push({ text: buf, cjk: isCjk });
  return runs;
}

function textEngineExpandFontCandidates(
  shape: TETextShapeLike | null | undefined,
  explicit?: string[] | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push(name);
  };

  for (const f of explicit || []) add(f);

  const primary = builtinFonts.textEnginePrimaryFontFamily(shape);
  add(primary);

  if (
    typeof findProjectFontByFamily === "function" &&
    findProjectFontByFamily(shape?.fontFamily)
  ) {
    add(findProjectFontByFamily(shape!.fontFamily)!.family);
  }

  if (textEngineNeedsCjk(shape?.text) && !builtinFonts.isBuiltinFontFamily(primary)) {
    add(builtinFonts.BUILTIN_FONT_GEN);
  }

  return out;
}

function textEngineAlignedX(
  lineWidth: number,
  frameWidth: number,
  anchorX: number,
  align?: string,
): number {
  switch (align) {
    case "center":
      return anchorX + Math.max(0, (frameWidth - lineWidth) / 2);
    case "right":
      return anchorX + Math.max(0, frameWidth - lineWidth);
    default:
      return anchorX;
  }
}

function textEnginePaperToReal(
  x: number,
  y: number,
  scale?: TEScale | null,
): [number, number] {
  scale = scale || { numerator: 1, denominator: 1 };
  const f = TEXT_ENGINE_REAL_PER_MM * (scale.denominator / scale.numerator);
  return [x * f, y * f];
}

function textEngineRingSignedArea(ring: TERing): number {
  return contourGrouping.ringSignedArea(ring);
}

function textEngineNormalizeContours(contours: TEPolygon[]): TEPolygon[] {
  return contours.map((polygon) =>
    polygon.map((ring, ringIndex) => {
      const ccw = textEngineRingSignedArea(ring) > 0;
      if (ringIndex === 0) {
        return ccw ? ring : ring.slice().reverse();
      }
      // 穴は外周と逆回り（nonzero で抜きを維持）
      return ccw ? ring.slice().reverse() : ring;
    }),
  );
}

function textEnginePointInRing(x: number, y: number, ring: TERing): boolean {
  return contourGrouping.pointInRing(x, y, ring);
}

function textEngineRingCenter(ring: TERing): number[] {
  return contourGrouping.ringCenter(ring);
}

function textEngineNormalizeRingByDepth(ring: TERing, depth: number): TERing {
  return contourGrouping.normalizeRingByDepth(ring, depth);
}

/** @see packages/text-contour-grouping.js */
function textEngineGroupRingsIntoPolygons(rings: TERing[]): TEPolygon[] {
  return contourGrouping.groupRingsIntoPolygons(rings);
}

function textEngineParseSvgPath(d: string): number[][][] {
  const rings: number[][][] = [];
  let ring: number[][] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const pushRing = () => {
    if (ring.length > 2) rings.push(ring);
    ring = [];
  };

  const tokens = d.match(/[MLQCZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return rings;

  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      pushRing();
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
      sx = cx;
      sy = cy;
      ring.push([cx, cy]);
    } else if (cmd === "L") {
      cx = parseFloat(tokens[i++]);
      cy = parseFloat(tokens[i++]);
      ring.push([cx, cy]);
    } else if (cmd === "Q") {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      for (let t = 1; t <= 8; t++) {
        const u = t / 8;
        const mt = 1 - u;
        ring.push([
          mt * mt * cx + 2 * mt * u * x1 + u * u * x2,
          mt * mt * cy + 2 * mt * u * y1 + u * u * y2,
        ]);
      }
      cx = x2;
      cy = y2;
    } else if (cmd === "C") {
      const x1 = parseFloat(tokens[i++]);
      const y1 = parseFloat(tokens[i++]);
      const x2 = parseFloat(tokens[i++]);
      const y2 = parseFloat(tokens[i++]);
      const x3 = parseFloat(tokens[i++]);
      const y3 = parseFloat(tokens[i++]);
      for (let t = 1; t <= 8; t++) {
        const u = t / 8;
        const mt = 1 - u;
        ring.push([
          mt ** 3 * cx +
            3 * mt ** 2 * u * x1 +
            3 * mt * u ** 2 * x2 +
            u ** 3 * x3,
          mt ** 3 * cy +
            3 * mt ** 2 * u * y1 +
            3 * mt * u ** 2 * y2 +
            u ** 3 * y3,
        ]);
      }
      cx = x3;
      cy = y3;
    } else if (cmd === "Z") {
      if (ring.length > 2) {
        ring.push([ring[0][0], ring[0][1]]);
        pushRing();
      } else {
        ring = [];
      }
      cx = sx;
      cy = sy;
    }
  }
  pushRing();
  return rings;
}

function textEngineHbPathToContoursReal(
  svgPath: string,
  originPaperX: number,
  baselinePaperY: number,
  upem: number,
  scale?: TEScale | null,
): TEPolygon[] | null {
  if (!svgPath) return null;
  const rings = textEngineParseSvgPath(svgPath);
  if (!rings.length) return null;

  const paperRings = rings.map((ring) =>
    ring.map(([x, y]) => {
      const px = originPaperX + x / upem;
      const py = baselinePaperY - y / upem;
      return textEnginePaperToReal(px, py, scale);
    }),
  );

  // フォント subpath の向きを保つ（groupRingsIntoPolygons は独立 stroke を
  // すべて正方向に反転し evenodd 相当の白抜けを起こす — Noto Sans 等）。
  const contours = paperRings.map((ring) => [ring.map(([x, y]) => [x, y])]);
  for (const poly of contours) {
    for (const ring of poly) {
      if (ring.length > 2 && Math.abs(textEngineRingSignedArea(ring)) > 0.01) {
        return contours;
      }
    }
  }
  return null;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TEXT_ENGINE_REAL_PER_MM,
    TEXT_ENGINE_CJK_FALLBACK_FAMILIES: builtinFonts.TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
    textEngineNeedsCjk,
    textEngineCharNeedsCjk,
    textEngineSplitScriptRuns,
    textEngineExpandFontCandidates,
    textEngineAlignedX,
    textEnginePaperToReal,
    textEngineHbPathToContoursReal,
    textEngineParseSvgPath,
    textEngineNormalizeContours,
    textEngineNormalizeRingByDepth,
    textEngineGroupRingsIntoPolygons,
  };
}
