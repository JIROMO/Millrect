"use strict";

// Shared helpers for HarfBuzz / Core Text text engines (browser + Electron).

const {
  BUILTIN_FONT_GEN,
  isBuiltinFontFamily,
  TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
  textEnginePrimaryFontFamily,
} = require("./builtin-fonts");
const contourGrouping = require("./text-contour-grouping");

/** Must match js/state.js REAL_PER_MM (1 mm on paper = 10 real drawing units). */
const TEXT_ENGINE_REAL_PER_MM = 10;

function textEngineNeedsCjk(text) {
  return /[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test(text || "");
}

function textEngineCharNeedsCjk(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return (
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xff00 && cp <= 0xffef)
  );
}

/** Latin / CJK などスクリプト境界でテキストを分割（混在時のフォント fallback 用） */
function textEngineSplitScriptRuns(text) {
  if (!text) return [];
  const runs = [];
  let buf = "";
  let isCjk = null;
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

function textEngineExpandFontCandidates(shape, explicit) {
  const out = [];
  const seen = new Set();
  const add = (name) => {
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push(name);
  };

  for (const f of explicit || []) add(f);

  const primary = textEnginePrimaryFontFamily(shape);
  add(primary);

  if (
    typeof findProjectFontByFamily === "function" &&
    findProjectFontByFamily(shape?.fontFamily)
  ) {
    add(findProjectFontByFamily(shape.fontFamily).family);
  }

  if (textEngineNeedsCjk(shape?.text) && !isBuiltinFontFamily(primary)) {
    add(BUILTIN_FONT_GEN);
  }

  return out;
}

function textEngineAlignedX(lineWidth, frameWidth, anchorX, align) {
  switch (align) {
    case "center":
      return anchorX + Math.max(0, (frameWidth - lineWidth) / 2);
    case "right":
      return anchorX + Math.max(0, frameWidth - lineWidth);
    default:
      return anchorX;
  }
}

function textEnginePaperToReal(x, y, scale) {
  scale = scale || { numerator: 1, denominator: 1 };
  const f = TEXT_ENGINE_REAL_PER_MM * (scale.denominator / scale.numerator);
  return [x * f, y * f];
}

function textEngineRingSignedArea(ring) {
  return contourGrouping.ringSignedArea(ring);
}

function textEngineNormalizeContours(contours) {
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

function textEnginePointInRing(x, y, ring) {
  return contourGrouping.pointInRing(x, y, ring);
}

function textEngineRingCenter(ring) {
  return contourGrouping.ringCenter(ring);
}

function textEngineNormalizeRingByDepth(ring, depth) {
  return contourGrouping.normalizeRingByDepth(ring, depth);
}

/** @see packages/text-contour-grouping.js */
function textEngineGroupRingsIntoPolygons(rings) {
  return contourGrouping.groupRingsIntoPolygons(rings);
}

function textEngineParseSvgPath(d) {
  const rings = [];
  let ring = [];
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
  svgPath,
  originPaperX,
  baselinePaperY,
  upem,
  scale,
) {
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
    TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
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
