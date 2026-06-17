var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/stubs/empty-module.js
var empty_module_exports = {};
__export(empty_module_exports, {
  default: () => empty_module_default
});
var empty_module_default;
var init_empty_module = __esm({
  "electron/stubs/empty-module.js"() {
    empty_module_default = {};
  }
});

// packages/builtin-fonts.js
var require_builtin_fonts = __commonJS({
  "packages/builtin-fonts.js"(exports2, module) {
    "use strict";
    var BUILTIN_FONT_GEN2 = "Gen Interface JP";
    var BUILTIN_FONT_FAMILIES = [BUILTIN_FONT_GEN2];
    var DEFAULT_TEXT_FONT_FAMILY = BUILTIN_FONT_GEN2;
    function normalizeTextFontFamily2(fontFamily) {
      const raw = String(fontFamily || DEFAULT_TEXT_FONT_FAMILY).split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      const k = raw.toLowerCase().replace(/[\s-_]/g, "");
      if (!k || k === "sansserif" || k === "arial" || k === "inter" || k.includes("helvetica") || k.includes("notosansjp") || k.includes("noto") && k.includes("sans") || k.includes("geninterfacejp") || k === "geninterface") {
        return BUILTIN_FONT_GEN2;
      }
      return raw;
    }
    function isBuiltinFontFamily(fontFamily) {
      const n = normalizeTextFontFamily2(fontFamily);
      return BUILTIN_FONT_FAMILIES.includes(n);
    }
    function textEnginePrimaryFontFamily(shape2) {
      const normalized = normalizeTextFontFamily2(shape2?.fontFamily);
      if (typeof findProjectFontByFamily === "function" && findProjectFontByFamily(normalized)) {
        return normalized;
      }
      if (isBuiltinFontFamily(normalized)) return normalized;
      if (typeof findProjectFontByFamily === "function" && findProjectFontByFamily(shape2?.fontFamily)) {
        return findProjectFontByFamily(shape2.fontFamily).family;
      }
      return normalized || DEFAULT_TEXT_FONT_FAMILY;
    }
    var TEXT_ENGINE_CJK_FALLBACK_FAMILIES = [BUILTIN_FONT_GEN2];
    if (typeof module !== "undefined" && module.exports) {
      module.exports = {
        BUILTIN_FONT_GEN: BUILTIN_FONT_GEN2,
        BUILTIN_FONT_FAMILIES,
        DEFAULT_TEXT_FONT_FAMILY,
        TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
        normalizeTextFontFamily: normalizeTextFontFamily2,
        isBuiltinFontFamily,
        textEnginePrimaryFontFamily
      };
    }
  }
});

// packages/text-contour-grouping.js
var require_text_contour_grouping = __commonJS({
  "packages/text-contour-grouping.js"(exports2, module) {
    "use strict";
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
        const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi + 0) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    function normalizeRingByDepth(ring, depth) {
      const ccw = ringSignedArea(ring) > 0;
      const wantCcw = depth % 2 === 0;
      return ccw === wantCcw ? ring : ring.slice().reverse();
    }
    function groupRingsIntoPolygons(rings) {
      if (!rings.length) return [];
      if (rings.length === 1) {
        return [[normalizeRingByDepth(rings[0], 0)]];
      }
      const meta = rings.map((ring, index) => ({
        index,
        area: Math.abs(ringSignedArea(ring))
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
    var api2 = {
      ringSignedArea,
      ringCenter,
      pointInRing,
      normalizeRingByDepth,
      groupRingsIntoPolygons,
      countNegativeRings,
      flattenRings,
      glyphFillRule,
      shouldUnionOverlappingPositiveRings,
      shouldUnionStrokeFragments
    };
    if (typeof module !== "undefined" && module.exports) {
      module.exports = api2;
    }
    if (typeof window !== "undefined") {
      window.__millrectTextContourGrouping = api2;
    }
  }
});

// packages/text-engine-utils.js
var require_text_engine_utils = __commonJS({
  "packages/text-engine-utils.js"(exports2, module) {
    "use strict";
    var {
      BUILTIN_FONT_GEN: BUILTIN_FONT_GEN2,
      isBuiltinFontFamily,
      TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
      textEnginePrimaryFontFamily
    } = require_builtin_fonts();
    var contourGrouping = require_text_contour_grouping();
    var TEXT_ENGINE_REAL_PER_MM = 10;
    function textEngineNeedsCjk(text) {
      return /[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test(text || "");
    }
    function textEngineCharNeedsCjk(ch) {
      if (!ch) return false;
      const cp = ch.codePointAt(0);
      return cp >= 12352 && cp <= 12543 || cp >= 19968 && cp <= 40959 || cp >= 13312 && cp <= 19903 || cp >= 65280 && cp <= 65519;
    }
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
    function textEngineExpandFontCandidates(shape2, explicit) {
      const out = [];
      const seen = /* @__PURE__ */ new Set();
      const add = (name) => {
        const k = name.toLowerCase();
        if (!name || seen.has(k)) return;
        seen.add(k);
        out.push(name);
      };
      for (const f of explicit || []) add(f);
      const primary = textEnginePrimaryFontFamily(shape2);
      add(primary);
      if (typeof findProjectFontByFamily === "function" && findProjectFontByFamily(shape2?.fontFamily)) {
        add(findProjectFontByFamily(shape2.fontFamily).family);
      }
      if (textEngineNeedsCjk(shape2?.text) && !isBuiltinFontFamily(primary)) {
        add(BUILTIN_FONT_GEN2);
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
      return contours.map(
        (polygon) => polygon.map((ring, ringIndex) => {
          const ccw = textEngineRingSignedArea(ring) > 0;
          if (ringIndex === 0) {
            return ccw ? ring : ring.slice().reverse();
          }
          return ccw ? ring.slice().reverse() : ring;
        })
      );
    }
    function textEngineNormalizeRingByDepth(ring, depth) {
      return contourGrouping.normalizeRingByDepth(ring, depth);
    }
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
              mt * mt * cy + 2 * mt * u * y1 + u * u * y2
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
              mt ** 3 * cx + 3 * mt ** 2 * u * x1 + 3 * mt * u ** 2 * x2 + u ** 3 * x3,
              mt ** 3 * cy + 3 * mt ** 2 * u * y1 + 3 * mt * u ** 2 * y2 + u ** 3 * y3
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
    function textEngineHbPathToContoursReal(svgPath, originPaperX, baselinePaperY, upem, scale) {
      if (!svgPath) return null;
      const rings = textEngineParseSvgPath(svgPath);
      if (!rings.length) return null;
      const paperRings = rings.map(
        (ring) => ring.map(([x, y]) => {
          const px = originPaperX + x / upem;
          const py = baselinePaperY - y / upem;
          return textEnginePaperToReal(px, py, scale);
        })
      );
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
        textEngineGroupRingsIntoPolygons
      };
    }
  }
});

// electron/text-engine-harfbuzz-core.js
var require_text_engine_harfbuzz_core = __commonJS({
  "electron/text-engine-harfbuzz-core.js"(exports2, module) {
    "use strict";
    var {
      textEngineExpandFontCandidates,
      textEngineAlignedX,
      textEngineHbPathToContoursReal,
      textEngineNeedsCjk,
      textEngineSplitScriptRuns
    } = require_text_engine_utils();
    var {
      BUILTIN_FONT_GEN: BUILTIN_FONT_GEN2,
      isBuiltinFontFamily,
      textEnginePrimaryFontFamily
    } = require_builtin_fonts();
    function createFontResolver(loadFontEntry) {
      const cache = /* @__PURE__ */ new Map();
      async function resolveFontEntry(shape2, fontCandidates) {
        const bold = shape2.fontWeight === "bold";
        const families = textEngineExpandFontCandidates(shape2, fontCandidates);
        const styles = bold ? ["Bold", "bold", "700"] : ["Regular", "Normal", "Book"];
        const key = `${families.join("|")}|${bold ? "b" : "r"}`;
        if (cache.has(key)) return cache.get(key);
        for (const family of families) {
          for (const style of styles) {
            const loaded = await loadFontEntry(family, style, bold);
            if (loaded) {
              cache.set(key, loaded);
              return loaded;
            }
          }
        }
        return null;
      }
      async function resolveCjkEntry(shape2, fontCandidates) {
        const bold = shape2.fontWeight === "bold";
        const styles = bold ? ["Bold", "bold", "700"] : ["Regular", "Normal", "Book"];
        const families = [];
        const seen = /* @__PURE__ */ new Set();
        const add = (name) => {
          const k = name.toLowerCase();
          if (!name || seen.has(k)) return;
          seen.add(k);
          families.push(name);
        };
        for (const f of fontCandidates || []) {
          if (f === BUILTIN_FONT_GEN2) add(f);
        }
        add(BUILTIN_FONT_GEN2);
        const key = `cjk:${families.join("|")}|${bold ? "b" : "r"}`;
        if (cache.has(key)) return cache.get(key);
        for (const family of families) {
          for (const style of styles) {
            const loaded = await loadFontEntry(family, style, bold);
            if (loaded) {
              cache.set(key, loaded);
              return loaded;
            }
          }
        }
        return null;
      }
      return { resolveFontEntry, resolveCjkEntry, cache };
    }
    function createHarfBuzzTextEngine2(hb, loadFontEntry) {
      const { resolveFontEntry, resolveCjkEntry } = createFontResolver(loadFontEntry);
      function prepareFont(entry, fontSize) {
        entry.font.setScale(fontSize * entry.upem, fontSize * entry.upem);
        return entry;
      }
      function shapeLineText(entry, text, fontSize, features) {
        prepareFont(entry, fontSize);
        const buffer = new hb.Buffer();
        buffer.addText(text || "");
        buffer.guessSegmentProperties();
        hb.shape(entry.font, buffer, features);
        return buffer.getGlyphInfosAndPositions();
      }
      function cjkShapingEntry(primary, fallback, shape2) {
        const family = textEnginePrimaryFontFamily(shape2);
        if (isBuiltinFontFamily(family)) return primary;
        return fallback || primary;
      }
      function shapeLineWithFallback(primary, cjk, text, fontSize, features, shape2) {
        const fallback = cjk && cjk !== primary ? cjk : null;
        if (!fallback || !textEngineNeedsCjk(text)) {
          return shapeLineText(primary, text, fontSize, features).map((glyph) => ({
            entry: primary,
            glyph
          }));
        }
        const scriptRuns = textEngineSplitScriptRuns(text);
        const mixed = scriptRuns.some((r) => r.cjk) && scriptRuns.some((r) => !r.cjk);
        if (!mixed) {
          const entry = cjkShapingEntry(primary, fallback, shape2);
          return shapeLineText(entry, text, fontSize, features).map((glyph) => ({
            entry,
            glyph
          }));
        }
        const out = [];
        for (const run of scriptRuns) {
          const entry = run.cjk ? cjkShapingEntry(primary, fallback, shape2) : primary;
          if (!entry || !run.text) continue;
          const glyphs = shapeLineText(entry, run.text, fontSize, features);
          for (const glyph of glyphs) {
            out.push({ entry, glyph });
          }
        }
        return out;
      }
      function measureLineWidthPaper(primary, cjk, text, fontSize, features, shape2) {
        if (!text) return 0;
        const shaped = shapeLineWithFallback(
          primary,
          cjk,
          text,
          fontSize,
          features,
          shape2
        );
        let w = 0;
        for (const { entry, glyph } of shaped) {
          w += glyph.xAdvance / entry.upem;
        }
        return w;
      }
      function wrapParagraph(primary, cjk, text, fontSize, maxWidthPaper, features, shape2) {
        if (!text) return [""];
        if (!maxWidthPaper || maxWidthPaper <= 0) return [text];
        const lines = [];
        let start = 0;
        while (start < text.length) {
          let end = start + 1;
          while (end <= text.length) {
            const slice = text.slice(start, end);
            const w = measureLineWidthPaper(
              primary,
              cjk,
              slice,
              fontSize,
              features,
              shape2
            );
            if (w > maxWidthPaper && end > start + 1) {
              end -= 1;
              break;
            }
            if (end === text.length) break;
            end += 1;
          }
          lines.push(text.slice(start, end));
          start = end;
        }
        return lines.length ? lines : [""];
      }
      function hbFeatures(_shape) {
        return void 0;
      }
      async function computeTextLayout(payload) {
        const { shape: shape2, anchorPaper, paperWidth, fontCandidates } = payload;
        const text = shape2.text ?? "";
        const fontSize = shape2.fontSize ?? 3.5;
        const lineHeightMult = Number(shape2.lineHeight) > 0 ? Number(shape2.lineHeight) : 1;
        const lineHeight = fontSize * lineHeightMult;
        const align = shape2.textAlign || "left";
        const anchor = anchorPaper;
        if (!text) {
          return {
            layoutPaper: {
              w: Math.max(fontSize * 0.25, 1),
              h: fontSize * lineHeightMult,
              insetTop: 0,
              insetLeft: 0
            },
            anchorPaper: anchor,
            lines: []
          };
        }
        const primary = await resolveFontEntry(shape2, fontCandidates);
        if (!primary) {
          throw new Error("\u30D5\u30A9\u30F3\u30C8\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F");
        }
        const cjk = textEngineNeedsCjk(text) ? await resolveCjkEntry(shape2, fontCandidates) || primary : primary;
        const features = hbFeatures(shape2);
        const paragraphs = text.split("\n");
        const visualLines = [];
        let globalIndex = 0;
        for (const para of paragraphs) {
          const wrapped = wrapParagraph(
            primary,
            cjk,
            para,
            fontSize,
            paperWidth,
            features,
            shape2
          );
          for (const wLine of wrapped) {
            visualLines.push({ text: wLine, lineIndex: globalIndex });
            globalIndex += 1;
          }
        }
        let maxLineWidth = 0;
        const lines = [];
        for (let idx = 0; idx < visualLines.length; idx++) {
          const vLine = visualLines[idx];
          const lw = measureLineWidthPaper(
            primary,
            cjk,
            vLine.text,
            fontSize,
            features,
            shape2
          );
          maxLineWidth = Math.max(maxLineWidth, lw);
          const fw = paperWidth ?? lw;
          lines.push({
            text: vLine.text,
            lineIndex: vLine.lineIndex,
            xPaper: textEngineAlignedX(lw, fw, anchor.x, align),
            yTopPaper: anchor.y + idx * lineHeight
          });
        }
        const pad = Math.max(0.5, fontSize * 0.06);
        const layoutW = paperWidth ?? Math.max(maxLineWidth + pad, 1);
        const layoutH = Math.max(visualLines.length * lineHeight, lineHeight);
        return {
          layoutPaper: {
            w: layoutW,
            h: layoutH,
            insetTop: 0,
            insetLeft: 0
          },
          anchorPaper: anchor,
          lines
        };
      }
      async function measureTextLayout2(payload) {
        const layout = await computeTextLayout(payload);
        return { layout, engine: "harfbuzz" };
      }
      async function outlineText2(payload) {
        const { shape: shape2, scale, anchorPaper } = payload;
        if (!shape2?.text || !/\S/.test(shape2.text)) {
          throw new Error("\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u5316\u3059\u308B\u30C6\u30AD\u30B9\u30C8\u304C\u3042\u308A\u307E\u305B\u3093");
        }
        const layout = payload.lines?.length && payload.layoutPaper ? {
          layoutPaper: payload.layoutPaper,
          anchorPaper: payload.anchorPaper || anchorPaper,
          lines: payload.lines
        } : await computeTextLayout(payload);
        const primary = await resolveFontEntry(shape2, payload.fontCandidates);
        if (!primary) {
          throw new Error("\u30D5\u30A9\u30F3\u30C8\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F");
        }
        const cjk = textEngineNeedsCjk(shape2.text) ? await resolveCjkEntry(shape2, payload.fontCandidates) || primary : primary;
        const fontSize = shape2.fontSize ?? 3.5;
        const lineHeightMult = Number(shape2.lineHeight) > 0 ? Number(shape2.lineHeight) : 1;
        const features = hbFeatures(shape2);
        const fillColor = (() => {
          const valid = (c) => typeof c === "string" && c && c !== "none" && c !== "transparent";
          if (valid(shape2.fill)) return shape2.fill;
          if (valid(shape2.stroke)) return shape2.stroke;
          return "#1a1a2e";
        })();
        prepareFont(primary, fontSize);
        const ascenderPaper = primary.font.hExtents().ascender / primary.upem;
        const children = [];
        for (const line of layout.lines) {
          if (!line.text) continue;
          const yBaseline = line.yTopPaper != null ? line.yTopPaper + ascenderPaper : anchorPaper.y + ascenderPaper + (line.lineIndex || 0) * fontSize * lineHeightMult;
          const shaped = shapeLineWithFallback(
            primary,
            cjk,
            line.text,
            fontSize,
            features,
            shape2
          );
          let cursorPaper = 0;
          for (const { entry, glyph: g } of shaped) {
            prepareFont(entry, fontSize);
            if (!g.codepoint) {
              cursorPaper += g.xAdvance;
              continue;
            }
            const svgPath = entry.font.glyphToPath(g.codepoint);
            if (!svgPath) {
              cursorPaper += g.xAdvance;
              continue;
            }
            const gxPaper = line.xPaper + (cursorPaper + g.xOffset) / entry.upem;
            const gyPaper = yBaseline - g.yOffset / entry.upem;
            const contours = textEngineHbPathToContoursReal(
              svgPath,
              gxPaper,
              gyPaper,
              entry.upem,
              scale
            );
            cursorPaper += g.xAdvance;
            if (!contours) continue;
            children.push({
              type: "path",
              contours,
              stroke: "none",
              fill: fillColor,
              strokeWidth: "thin"
            });
          }
        }
        if (!children.length) {
          throw new Error("\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3\u5316\u3067\u304D\u308B\u30B0\u30EA\u30D5\u304C\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F");
        }
        return { children, layout, engine: "harfbuzz" };
      }
      return { measureTextLayout: measureTextLayout2, outlineText: outlineText2, computeTextLayout };
    }
    function openHbFont2(hb, buffer, faceIndex = 0) {
      const blob = new hb.Blob(buffer);
      const face = new hb.Face(blob, faceIndex);
      const font = new hb.Font(face);
      return {
        blob,
        face,
        font,
        upem: face.upem,
        buffer
      };
    }
    module.exports = {
      createHarfBuzzTextEngine: createHarfBuzzTextEngine2,
      openHbFont: openHbFont2
    };
  }
});

// node_modules/harfbuzzjs/dist/index.mjs
var dist_exports = {};
__export(dist_exports, {
  Blob: () => Blob,
  Buffer: () => Buffer2,
  BufferContentType: () => BufferContentType,
  BufferFlag: () => BufferFlag,
  BufferSerializeFlag: () => BufferSerializeFlag,
  BufferSerializeFormat: () => BufferSerializeFormat,
  ClusterLevel: () => ClusterLevel,
  Direction: () => Direction,
  Face: () => Face,
  Feature: () => Feature,
  Font: () => Font,
  FontFuncs: () => FontFuncs,
  GlyphClass: () => GlyphClass,
  GlyphFlag: () => GlyphFlag,
  TracePhase: () => TracePhase,
  Variation: () => Variation,
  otTagToLanguage: () => otTagToLanguage,
  otTagToScript: () => otTagToScript,
  shape: () => shape,
  shapeWithTrace: () => shapeWithTrace,
  version: () => version,
  versionString: () => versionString
});

// node_modules/harfbuzzjs/dist/harfbuzz.js
async function createHarfBuzz(moduleArg = {}) {
  var moduleRtn;
  var Module2 = moduleArg;
  var ENVIRONMENT_IS_WEB = typeof window == "object";
  var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
  var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
  if (ENVIRONMENT_IS_NODE) {
    const { createRequire } = await Promise.resolve().then(() => (init_empty_module(), empty_module_exports));
    var require2 = createRequire(import.meta.url);
  }
  var arguments_ = [];
  var thisProgram = "./this.program";
  var quit_ = (status, toThrow) => {
    throw toThrow;
  };
  var _scriptName = import.meta.url;
  var scriptDirectory = "";
  function locateFile(path) {
    if (Module2["locateFile"]) {
      return Module2["locateFile"](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  var readAsync, readBinary;
  if (ENVIRONMENT_IS_NODE) {
    var fs = require2("fs");
    if (_scriptName.startsWith("file:")) {
      scriptDirectory = require2("path").dirname(require2("url").fileURLToPath(_scriptName)) + "/";
    }
    readBinary = (filename) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename);
      return ret;
    };
    readAsync = async (filename, binary = true) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename, binary ? void 0 : "utf8");
      return ret;
    };
    if (process.argv.length > 1) {
      thisProgram = process.argv[1].replace(/\\/g, "/");
    }
    arguments_ = process.argv.slice(2);
    quit_ = (status, toThrow) => {
      process.exitCode = status;
      throw toThrow;
    };
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
      scriptDirectory = new URL(".", _scriptName).href;
    } catch {
    }
    {
      if (ENVIRONMENT_IS_WORKER) {
        readBinary = (url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(xhr.response);
        };
      }
      readAsync = async (url) => {
        if (isFileURI(url)) {
          return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                resolve(xhr.response);
                return;
              }
              reject(xhr.status);
            };
            xhr.onerror = reject;
            xhr.send(null);
          });
        }
        var response = await fetch(url, { credentials: "same-origin" });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + " : " + response.url);
      };
    }
  } else {
  }
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  var isFileURI = (filename) => filename.startsWith("file://");
  var readyPromiseResolve, readyPromiseReject;
  var wasmMemory;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var HEAP64, HEAPU64;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module2["HEAP8"] = HEAP8 = new Int8Array(b);
    HEAP16 = new Int16Array(b);
    Module2["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    Module2["HEAPU16"] = HEAPU16 = new Uint16Array(b);
    Module2["HEAP32"] = HEAP32 = new Int32Array(b);
    Module2["HEAPU32"] = HEAPU32 = new Uint32Array(b);
    Module2["HEAPF32"] = HEAPF32 = new Float32Array(b);
    HEAPF64 = new Float64Array(b);
    HEAP64 = new BigInt64Array(b);
    HEAPU64 = new BigUint64Array(b);
  }
  function preRun() {
    if (Module2["preRun"]) {
      if (typeof Module2["preRun"] == "function") Module2["preRun"] = [Module2["preRun"]];
      while (Module2["preRun"].length) {
        addOnPreRun(Module2["preRun"].shift());
      }
    }
    callRuntimeCallbacks(onPreRuns);
  }
  function initRuntime() {
    runtimeInitialized = true;
    wasmExports["__wasm_call_ctors"]();
  }
  function postRun() {
    if (Module2["postRun"]) {
      if (typeof Module2["postRun"] == "function") Module2["postRun"] = [Module2["postRun"]];
      while (Module2["postRun"].length) {
        addOnPostRun(Module2["postRun"].shift());
      }
    }
    callRuntimeCallbacks(onPostRuns);
  }
  var runDependencies = 0;
  var dependenciesFulfilled = null;
  function addRunDependency(id) {
    runDependencies++;
    Module2["monitorRunDependencies"]?.(runDependencies);
  }
  function removeRunDependency(id) {
    runDependencies--;
    Module2["monitorRunDependencies"]?.(runDependencies);
    if (runDependencies == 0) {
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }
  function abort(what) {
    Module2["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module2["locateFile"]) {
      return locateFile("harfbuzz.wasm");
    }
    return new URL("harfbuzz.wasm", import.meta.url).href;
  }
  function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  }
  async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {
      }
    }
    return getBinarySync(binaryFile);
  }
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary = await getWasmBinary(binaryFile);
      var instance = await WebAssembly.instantiate(binary, imports);
      return instance;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  async function instantiateAsync(binary, binaryFile, imports) {
    if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
      try {
        var response = fetch(binaryFile, { credentials: "same-origin" });
        var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err("falling back to ArrayBuffer instantiation");
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  function getWasmImports() {
    return { env: wasmImports, wasi_snapshot_preview1: wasmImports };
  }
  async function createWasm() {
    function receiveInstance(instance, module) {
      wasmExports = instance.exports;
      Module2["wasmExports"] = wasmExports;
      wasmMemory = wasmExports["memory"];
      updateMemoryViews();
      wasmTable = wasmExports["__indirect_function_table"];
      assignWasmExports(wasmExports);
      removeRunDependency("wasm-instantiate");
      return wasmExports;
    }
    addRunDependency("wasm-instantiate");
    function receiveInstantiationResult(result2) {
      return receiveInstance(result2["instance"]);
    }
    var info = getWasmImports();
    if (Module2["instantiateWasm"]) {
      return new Promise((resolve, reject) => {
        Module2["instantiateWasm"](info, (mod, inst) => {
          resolve(receiveInstance(mod, inst));
        });
      });
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
    var exports2 = receiveInstantiationResult(result);
    return exports2;
  }
  class ExitStatus {
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var callRuntimeCallbacks = (callbacks) => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module2);
    }
  };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);
  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);
  var noExitRuntime = true;
  var stackRestore = (val) => __emscripten_stack_restore(val);
  var stackSave = () => _emscripten_stack_get_current();
  var __abort_js = () => abort("");
  var runtimeKeepaliveCounter = 0;
  var __emscripten_runtime_keepalive_clear = () => {
    noExitRuntime = false;
    runtimeKeepaliveCounter = 0;
  };
  var timers = {};
  var handleException = (e) => {
    if (e instanceof ExitStatus || e == "unwind") {
      return EXITSTATUS;
    }
    quit_(1, e);
  };
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  var _proc_exit = (code) => {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
      Module2["onExit"]?.(code);
      ABORT = true;
    }
    quit_(code, new ExitStatus(code));
  };
  var exitJS = (status, implicit) => {
    EXITSTATUS = status;
    _proc_exit(status);
  };
  var _exit = exitJS;
  var maybeExit = () => {
    if (!keepRuntimeAlive()) {
      try {
        _exit(EXITSTATUS);
      } catch (e) {
        handleException(e);
      }
    }
  };
  var callUserCallback = (func) => {
    if (ABORT) {
      return;
    }
    try {
      func();
      maybeExit();
    } catch (e) {
      handleException(e);
    }
  };
  var _emscripten_get_now = () => performance.now();
  var __setitimer_js = (which, timeout_ms) => {
    if (timers[which]) {
      clearTimeout(timers[which].id);
      delete timers[which];
    }
    if (!timeout_ms) return 0;
    var id = setTimeout(() => {
      delete timers[which];
      callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
    }, timeout_ms);
    timers[which] = { id, timeout_ms };
    return 0;
  };
  var getHeapMax = () => 2147483648;
  var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
  var growMemory = (size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {
    }
  };
  var _emscripten_resize_heap = (requestedSize) => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  };
  var uleb128EncodeWithLen = (arr) => {
    const n = arr.length;
    return [n % 128 | 128, n >> 7, ...arr];
  };
  var wasmTypeCodes = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
  var generateTypePack = (types) => uleb128EncodeWithLen(Array.from(types, (type) => {
    var code = wasmTypeCodes[type];
    return code;
  }));
  var convertJsFunctionToWasm = (func, sig) => {
    var bytes = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...uleb128EncodeWithLen([1, 96, ...generateTypePack(sig.slice(1)), ...generateTypePack(sig[0] === "v" ? "" : sig[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
    var module = new WebAssembly.Module(bytes);
    var instance = new WebAssembly.Instance(module, { e: { f: func } });
    var wrappedFunc = instance.exports["f"];
    return wrappedFunc;
  };
  var wasmTable;
  var getWasmTableEntry = (funcPtr) => wasmTable.get(funcPtr);
  var updateTableMap = (offset, count) => {
    if (functionsInTableMap) {
      for (var i = offset; i < offset + count; i++) {
        var item = getWasmTableEntry(i);
        if (item) {
          functionsInTableMap.set(item, i);
        }
      }
    }
  };
  var functionsInTableMap;
  var getFunctionAddress = (func) => {
    if (!functionsInTableMap) {
      functionsInTableMap = /* @__PURE__ */ new WeakMap();
      updateTableMap(0, wasmTable.length);
    }
    return functionsInTableMap.get(func) || 0;
  };
  var freeTableIndexes = [];
  var getEmptyTableSlot = () => {
    if (freeTableIndexes.length) {
      return freeTableIndexes.pop();
    }
    return wasmTable["grow"](1);
  };
  var setWasmTableEntry = (idx, func) => wasmTable.set(idx, func);
  var addFunction = (func, sig) => {
    var rtn = getFunctionAddress(func);
    if (rtn) {
      return rtn;
    }
    var ret = getEmptyTableSlot();
    try {
      setWasmTableEntry(ret, func);
    } catch (err2) {
      if (!(err2 instanceof TypeError)) {
        throw err2;
      }
      var wrapped = convertJsFunctionToWasm(func, sig);
      setWasmTableEntry(ret, wrapped);
    }
    functionsInTableMap.set(func, ret);
    return ret;
  };
  var removeFunction = (index) => {
    functionsInTableMap.delete(getWasmTableEntry(index));
    setWasmTableEntry(index, null);
    freeTableIndexes.push(index);
  };
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  {
    if (Module2["noExitRuntime"]) noExitRuntime = Module2["noExitRuntime"];
    if (Module2["print"]) out = Module2["print"];
    if (Module2["printErr"]) err = Module2["printErr"];
    if (Module2["wasmBinary"]) wasmBinary = Module2["wasmBinary"];
    if (Module2["arguments"]) arguments_ = Module2["arguments"];
    if (Module2["thisProgram"]) thisProgram = Module2["thisProgram"];
  }
  Module2["wasmExports"] = wasmExports;
  Module2["stackSave"] = stackSave;
  Module2["stackRestore"] = stackRestore;
  Module2["stackAlloc"] = stackAlloc;
  Module2["addFunction"] = addFunction;
  Module2["removeFunction"] = removeFunction;
  var _hb_blob_create, _hb_blob_destroy, _hb_blob_get_length, _hb_blob_get_data, _hb_buffer_serialize, _hb_buffer_create, _hb_buffer_reset, _hb_buffer_reference, _hb_buffer_destroy, _hb_buffer_get_content_type, _hb_buffer_set_direction, _hb_buffer_set_script, _hb_buffer_set_language, _hb_buffer_set_flags, _hb_buffer_set_cluster_level, _hb_buffer_clear_contents, _hb_buffer_add, _hb_buffer_get_length, _hb_buffer_get_glyph_infos, _hb_buffer_get_glyph_positions, _hb_glyph_info_get_glyph_flags, _hb_buffer_guess_segment_properties, _hb_buffer_add_utf8, _hb_buffer_add_utf16, _hb_buffer_add_codepoints, _hb_buffer_set_message_func, _hb_language_from_string, _hb_language_to_string, _hb_script_from_string, _hb_version, _hb_version_string, _hb_feature_from_string, _hb_feature_to_string, _hb_variation_from_string, _hb_variation_to_string, _malloc, _free, _hb_draw_funcs_set_move_to_func, _hb_draw_funcs_set_line_to_func, _hb_draw_funcs_set_quadratic_to_func, _hb_draw_funcs_set_cubic_to_func, _hb_draw_funcs_set_close_path_func, _hb_draw_funcs_create, _hb_draw_funcs_destroy, _hb_face_create, _hb_face_reference, _hb_face_destroy, _hb_face_reference_table, _hb_face_get_upem, _hb_face_collect_unicodes, _hb_font_funcs_create, _hb_font_funcs_destroy, _hb_font_funcs_set_font_h_extents_func, _hb_font_funcs_set_font_v_extents_func, _hb_font_funcs_set_nominal_glyph_func, _hb_font_funcs_set_nominal_glyphs_func, _hb_font_funcs_set_variation_glyph_func, _hb_font_funcs_set_glyph_h_advance_func, _hb_font_funcs_set_glyph_v_advance_func, _hb_font_funcs_set_glyph_h_advances_func, _hb_font_funcs_set_glyph_v_advances_func, _hb_font_funcs_set_glyph_h_origin_func, _hb_font_funcs_set_glyph_v_origin_func, _hb_font_funcs_set_glyph_h_kerning_func, _hb_font_funcs_set_glyph_extents_func, _hb_font_funcs_set_glyph_name_func, _hb_font_funcs_set_glyph_from_name_func, _hb_font_get_h_extents, _hb_font_get_v_extents, _hb_font_get_glyph, _hb_font_get_nominal_glyph, _hb_font_get_variation_glyph, _hb_font_get_glyph_h_advance, _hb_font_get_glyph_v_advance, _hb_font_get_glyph_h_origin, _hb_font_get_glyph_v_origin, _hb_font_get_glyph_extents, _hb_font_get_glyph_from_name, _hb_font_draw_glyph, _hb_font_glyph_to_string, _hb_font_create, _hb_font_set_variations, _hb_font_create_sub_font, _hb_font_reference, _hb_font_destroy, _hb_font_get_face, _hb_font_set_funcs, _hb_font_set_scale, _hb_ot_layout_get_glyph_class, _hb_ot_layout_table_get_script_tags, _hb_ot_layout_table_get_feature_tags, _hb_ot_layout_script_get_language_tags, _hb_ot_layout_language_get_feature_tags, _hb_ot_layout_feature_get_lookups, _hb_ot_layout_feature_get_name_ids, _hb_ot_layout_lookup_get_optical_bound, _hb_ot_name_list_names, _hb_ot_name_get_utf16, _hb_set_create, _hb_set_destroy, _hb_ot_tag_to_script, _hb_ot_tag_to_language, _hb_ot_var_get_axis_infos, _hb_set_get_population, _hb_set_next_many, _hb_shape, __emscripten_timeout, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current;
  function assignWasmExports(wasmExports2) {
    Module2["_hb_blob_create"] = _hb_blob_create = wasmExports2["hb_blob_create"];
    Module2["_hb_blob_destroy"] = _hb_blob_destroy = wasmExports2["hb_blob_destroy"];
    Module2["_hb_blob_get_length"] = _hb_blob_get_length = wasmExports2["hb_blob_get_length"];
    Module2["_hb_blob_get_data"] = _hb_blob_get_data = wasmExports2["hb_blob_get_data"];
    Module2["_hb_buffer_serialize"] = _hb_buffer_serialize = wasmExports2["hb_buffer_serialize"];
    Module2["_hb_buffer_create"] = _hb_buffer_create = wasmExports2["hb_buffer_create"];
    Module2["_hb_buffer_reset"] = _hb_buffer_reset = wasmExports2["hb_buffer_reset"];
    Module2["_hb_buffer_reference"] = _hb_buffer_reference = wasmExports2["hb_buffer_reference"];
    Module2["_hb_buffer_destroy"] = _hb_buffer_destroy = wasmExports2["hb_buffer_destroy"];
    Module2["_hb_buffer_get_content_type"] = _hb_buffer_get_content_type = wasmExports2["hb_buffer_get_content_type"];
    Module2["_hb_buffer_set_direction"] = _hb_buffer_set_direction = wasmExports2["hb_buffer_set_direction"];
    Module2["_hb_buffer_set_script"] = _hb_buffer_set_script = wasmExports2["hb_buffer_set_script"];
    Module2["_hb_buffer_set_language"] = _hb_buffer_set_language = wasmExports2["hb_buffer_set_language"];
    Module2["_hb_buffer_set_flags"] = _hb_buffer_set_flags = wasmExports2["hb_buffer_set_flags"];
    Module2["_hb_buffer_set_cluster_level"] = _hb_buffer_set_cluster_level = wasmExports2["hb_buffer_set_cluster_level"];
    Module2["_hb_buffer_clear_contents"] = _hb_buffer_clear_contents = wasmExports2["hb_buffer_clear_contents"];
    Module2["_hb_buffer_add"] = _hb_buffer_add = wasmExports2["hb_buffer_add"];
    Module2["_hb_buffer_get_length"] = _hb_buffer_get_length = wasmExports2["hb_buffer_get_length"];
    Module2["_hb_buffer_get_glyph_infos"] = _hb_buffer_get_glyph_infos = wasmExports2["hb_buffer_get_glyph_infos"];
    Module2["_hb_buffer_get_glyph_positions"] = _hb_buffer_get_glyph_positions = wasmExports2["hb_buffer_get_glyph_positions"];
    Module2["_hb_glyph_info_get_glyph_flags"] = _hb_glyph_info_get_glyph_flags = wasmExports2["hb_glyph_info_get_glyph_flags"];
    Module2["_hb_buffer_guess_segment_properties"] = _hb_buffer_guess_segment_properties = wasmExports2["hb_buffer_guess_segment_properties"];
    Module2["_hb_buffer_add_utf8"] = _hb_buffer_add_utf8 = wasmExports2["hb_buffer_add_utf8"];
    Module2["_hb_buffer_add_utf16"] = _hb_buffer_add_utf16 = wasmExports2["hb_buffer_add_utf16"];
    Module2["_hb_buffer_add_codepoints"] = _hb_buffer_add_codepoints = wasmExports2["hb_buffer_add_codepoints"];
    Module2["_hb_buffer_set_message_func"] = _hb_buffer_set_message_func = wasmExports2["hb_buffer_set_message_func"];
    Module2["_hb_language_from_string"] = _hb_language_from_string = wasmExports2["hb_language_from_string"];
    Module2["_hb_language_to_string"] = _hb_language_to_string = wasmExports2["hb_language_to_string"];
    Module2["_hb_script_from_string"] = _hb_script_from_string = wasmExports2["hb_script_from_string"];
    Module2["_hb_version"] = _hb_version = wasmExports2["hb_version"];
    Module2["_hb_version_string"] = _hb_version_string = wasmExports2["hb_version_string"];
    Module2["_hb_feature_from_string"] = _hb_feature_from_string = wasmExports2["hb_feature_from_string"];
    Module2["_hb_feature_to_string"] = _hb_feature_to_string = wasmExports2["hb_feature_to_string"];
    Module2["_hb_variation_from_string"] = _hb_variation_from_string = wasmExports2["hb_variation_from_string"];
    Module2["_hb_variation_to_string"] = _hb_variation_to_string = wasmExports2["hb_variation_to_string"];
    Module2["_malloc"] = _malloc = wasmExports2["malloc"];
    Module2["_free"] = _free = wasmExports2["free"];
    Module2["_hb_draw_funcs_set_move_to_func"] = _hb_draw_funcs_set_move_to_func = wasmExports2["hb_draw_funcs_set_move_to_func"];
    Module2["_hb_draw_funcs_set_line_to_func"] = _hb_draw_funcs_set_line_to_func = wasmExports2["hb_draw_funcs_set_line_to_func"];
    Module2["_hb_draw_funcs_set_quadratic_to_func"] = _hb_draw_funcs_set_quadratic_to_func = wasmExports2["hb_draw_funcs_set_quadratic_to_func"];
    Module2["_hb_draw_funcs_set_cubic_to_func"] = _hb_draw_funcs_set_cubic_to_func = wasmExports2["hb_draw_funcs_set_cubic_to_func"];
    Module2["_hb_draw_funcs_set_close_path_func"] = _hb_draw_funcs_set_close_path_func = wasmExports2["hb_draw_funcs_set_close_path_func"];
    Module2["_hb_draw_funcs_create"] = _hb_draw_funcs_create = wasmExports2["hb_draw_funcs_create"];
    Module2["_hb_draw_funcs_destroy"] = _hb_draw_funcs_destroy = wasmExports2["hb_draw_funcs_destroy"];
    Module2["_hb_face_create"] = _hb_face_create = wasmExports2["hb_face_create"];
    Module2["_hb_face_reference"] = _hb_face_reference = wasmExports2["hb_face_reference"];
    Module2["_hb_face_destroy"] = _hb_face_destroy = wasmExports2["hb_face_destroy"];
    Module2["_hb_face_reference_table"] = _hb_face_reference_table = wasmExports2["hb_face_reference_table"];
    Module2["_hb_face_get_upem"] = _hb_face_get_upem = wasmExports2["hb_face_get_upem"];
    Module2["_hb_face_collect_unicodes"] = _hb_face_collect_unicodes = wasmExports2["hb_face_collect_unicodes"];
    Module2["_hb_font_funcs_create"] = _hb_font_funcs_create = wasmExports2["hb_font_funcs_create"];
    Module2["_hb_font_funcs_destroy"] = _hb_font_funcs_destroy = wasmExports2["hb_font_funcs_destroy"];
    Module2["_hb_font_funcs_set_font_h_extents_func"] = _hb_font_funcs_set_font_h_extents_func = wasmExports2["hb_font_funcs_set_font_h_extents_func"];
    Module2["_hb_font_funcs_set_font_v_extents_func"] = _hb_font_funcs_set_font_v_extents_func = wasmExports2["hb_font_funcs_set_font_v_extents_func"];
    Module2["_hb_font_funcs_set_nominal_glyph_func"] = _hb_font_funcs_set_nominal_glyph_func = wasmExports2["hb_font_funcs_set_nominal_glyph_func"];
    Module2["_hb_font_funcs_set_nominal_glyphs_func"] = _hb_font_funcs_set_nominal_glyphs_func = wasmExports2["hb_font_funcs_set_nominal_glyphs_func"];
    Module2["_hb_font_funcs_set_variation_glyph_func"] = _hb_font_funcs_set_variation_glyph_func = wasmExports2["hb_font_funcs_set_variation_glyph_func"];
    Module2["_hb_font_funcs_set_glyph_h_advance_func"] = _hb_font_funcs_set_glyph_h_advance_func = wasmExports2["hb_font_funcs_set_glyph_h_advance_func"];
    Module2["_hb_font_funcs_set_glyph_v_advance_func"] = _hb_font_funcs_set_glyph_v_advance_func = wasmExports2["hb_font_funcs_set_glyph_v_advance_func"];
    Module2["_hb_font_funcs_set_glyph_h_advances_func"] = _hb_font_funcs_set_glyph_h_advances_func = wasmExports2["hb_font_funcs_set_glyph_h_advances_func"];
    Module2["_hb_font_funcs_set_glyph_v_advances_func"] = _hb_font_funcs_set_glyph_v_advances_func = wasmExports2["hb_font_funcs_set_glyph_v_advances_func"];
    Module2["_hb_font_funcs_set_glyph_h_origin_func"] = _hb_font_funcs_set_glyph_h_origin_func = wasmExports2["hb_font_funcs_set_glyph_h_origin_func"];
    Module2["_hb_font_funcs_set_glyph_v_origin_func"] = _hb_font_funcs_set_glyph_v_origin_func = wasmExports2["hb_font_funcs_set_glyph_v_origin_func"];
    Module2["_hb_font_funcs_set_glyph_h_kerning_func"] = _hb_font_funcs_set_glyph_h_kerning_func = wasmExports2["hb_font_funcs_set_glyph_h_kerning_func"];
    Module2["_hb_font_funcs_set_glyph_extents_func"] = _hb_font_funcs_set_glyph_extents_func = wasmExports2["hb_font_funcs_set_glyph_extents_func"];
    Module2["_hb_font_funcs_set_glyph_name_func"] = _hb_font_funcs_set_glyph_name_func = wasmExports2["hb_font_funcs_set_glyph_name_func"];
    Module2["_hb_font_funcs_set_glyph_from_name_func"] = _hb_font_funcs_set_glyph_from_name_func = wasmExports2["hb_font_funcs_set_glyph_from_name_func"];
    Module2["_hb_font_get_h_extents"] = _hb_font_get_h_extents = wasmExports2["hb_font_get_h_extents"];
    Module2["_hb_font_get_v_extents"] = _hb_font_get_v_extents = wasmExports2["hb_font_get_v_extents"];
    Module2["_hb_font_get_glyph"] = _hb_font_get_glyph = wasmExports2["hb_font_get_glyph"];
    Module2["_hb_font_get_nominal_glyph"] = _hb_font_get_nominal_glyph = wasmExports2["hb_font_get_nominal_glyph"];
    Module2["_hb_font_get_variation_glyph"] = _hb_font_get_variation_glyph = wasmExports2["hb_font_get_variation_glyph"];
    Module2["_hb_font_get_glyph_h_advance"] = _hb_font_get_glyph_h_advance = wasmExports2["hb_font_get_glyph_h_advance"];
    Module2["_hb_font_get_glyph_v_advance"] = _hb_font_get_glyph_v_advance = wasmExports2["hb_font_get_glyph_v_advance"];
    Module2["_hb_font_get_glyph_h_origin"] = _hb_font_get_glyph_h_origin = wasmExports2["hb_font_get_glyph_h_origin"];
    Module2["_hb_font_get_glyph_v_origin"] = _hb_font_get_glyph_v_origin = wasmExports2["hb_font_get_glyph_v_origin"];
    Module2["_hb_font_get_glyph_extents"] = _hb_font_get_glyph_extents = wasmExports2["hb_font_get_glyph_extents"];
    Module2["_hb_font_get_glyph_from_name"] = _hb_font_get_glyph_from_name = wasmExports2["hb_font_get_glyph_from_name"];
    Module2["_hb_font_draw_glyph"] = _hb_font_draw_glyph = wasmExports2["hb_font_draw_glyph"];
    Module2["_hb_font_glyph_to_string"] = _hb_font_glyph_to_string = wasmExports2["hb_font_glyph_to_string"];
    Module2["_hb_font_create"] = _hb_font_create = wasmExports2["hb_font_create"];
    Module2["_hb_font_set_variations"] = _hb_font_set_variations = wasmExports2["hb_font_set_variations"];
    Module2["_hb_font_create_sub_font"] = _hb_font_create_sub_font = wasmExports2["hb_font_create_sub_font"];
    Module2["_hb_font_reference"] = _hb_font_reference = wasmExports2["hb_font_reference"];
    Module2["_hb_font_destroy"] = _hb_font_destroy = wasmExports2["hb_font_destroy"];
    Module2["_hb_font_get_face"] = _hb_font_get_face = wasmExports2["hb_font_get_face"];
    Module2["_hb_font_set_funcs"] = _hb_font_set_funcs = wasmExports2["hb_font_set_funcs"];
    Module2["_hb_font_set_scale"] = _hb_font_set_scale = wasmExports2["hb_font_set_scale"];
    Module2["_hb_ot_layout_get_glyph_class"] = _hb_ot_layout_get_glyph_class = wasmExports2["hb_ot_layout_get_glyph_class"];
    Module2["_hb_ot_layout_table_get_script_tags"] = _hb_ot_layout_table_get_script_tags = wasmExports2["hb_ot_layout_table_get_script_tags"];
    Module2["_hb_ot_layout_table_get_feature_tags"] = _hb_ot_layout_table_get_feature_tags = wasmExports2["hb_ot_layout_table_get_feature_tags"];
    Module2["_hb_ot_layout_script_get_language_tags"] = _hb_ot_layout_script_get_language_tags = wasmExports2["hb_ot_layout_script_get_language_tags"];
    Module2["_hb_ot_layout_language_get_feature_tags"] = _hb_ot_layout_language_get_feature_tags = wasmExports2["hb_ot_layout_language_get_feature_tags"];
    Module2["_hb_ot_layout_feature_get_lookups"] = _hb_ot_layout_feature_get_lookups = wasmExports2["hb_ot_layout_feature_get_lookups"];
    Module2["_hb_ot_layout_feature_get_name_ids"] = _hb_ot_layout_feature_get_name_ids = wasmExports2["hb_ot_layout_feature_get_name_ids"];
    Module2["_hb_ot_layout_lookup_get_optical_bound"] = _hb_ot_layout_lookup_get_optical_bound = wasmExports2["hb_ot_layout_lookup_get_optical_bound"];
    Module2["_hb_ot_name_list_names"] = _hb_ot_name_list_names = wasmExports2["hb_ot_name_list_names"];
    Module2["_hb_ot_name_get_utf16"] = _hb_ot_name_get_utf16 = wasmExports2["hb_ot_name_get_utf16"];
    Module2["_hb_set_create"] = _hb_set_create = wasmExports2["hb_set_create"];
    Module2["_hb_set_destroy"] = _hb_set_destroy = wasmExports2["hb_set_destroy"];
    Module2["_hb_ot_tag_to_script"] = _hb_ot_tag_to_script = wasmExports2["hb_ot_tag_to_script"];
    Module2["_hb_ot_tag_to_language"] = _hb_ot_tag_to_language = wasmExports2["hb_ot_tag_to_language"];
    Module2["_hb_ot_var_get_axis_infos"] = _hb_ot_var_get_axis_infos = wasmExports2["hb_ot_var_get_axis_infos"];
    Module2["_hb_set_get_population"] = _hb_set_get_population = wasmExports2["hb_set_get_population"];
    Module2["_hb_set_next_many"] = _hb_set_next_many = wasmExports2["hb_set_next_many"];
    Module2["_hb_shape"] = _hb_shape = wasmExports2["hb_shape"];
    __emscripten_timeout = wasmExports2["_emscripten_timeout"];
    __emscripten_stack_restore = wasmExports2["_emscripten_stack_restore"];
    __emscripten_stack_alloc = wasmExports2["_emscripten_stack_alloc"];
    _emscripten_stack_get_current = wasmExports2["emscripten_stack_get_current"];
  }
  var wasmImports = { _abort_js: __abort_js, _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear, _setitimer_js: __setitimer_js, emscripten_resize_heap: _emscripten_resize_heap, proc_exit: _proc_exit };
  var wasmExports = await createWasm();
  function run() {
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    preRun();
    if (runDependencies > 0) {
      dependenciesFulfilled = run;
      return;
    }
    function doRun() {
      Module2["calledRun"] = true;
      if (ABORT) return;
      initRuntime();
      readyPromiseResolve?.(Module2);
      Module2["onRuntimeInitialized"]?.();
      postRun();
    }
    if (Module2["setStatus"]) {
      Module2["setStatus"]("Running...");
      setTimeout(() => {
        setTimeout(() => Module2["setStatus"](""), 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  function preInit() {
    if (Module2["preInit"]) {
      if (typeof Module2["preInit"] == "function") Module2["preInit"] = [Module2["preInit"]];
      while (Module2["preInit"].length > 0) {
        Module2["preInit"].shift()();
      }
    }
  }
  preInit();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module2;
  } else {
    moduleRtn = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
  }
  ;
  return moduleRtn;
}
var harfbuzz_default = createHarfBuzz;

// node_modules/harfbuzzjs/dist/index.mjs
var Module;
var exports;
var freeFuncPtr;
var utf8Decoder = new TextDecoder("utf8");
var utf8Encoder = new TextEncoder();
var registry = new FinalizationRegistry((cleanup) => {
  cleanup();
});
function track(obj, destroy) {
  const ptr = obj.ptr;
  registry.register(obj, () => destroy(ptr));
}
function init(module) {
  Module = module;
  exports = Module.wasmExports;
  freeFuncPtr = Module.addFunction((ptr) => {
    exports.free(ptr);
  }, "vi");
}
function hb_tag(s) {
  return (s.charCodeAt(0) & 255) << 24 | (s.charCodeAt(1) & 255) << 16 | (s.charCodeAt(2) & 255) << 8 | (s.charCodeAt(3) & 255) << 0;
}
function hb_untag(tag) {
  return [
    String.fromCharCode(tag >> 24 & 255),
    String.fromCharCode(tag >> 16 & 255),
    String.fromCharCode(tag >> 8 & 255),
    String.fromCharCode(tag >> 0 & 255)
  ].join("");
}
function utf8_ptr_to_string(ptr, length) {
  let end;
  if (length == void 0) end = Module.HEAPU8.indexOf(0, ptr);
  else end = ptr + length;
  return utf8Decoder.decode(Module.HEAPU8.subarray(ptr, end));
}
function utf16_ptr_to_string(ptr, length) {
  const end = ptr / 2 + length;
  return String.fromCharCode(...Module.HEAPU16.subarray(ptr / 2, end));
}
function string_to_ascii_ptr(text) {
  const ptr = exports.malloc(text.length + 1);
  for (let i = 0; i < text.length; ++i) {
    const char = text.charCodeAt(i);
    if (char > 127) throw new Error("Expected ASCII text");
    Module.HEAPU8[ptr + i] = char;
  }
  Module.HEAPU8[ptr + text.length] = 0;
  return {
    ptr,
    length: text.length,
    free: function() {
      exports.free(ptr);
    }
  };
}
function string_to_utf8_ptr(text) {
  const ptr = exports.malloc(text.length);
  utf8Encoder.encodeInto(text, Module.HEAPU8.subarray(ptr, ptr + text.length));
  return {
    ptr,
    length: text.length,
    free: function() {
      exports.free(ptr);
    }
  };
}
function string_to_utf16_ptr(text) {
  const ptr = exports.malloc(text.length * 2);
  const words = Module.HEAPU16.subarray(ptr / 2, ptr / 2 + text.length);
  for (let i = 0; i < words.length; ++i) words[i] = text.charCodeAt(i);
  return {
    ptr,
    length: words.length,
    free: function() {
      exports.free(ptr);
    }
  };
}
function language_to_string(language) {
  return utf8_ptr_to_string(exports.hb_language_to_string(language));
}
function language_from_string(str) {
  const languageStr = string_to_ascii_ptr(str);
  const languagePtr = exports.hb_language_from_string(languageStr.ptr, -1);
  languageStr.free();
  return languagePtr;
}
function typed_array_from_set(setPtr) {
  const setCount = exports.hb_set_get_population(setPtr);
  const arrayPtr = exports.malloc(setCount << 2);
  const arrayOffset = arrayPtr >> 2;
  exports.hb_set_next_many(setPtr, -1, arrayPtr, setCount);
  return Module.HEAPU32.subarray(arrayOffset, arrayOffset + setCount);
}
var GlyphFlag = {
  UNSAFE_TO_BREAK: 1,
  UNSAFE_TO_CONCAT: 2,
  SAFE_TO_INSERT_TATWEEL: 4,
  DEFINED: 7
};
var Blob = class {
  /**
  * @param data Binary font data.
  */
  constructor(data) {
    const blobPtr = exports.malloc(data.byteLength);
    Module.HEAPU8.set(new Uint8Array(data), blobPtr);
    this.ptr = exports.hb_blob_create(blobPtr, data.byteLength, 2, blobPtr, freeFuncPtr);
    track(this, exports.hb_blob_destroy);
  }
};
var HB_OT_NAME_ID_INVALID = 65535;
var GlyphClass = {
  UNCLASSIFIED: 0,
  BASE_GLYPH: 1,
  LIGATURE: 2,
  MARK: 3,
  COMPONENT: 4
};
var Face = class {
  constructor(arg, index = 0) {
    if (typeof arg === "number") this.ptr = exports.hb_face_reference(arg);
    else this.ptr = exports.hb_face_create(arg.ptr, index);
    this.upem = exports.hb_face_get_upem(this.ptr);
    track(this, exports.hb_face_destroy);
  }
  /**
  * Return the binary contents of an OpenType table.
  * @param table Table name
  * @returns A Uint8Array of the table data, or undefined if the table is not found.
  */
  referenceTable(table) {
    const blob = exports.hb_face_reference_table(this.ptr, hb_tag(table));
    const length = exports.hb_blob_get_length(blob);
    if (!length) return;
    const blobptr = exports.hb_blob_get_data(blob, 0);
    return Module.HEAPU8.subarray(blobptr, blobptr + length);
  }
  /**
  * Return variation axis infos.
  * @returns A dictionary mapping axis tags to {min, default, max} values.
  */
  getAxisInfos() {
    const sp = Module.stackSave();
    const axis = Module.stackAlloc(2048);
    const c = Module.stackAlloc(4);
    Module.HEAPU32[c / 4] = 64;
    exports.hb_ot_var_get_axis_infos(this.ptr, 0, c, axis);
    const result = {};
    Array.from({ length: Module.HEAPU32[c / 4] }).forEach((_, i) => {
      result[hb_untag(Module.HEAPU32[axis / 4 + i * 8 + 1])] = {
        min: Module.HEAPF32[axis / 4 + i * 8 + 4],
        default: Module.HEAPF32[axis / 4 + i * 8 + 5],
        max: Module.HEAPF32[axis / 4 + i * 8 + 6]
      };
    });
    Module.stackRestore(sp);
    return result;
  }
  /**
  * Return unicodes the face supports.
  * @returns A Uint32Array of supported Unicode code points.
  */
  collectUnicodes() {
    const unicodeSetPtr = exports.hb_set_create();
    exports.hb_face_collect_unicodes(this.ptr, unicodeSetPtr);
    const result = typed_array_from_set(unicodeSetPtr);
    exports.hb_set_destroy(unicodeSetPtr);
    return result;
  }
  /**
  * Return all scripts enumerated in the specified face's
  * GSUB table or GPOS table.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @returns An array of 4-character script tag strings.
  */
  getTableScriptTags(table) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    let startOffset = 0;
    let scriptCount = 128;
    const scriptCountPtr = Module.stackAlloc(4);
    const scriptTagsPtr = Module.stackAlloc(512);
    const tags = [];
    while (scriptCount == 128) {
      Module.HEAPU32[scriptCountPtr / 4] = scriptCount;
      exports.hb_ot_layout_table_get_script_tags(this.ptr, tableTag, startOffset, scriptCountPtr, scriptTagsPtr);
      scriptCount = Module.HEAPU32[scriptCountPtr / 4];
      const scriptTags = Module.HEAPU32.subarray(scriptTagsPtr / 4, scriptTagsPtr / 4 + scriptCount);
      tags.push(...Array.from(scriptTags).map(hb_untag));
      startOffset += scriptCount;
    }
    Module.stackRestore(sp);
    return tags;
  }
  /**
  * Return all features enumerated in the specified face's
  * GSUB table or GPOS table.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @returns An array of 4-character feature tag strings.
  */
  getTableFeatureTags(table) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    let startOffset = 0;
    let featureCount = 128;
    const featureCountPtr = Module.stackAlloc(4);
    const featureTagsPtr = Module.stackAlloc(512);
    const tags = [];
    while (featureCount == 128) {
      Module.HEAPU32[featureCountPtr / 4] = featureCount;
      exports.hb_ot_layout_table_get_feature_tags(this.ptr, tableTag, startOffset, featureCountPtr, featureTagsPtr);
      featureCount = Module.HEAPU32[featureCountPtr / 4];
      const featureTags = Module.HEAPU32.subarray(featureTagsPtr / 4, featureTagsPtr / 4 + featureCount);
      tags.push(...Array.from(featureTags).map(hb_untag));
      startOffset += featureCount;
    }
    Module.stackRestore(sp);
    return tags;
  }
  /**
  * Return language tags in the given face's GSUB or GPOS table, underneath
  * the specified script index.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @param scriptIndex The index of the script to query.
  * @returns An array of 4-character language tag strings.
  */
  getScriptLanguageTags(table, scriptIndex) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    let startOffset = 0;
    let languageCount = 128;
    const languageCountPtr = Module.stackAlloc(4);
    const languageTagsPtr = Module.stackAlloc(512);
    const tags = [];
    while (languageCount == 128) {
      Module.HEAPU32[languageCountPtr / 4] = languageCount;
      exports.hb_ot_layout_script_get_language_tags(this.ptr, tableTag, scriptIndex, startOffset, languageCountPtr, languageTagsPtr);
      languageCount = Module.HEAPU32[languageCountPtr / 4];
      const languageTags = Module.HEAPU32.subarray(languageTagsPtr / 4, languageTagsPtr / 4 + languageCount);
      tags.push(...Array.from(languageTags).map(hb_untag));
      startOffset += languageCount;
    }
    Module.stackRestore(sp);
    return tags;
  }
  /**
  * Return all features in the specified face's GSUB table or GPOS table,
  * underneath the specified script and language.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @param scriptIndex The index of the script to query.
  * @param languageIndex The index of the language to query.
  * @returns An array of 4-character feature tag strings.
  */
  getLanguageFeatureTags(table, scriptIndex, languageIndex) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    let startOffset = 0;
    let featureCount = 128;
    const featureCountPtr = Module.stackAlloc(4);
    const featureTagsPtr = Module.stackAlloc(512);
    const tags = [];
    while (featureCount == 128) {
      Module.HEAPU32[featureCountPtr / 4] = featureCount;
      exports.hb_ot_layout_language_get_feature_tags(this.ptr, tableTag, scriptIndex, languageIndex, startOffset, featureCountPtr, featureTagsPtr);
      featureCount = Module.HEAPU32[featureCountPtr / 4];
      const featureTags = Module.HEAPU32.subarray(featureTagsPtr / 4, featureTagsPtr / 4 + featureCount);
      tags.push(...Array.from(featureTags).map(hb_untag));
      startOffset += featureCount;
    }
    Module.stackRestore(sp);
    return tags;
  }
  /**
  * Fetches a list of all lookups enumerated for the specified feature, in
  * the specified face's GSUB table or GPOS table.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @param featureIndex The index of the requested feature.
  * @returns An array of lookup indexes.
  */
  getFeatureLookups(table, featureIndex) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    let startOffset = 0;
    let lookupCount = 128;
    const lookupCountPtr = Module.stackAlloc(4);
    const lookupIndexesPtr = Module.stackAlloc(512);
    const lookups = [];
    while (lookupCount == 128) {
      Module.HEAPU32[lookupCountPtr / 4] = lookupCount;
      exports.hb_ot_layout_feature_get_lookups(this.ptr, tableTag, featureIndex, startOffset, lookupCountPtr, lookupIndexesPtr);
      lookupCount = Module.HEAPU32[lookupCountPtr / 4];
      const lookupIndexes = Module.HEAPU32.subarray(lookupIndexesPtr / 4, lookupIndexesPtr / 4 + lookupCount);
      lookups.push(...Array.from(lookupIndexes));
      startOffset += lookupCount;
    }
    Module.stackRestore(sp);
    return lookups;
  }
  /**
  * Get the GDEF class of the requested glyph.
  * @param glyph The glyph to get the class of.
  * @returns The {@link GlyphClass} of the glyph.
  */
  getGlyphClass(glyph) {
    return exports.hb_ot_layout_get_glyph_class(this.ptr, glyph);
  }
  /**
  * Return all names in the specified face's name table.
  * @returns An array of {nameId, language} entries.
  */
  listNames() {
    const sp = Module.stackSave();
    const numEntriesPtr = Module.stackAlloc(4);
    const entriesPtr = exports.hb_ot_name_list_names(this.ptr, numEntriesPtr);
    const numEntries = Module.HEAPU32[numEntriesPtr / 4];
    const entries = [];
    for (let i = 0; i < numEntries; i++) entries.push({
      nameId: Module.HEAPU32[entriesPtr / 4 + i * 3],
      language: language_to_string(Module.HEAPU32[entriesPtr / 4 + i * 3 + 2])
    });
    Module.stackRestore(sp);
    return entries;
  }
  /**
  * Get the name of the specified face.
  * @param nameId The ID of the name to get.
  * @param language The language of the name to get.
  * @returns The name string.
  */
  getName(nameId, language) {
    const sp = Module.stackSave();
    const languagePtr = language_from_string(language);
    const nameLen = exports.hb_ot_name_get_utf16(this.ptr, nameId, languagePtr, 0, 0) + 1;
    const textSizePtr = Module.stackAlloc(4);
    const textPtr = exports.malloc(nameLen * 2);
    Module.HEAPU32[textSizePtr / 4] = nameLen;
    exports.hb_ot_name_get_utf16(this.ptr, nameId, languagePtr, textSizePtr, textPtr);
    const name = utf16_ptr_to_string(textPtr, nameLen - 1);
    exports.free(textPtr);
    Module.stackRestore(sp);
    return name;
  }
  /**
  * Get the name IDs of the specified feature.
  * @param table The table to query, either "GSUB" or "GPOS".
  * @param featureIndex The index of the feature to query.
  * @returns An object with name IDs, or undefined if not found.
  */
  getFeatureNameIds(table, featureIndex) {
    const sp = Module.stackSave();
    const tableTag = hb_tag(table);
    const labelIdPtr = Module.stackAlloc(4);
    const tooltipIdPtr = Module.stackAlloc(4);
    const sampleIdPtr = Module.stackAlloc(4);
    const numNamedParametersPtr = Module.stackAlloc(4);
    const firstParameterIdPtr = Module.stackAlloc(4);
    const found = exports.hb_ot_layout_feature_get_name_ids(this.ptr, tableTag, featureIndex, labelIdPtr, tooltipIdPtr, sampleIdPtr, numNamedParametersPtr, firstParameterIdPtr);
    let names;
    if (found) {
      const uiLabelNameId = Module.HEAPU32[labelIdPtr / 4];
      const uiTooltipTextNameId = Module.HEAPU32[tooltipIdPtr / 4];
      const sampleTextNameId = Module.HEAPU32[sampleIdPtr / 4];
      const numNamedParameters = Module.HEAPU32[numNamedParametersPtr / 4];
      const firstParameterId = Module.HEAPU32[firstParameterIdPtr / 4];
      names = { paramUiLabelNameIds: Array.from({ length: numNamedParameters }, (_, i) => firstParameterId + i) };
      if (uiLabelNameId != HB_OT_NAME_ID_INVALID) names.uiLabelNameId = uiLabelNameId;
      if (uiTooltipTextNameId != HB_OT_NAME_ID_INVALID) names.uiTooltipTextNameId = uiTooltipTextNameId;
      if (sampleTextNameId != HB_OT_NAME_ID_INVALID) names.sampleTextNameId = sampleTextNameId;
    }
    Module.stackRestore(sp);
    return names;
  }
};
var Font = class Font2 {
  constructor(arg) {
    this.drawPtrs = { pathBuffer: "" };
    if (typeof arg === "number") this.ptr = exports.hb_font_reference(arg);
    else {
      this.ptr = exports.hb_font_create(arg.ptr);
      this._face = arg;
    }
    const ptr = this.ptr;
    const drawState = this.drawPtrs;
    registry.register(this, () => {
      exports.hb_font_destroy(ptr);
      if (drawState.drawFuncsPtr) {
        exports.hb_draw_funcs_destroy(drawState.drawFuncsPtr);
        Module.removeFunction(drawState.moveToPtr);
        Module.removeFunction(drawState.lineToPtr);
        Module.removeFunction(drawState.cubicToPtr);
        Module.removeFunction(drawState.quadToPtr);
        Module.removeFunction(drawState.closePathPtr);
      }
    });
  }
  /** The {@link Face} associated with this font. */
  get face() {
    if (!this._face) this._face = new Face(exports.hb_font_get_face(this.ptr));
    return this._face;
  }
  /**
  * Create a sub font that inherits this font's properties.
  * @returns A new Font object representing the sub font.
  */
  subFont() {
    return new Font2(exports.hb_font_create_sub_font(this.ptr));
  }
  /**
  * Return font horizontal extents.
  * @returns Object with ascender, descender, and lineGap properties.
  */
  hExtents() {
    const sp = Module.stackSave();
    const extentsPtr = Module.stackAlloc(48);
    exports.hb_font_get_h_extents(this.ptr, extentsPtr);
    const extents = {
      ascender: Module.HEAP32[extentsPtr / 4],
      descender: Module.HEAP32[extentsPtr / 4 + 1],
      lineGap: Module.HEAP32[extentsPtr / 4 + 2]
    };
    Module.stackRestore(sp);
    return extents;
  }
  /**
  * Return font vertical extents.
  * @returns Object with ascender, descender, and lineGap properties.
  */
  vExtents() {
    const sp = Module.stackSave();
    const extentsPtr = Module.stackAlloc(48);
    exports.hb_font_get_v_extents(this.ptr, extentsPtr);
    const extents = {
      ascender: Module.HEAP32[extentsPtr / 4],
      descender: Module.HEAP32[extentsPtr / 4 + 1],
      lineGap: Module.HEAP32[extentsPtr / 4 + 2]
    };
    Module.stackRestore(sp);
    return extents;
  }
  /**
  * Return glyph name.
  * @param glyphId ID of the requested glyph in the font.
  * @returns The glyph name string.
  */
  glyphName(glyphId) {
    const sp = Module.stackSave();
    const strSize = 256;
    const strPtr = Module.stackAlloc(strSize);
    exports.hb_font_glyph_to_string(this.ptr, glyphId, strPtr, strSize);
    const name = utf8_ptr_to_string(strPtr);
    Module.stackRestore(sp);
    return name;
  }
  /**
  * Return a glyph as an SVG path string.
  * @param glyphId ID of the requested glyph in the font.
  * @returns SVG path data string.
  */
  glyphToPath(glyphId) {
    const ds = this.drawPtrs;
    if (!ds.drawFuncsPtr) {
      const moveTo = (dfuncs, draw_data, draw_state, to_x, to_y, user_data) => {
        ds.pathBuffer += `M${to_x},${to_y}`;
      };
      const lineTo = (dfuncs, draw_data, draw_state, to_x, to_y, user_data) => {
        ds.pathBuffer += `L${to_x},${to_y}`;
      };
      const cubicTo = (dfuncs, draw_data, draw_state, c1_x, c1_y, c2_x, c2_y, to_x, to_y, user_data) => {
        ds.pathBuffer += `C${c1_x},${c1_y} ${c2_x},${c2_y} ${to_x},${to_y}`;
      };
      const quadTo = (dfuncs, draw_data, draw_state, c_x, c_y, to_x, to_y, user_data) => {
        ds.pathBuffer += `Q${c_x},${c_y} ${to_x},${to_y}`;
      };
      const closePath = (dfuncs, draw_data, draw_state, user_data) => {
        ds.pathBuffer += "Z";
      };
      ds.moveToPtr = Module.addFunction(moveTo, "viiiffi");
      ds.lineToPtr = Module.addFunction(lineTo, "viiiffi");
      ds.cubicToPtr = Module.addFunction(cubicTo, "viiiffffffi");
      ds.quadToPtr = Module.addFunction(quadTo, "viiiffffi");
      ds.closePathPtr = Module.addFunction(closePath, "viiii");
      ds.drawFuncsPtr = exports.hb_draw_funcs_create();
      exports.hb_draw_funcs_set_move_to_func(ds.drawFuncsPtr, ds.moveToPtr, 0, 0);
      exports.hb_draw_funcs_set_line_to_func(ds.drawFuncsPtr, ds.lineToPtr, 0, 0);
      exports.hb_draw_funcs_set_cubic_to_func(ds.drawFuncsPtr, ds.cubicToPtr, 0, 0);
      exports.hb_draw_funcs_set_quadratic_to_func(ds.drawFuncsPtr, ds.quadToPtr, 0, 0);
      exports.hb_draw_funcs_set_close_path_func(ds.drawFuncsPtr, ds.closePathPtr, 0, 0);
    }
    ds.pathBuffer = "";
    exports.hb_font_draw_glyph(this.ptr, glyphId, ds.drawFuncsPtr, 0);
    return ds.pathBuffer;
  }
  /**
  * Return glyph horizontal advance.
  * @param glyphId ID of the requested glyph in the font.
  * @returns The horizontal advance width.
  */
  glyphHAdvance(glyphId) {
    return exports.hb_font_get_glyph_h_advance(this.ptr, glyphId);
  }
  /**
  * Return glyph vertical advance.
  * @param glyphId ID of the requested glyph in the font.
  * @returns The vertical advance height.
  */
  glyphVAdvance(glyphId) {
    return exports.hb_font_get_glyph_v_advance(this.ptr, glyphId);
  }
  /**
  * Return glyph horizontal origin.
  * @param glyphId ID of the requested glyph in the font.
  * @returns [x, y] origin coordinates, or undefined if not available.
  */
  glyphHOrigin(glyphId) {
    const sp = Module.stackSave();
    const xPtr = Module.stackAlloc(4);
    const yPtr = Module.stackAlloc(4);
    let origin;
    if (exports.hb_font_get_glyph_h_origin(this.ptr, glyphId, xPtr, yPtr)) origin = [Module.HEAP32[xPtr / 4], Module.HEAP32[yPtr / 4]];
    Module.stackRestore(sp);
    return origin;
  }
  /**
  * Return glyph vertical origin.
  * @param glyphId ID of the requested glyph in the font.
  * @returns [x, y] origin coordinates, or undefined if not available.
  */
  glyphVOrigin(glyphId) {
    const sp = Module.stackSave();
    const xPtr = Module.stackAlloc(4);
    const yPtr = Module.stackAlloc(4);
    let origin;
    if (exports.hb_font_get_glyph_v_origin(this.ptr, glyphId, xPtr, yPtr)) origin = [Module.HEAP32[xPtr / 4], Module.HEAP32[yPtr / 4]];
    Module.stackRestore(sp);
    return origin;
  }
  /**
  * Return glyph extents.
  * @param glyphId ID of the requested glyph in the font.
  * @returns An object with xBearing, yBearing, width, and height, or undefined.
  */
  glyphExtents(glyphId) {
    const sp = Module.stackSave();
    const extentsPtr = Module.stackAlloc(16);
    let extents;
    if (exports.hb_font_get_glyph_extents(this.ptr, glyphId, extentsPtr)) extents = {
      xBearing: Module.HEAP32[extentsPtr / 4],
      yBearing: Module.HEAP32[extentsPtr / 4 + 1],
      width: Module.HEAP32[extentsPtr / 4 + 2],
      height: Module.HEAP32[extentsPtr / 4 + 3]
    };
    Module.stackRestore(sp);
    return extents;
  }
  /**
  * Fetches the glyph ID for a Unicode code point in the specified
  * font, with an optional variation selector.
  *
  * If `variationSelector` is 0, it is equivalent to
  * {@link Font.nominalGlyph}; otherwise it is equivalent to
  * {@link Font.variationGlyph}.
  *
  * @param unicode The Unicode code point to query.
  * @param variationSelector A variation-selector code point.
  * @returns The glyph ID, or undefined if not found.
  */
  glyph(unicode, variationSelector = 0) {
    const sp = Module.stackSave();
    const glyphIdPtr = Module.stackAlloc(4);
    let glyphId;
    if (exports.hb_font_get_glyph(this.ptr, unicode, variationSelector, glyphIdPtr)) glyphId = Module.HEAPU32[glyphIdPtr / 4];
    Module.stackRestore(sp);
    return glyphId;
  }
  /**
  * Fetches the nominal glyph ID for a Unicode code point in the
  * specified font.
  *
  * This version of the function should not be used to fetch glyph IDs
  * for code points modified by variation selectors. For variation-selector
  * support, use {@link Font.variationGlyph} or {@link Font.glyph}.
  *
  * @param unicode The Unicode code point to query.
  * @returns The glyph ID, or undefined if not found.
  */
  nominalGlyph(unicode) {
    const sp = Module.stackSave();
    const glyphIdPtr = Module.stackAlloc(4);
    let glyphId;
    if (exports.hb_font_get_nominal_glyph(this.ptr, unicode, glyphIdPtr)) glyphId = Module.HEAPU32[glyphIdPtr / 4];
    Module.stackRestore(sp);
    return glyphId;
  }
  /**
  * Fetches the glyph ID for a Unicode code point when followed by
  * by the specified variation-selector code point, in the specified
  * font.
  *
  * @param unicode The Unicode code point to query.
  * @param variationSelector The variation-selector code point to query.
  * @returns The glyph ID, or undefined if not found.
  */
  variationGlyph(unicode, variationSelector) {
    const sp = Module.stackSave();
    const glyphIdPtr = Module.stackAlloc(4);
    let glyphId;
    if (exports.hb_font_get_variation_glyph(this.ptr, unicode, variationSelector, glyphIdPtr)) glyphId = Module.HEAPU32[glyphIdPtr / 4];
    Module.stackRestore(sp);
    return glyphId;
  }
  /**
  * Return glyph ID from name.
  * @param name Name of the requested glyph in the font.
  * @returns The glyph ID, or undefined if not found.
  */
  glyphFromName(name) {
    const sp = Module.stackSave();
    const glyphIdPtr = Module.stackAlloc(4);
    const namePtr = string_to_utf8_ptr(name);
    let glyphId;
    if (exports.hb_font_get_glyph_from_name(this.ptr, namePtr.ptr, namePtr.length, glyphIdPtr)) glyphId = Module.HEAPU32[glyphIdPtr / 4];
    namePtr.free();
    Module.stackRestore(sp);
    return glyphId;
  }
  /**
  * Return a glyph as a JSON path string
  * based on format described on https://svgwg.org/specs/paths/#InterfaceSVGPathSegment
  * @param glyphId ID of the requested glyph in the font.
  * @returns An array of path segment objects with type and values.
  */
  glyphToJson(glyphId) {
    return this.glyphToPath(glyphId).replace(/([MLQCZ])/g, "|$1 ").split("|").filter((x) => x.length).map((x) => {
      const [type, ...values] = x.split(/[ ,]/g).filter((s) => s.length);
      return {
        type,
        values: values.map(Number)
      };
    });
  }
  /**
  * Set the font's scale factor, affecting the position values returned from
  * shaping.
  * @param xScale Units to scale in the X dimension.
  * @param yScale Units to scale in the Y dimension.
  */
  setScale(xScale, yScale) {
    exports.hb_font_set_scale(this.ptr, xScale, yScale);
  }
  /**
  * Applies a list of font-variation settings to a font.
  *
  * Note that this overrides all existing variations set on the font.
  * Axes not included in `variations` will be effectively set to their
  * default values.
  *
  * @param variations Array of variation settings to apply.
  */
  setVariations(variations) {
    const sp = Module.stackSave();
    const vars = Module.stackAlloc(8 * variations.length);
    variations.forEach((variation, i) => {
      variation.writeTo(vars + i * 8);
    });
    exports.hb_font_set_variations(this.ptr, vars, variations.length);
    Module.stackRestore(sp);
  }
  /** Set the font's font functions. */
  setFuncs(fontFuncs) {
    exports.hb_font_set_funcs(this.ptr, fontFuncs.ptr);
  }
  /**
  * Fetches the optical bound of a glyph positioned at the margin of text.
  * The direction identifies which edge of the glyph to query.
  * @param lookupIndex Index of the feature lookup to query.
  * @param direction Edge of the glyph to query.
  * @param glyph A glyph id.
  * @returns Adjustment value. Negative values mean the glyph will stick out of the margin.
  */
  getLookupOpticalBound(lookupIndex, direction, glyph) {
    return exports.hb_ot_layout_lookup_get_optical_bound(this.ptr, lookupIndex, direction, glyph);
  }
};
var FontFuncs = class {
  constructor() {
    this.ptr = exports.hb_font_funcs_create();
    track(this, exports.hb_font_funcs_destroy);
  }
  /**
  * Set the font's glyph extents function.
  * @param func The callback receives a Font and glyph ID. It should return
  * an object with xBearing, yBearing, width, and height, or undefined on failure.
  */
  setGlyphExtentsFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, extentsPtr, user_data) => {
      const extents = func(new Font(fontPtr), glyph);
      if (extents) {
        Module.HEAP32[extentsPtr / 4] = extents.xBearing;
        Module.HEAP32[extentsPtr / 4 + 1] = extents.yBearing;
        Module.HEAP32[extentsPtr / 4 + 2] = extents.width;
        Module.HEAP32[extentsPtr / 4 + 3] = extents.height;
        return 1;
      }
      return 0;
    }, "ippipp");
    exports.hb_font_funcs_set_glyph_extents_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph from name function.
  * @param func The callback receives a Font and glyph name. It should return
  * the glyph ID, or undefined on failure.
  */
  setGlyphFromNameFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, namePtr, len, glyphPtr, user_data) => {
      const glyph = func(new Font(fontPtr), utf8_ptr_to_string(namePtr, len));
      if (glyph) {
        Module.HEAPU32[glyphPtr / 4] = glyph;
        return 1;
      }
      return 0;
    }, "ipppipp");
    exports.hb_font_funcs_set_glyph_from_name_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph horizontal advance function.
  * @param func The callback receives a Font and glyph ID. It should return
  * the horizontal advance of the glyph.
  */
  setGlyphHAdvanceFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, user_data) => {
      return func(new Font(fontPtr), glyph);
    }, "ippip");
    exports.hb_font_funcs_set_glyph_h_advance_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph vertical advance function.
  * @param func The callback receives a Font and glyph ID. It should return
  * the vertical advance of the glyph.
  */
  setGlyphVAdvanceFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, user_data) => {
      return func(new Font(fontPtr), glyph);
    }, "ippip");
    exports.hb_font_funcs_set_glyph_v_advance_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph horizontal origin function.
  * @param func The callback receives a Font and glyph ID. It should return
  * the [x, y] horizontal origin of the glyph, or undefined on failure.
  */
  setGlyphHOriginFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, xPtr, yPtr, user_data) => {
      const origin = func(new Font(fontPtr), glyph);
      if (origin) {
        Module.HEAP32[xPtr / 4] = origin[0];
        Module.HEAP32[yPtr / 4] = origin[1];
        return 1;
      }
      return 0;
    }, "ippippp");
    exports.hb_font_funcs_set_glyph_h_origin_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph vertical origin function.
  * @param func The callback receives a Font and glyph ID. It should return
  * the [x, y] vertical origin of the glyph, or undefined on failure.
  */
  setGlyphVOriginFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, xPtr, yPtr, user_data) => {
      const origin = func(new Font(fontPtr), glyph);
      if (origin) {
        Module.HEAP32[xPtr / 4] = origin[0];
        Module.HEAP32[yPtr / 4] = origin[1];
        return 1;
      }
      return 0;
    }, "ippippp");
    exports.hb_font_funcs_set_glyph_v_origin_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph horizontal kerning function.
  * @param func The callback receives a Font, first glyph ID, and second glyph ID.
  * It should return the horizontal kerning of the glyphs.
  */
  setGlyphHKerningFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, firstGlyph, secondGlyph, user_data) => {
      return func(new Font(fontPtr), firstGlyph, secondGlyph);
    }, "ippiip");
    exports.hb_font_funcs_set_glyph_h_kerning_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's glyph name function.
  * @param func The callback receives a Font and glyph ID. It should return
  * the name of the glyph, or undefined on failure.
  */
  setGlyphNameFunc(func) {
    const utf8Encoder2 = new TextEncoder();
    const funcPtr = Module.addFunction((fontPtr, font_data, glyph, namePtr, size, user_data) => {
      const name = func(new Font(fontPtr), glyph);
      if (name) {
        utf8Encoder2.encodeInto(name, Module.HEAPU8.subarray(namePtr, namePtr + size));
        return 1;
      }
      return 0;
    }, "ippipip");
    exports.hb_font_funcs_set_glyph_name_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's nominal glyph function.
  * @param func The callback receives a Font and unicode code point. It should
  * return the nominal glyph of the unicode, or undefined on failure.
  */
  setNominalGlyphFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, unicode, glyphPtr, user_data) => {
      const glyph = func(new Font(fontPtr), unicode);
      if (glyph) {
        Module.HEAPU32[glyphPtr / 4] = glyph;
        return 1;
      }
      return 0;
    }, "ippipp");
    exports.hb_font_funcs_set_nominal_glyph_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's variation glyph function.
  * @param func The callback receives a Font, unicode code point, and variation
  * selector. It should return the variation glyph, or undefined on failure.
  */
  setVariationGlyphFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, unicode, variationSelector, glyphPtr, user_data) => {
      const glyph = func(new Font(fontPtr), unicode, variationSelector);
      if (glyph) {
        Module.HEAPU32[glyphPtr / 4] = glyph;
        return 1;
      }
      return 0;
    }, "ippiipp");
    exports.hb_font_funcs_set_variation_glyph_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's horizontal extents function.
  * @param func The callback receives a Font. It should return an object with
  * ascender, descender, and lineGap, or undefined on failure.
  */
  setFontHExtentsFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, extentsPtr, user_data) => {
      const extents = func(new Font(fontPtr));
      if (extents) {
        Module.HEAP32[extentsPtr / 4] = extents.ascender;
        Module.HEAP32[extentsPtr / 4 + 1] = extents.descender;
        Module.HEAP32[extentsPtr / 4 + 2] = extents.lineGap;
        return 1;
      }
      return 0;
    }, "ipppp");
    exports.hb_font_funcs_set_font_h_extents_func(this.ptr, funcPtr, 0, 0);
  }
  /**
  * Set the font's vertical extents function.
  * @param func The callback receives a Font. It should return an object with
  * ascender, descender, and lineGap, or undefined on failure.
  */
  setFontVExtentsFunc(func) {
    const funcPtr = Module.addFunction((fontPtr, font_data, extentsPtr, user_data) => {
      const extents = func(new Font(fontPtr));
      if (extents) {
        Module.HEAP32[extentsPtr / 4] = extents.ascender;
        Module.HEAP32[extentsPtr / 4 + 1] = extents.descender;
        Module.HEAP32[extentsPtr / 4 + 2] = extents.lineGap;
        return 1;
      }
      return 0;
    }, "ipppp");
    exports.hb_font_funcs_set_font_v_extents_func(this.ptr, funcPtr, 0, 0);
  }
};
var BufferContentType = {
  INVALID: 0,
  UNICODE: 1,
  GLYPHS: 2
};
var BufferSerializeFlag = {
  DEFAULT: 0,
  NO_CLUSTERS: 1,
  NO_POSITIONS: 2,
  NO_GLYPH_NAMES: 4,
  GLYPH_EXTENTS: 8,
  GLYPH_FLAGS: 16,
  NO_ADVANCES: 32,
  DEFINED: 63
};
var BufferFlag = {
  DEFAULT: 0,
  BOT: 1,
  EOT: 2,
  PRESERVE_DEFAULT_IGNORABLES: 4,
  REMOVE_DEFAULT_IGNORABLES: 8,
  DO_NOT_INSERT_DOTTED_CIRCLE: 16,
  VERIFY: 32,
  PRODUCE_UNSAFE_TO_CONCAT: 64,
  PRODUCE_SAFE_TO_INSERT_TATWEEL: 128,
  DEFINED: 255
};
var Direction = {
  INVALID: 0,
  LTR: 4,
  RTL: 5,
  TTB: 6,
  BTT: 7
};
var ClusterLevel = {
  MONOTONE_GRAPHEMES: 0,
  MONOTONE_CHARACTERS: 1,
  CHARACTERS: 2,
  GRAPHEMES: 3,
  DEFAULT: 0
};
var BufferSerializeFormat = {
  INVALID: 0,
  TEXT: hb_tag("TEXT"),
  JSON: hb_tag("JSON")
};
var Buffer2 = class Buffer3 {
  /**
  * @param existingPtr @internal Wrap an existing buffer pointer.
  */
  constructor(existingPtr) {
    if (existingPtr != void 0) this.ptr = exports.hb_buffer_reference(existingPtr);
    else this.ptr = exports.hb_buffer_create();
    track(this, exports.hb_buffer_destroy);
  }
  /**
  * Appends a character with the Unicode value of `codePoint` to the buffer,
  * and gives it the initial cluster value of `cluster`. Clusters can be any
  * thing the client wants, they are usually used to refer to the index of the
  * character in the input text stream and are output in the `cluster` field
  * of {@link GlyphInfo}.
  *
  * This function does not check the validity of `codePoint`, it is up to the
  * caller to ensure it is a valid Unicode code point.
  * @param codePoint A Unicode code point.
  * @param cluster The cluster value of `codePoint`.
  */
  add(codePoint, cluster) {
    exports.hb_buffer_add(this.ptr, codePoint, cluster);
  }
  /**
  * Add text to the buffer.
  * @param text Text to be added to the buffer.
  * @param itemOffset The offset of the first character to add to the buffer.
  * @param itemLength The number of characters to add to the buffer, or omit for the end of text.
  */
  addText(text, itemOffset = 0, itemLength) {
    const str = string_to_utf16_ptr(text);
    exports.hb_buffer_add_utf16(this.ptr, str.ptr, str.length, itemOffset, itemLength ?? str.length);
    str.free();
  }
  /**
  * Add code points to the buffer.
  * @param codePoints Array of code points to be added to the buffer.
  * @param itemOffset The offset of the first code point to add to the buffer.
  * @param itemLength The number of code points to add to the buffer, or omit for the end of the array.
  */
  addCodePoints(codePoints, itemOffset = 0, itemLength) {
    const codePointsPtr = exports.malloc(codePoints.length * 4);
    Module.HEAPU32.subarray(codePointsPtr / 4, codePointsPtr / 4 + codePoints.length).set(codePoints);
    exports.hb_buffer_add_codepoints(this.ptr, codePointsPtr, codePoints.length, itemOffset, itemLength ?? codePoints.length);
    exports.free(codePointsPtr);
  }
  /**
  * Set buffer script, language and direction.
  *
  * This needs to be done before shaping.
  */
  guessSegmentProperties() {
    exports.hb_buffer_guess_segment_properties(this.ptr);
  }
  /**
  * Set buffer direction explicitly.
  * @param dir A {@link Direction} value.
  */
  setDirection(dir) {
    exports.hb_buffer_set_direction(this.ptr, dir);
  }
  /**
  * Set buffer flags explicitly.
  * @param flags A combination of {@link BufferFlag} values (OR them together).
  */
  setFlags(flags) {
    exports.hb_buffer_set_flags(this.ptr, flags);
  }
  /**
  * Set buffer language explicitly.
  * @param language The buffer language
  */
  setLanguage(language) {
    const str = string_to_ascii_ptr(language);
    exports.hb_buffer_set_language(this.ptr, exports.hb_language_from_string(str.ptr, -1));
    str.free();
  }
  /**
  * Set buffer script explicitly.
  * @param script The buffer script
  */
  setScript(script) {
    const str = string_to_ascii_ptr(script);
    exports.hb_buffer_set_script(this.ptr, exports.hb_script_from_string(str.ptr, -1));
    str.free();
  }
  /**
  * Set the HarfBuzz clustering level.
  *
  * Affects the cluster values returned from shaping.
  * @param level A {@link ClusterLevel} value. See the HarfBuzz manual chapter on Clusters.
  */
  setClusterLevel(level) {
    exports.hb_buffer_set_cluster_level(this.ptr, level);
  }
  /** Reset the buffer to its initial status. */
  reset() {
    exports.hb_buffer_reset(this.ptr);
  }
  /**
  * Similar to reset(), but does not clear the Unicode functions and the
  * replacement code point.
  */
  clearContents() {
    exports.hb_buffer_clear_contents(this.ptr);
  }
  /**
  * Set message func.
  * @param func The function to set. It receives the buffer, font, and message
  * string as arguments. Returning false will skip this shaping step and move
  * to the next one.
  */
  setMessageFunc(func) {
    const traceFunc = (bufferPtr, fontPtr, messagePtr, user_data) => {
      const message = utf8_ptr_to_string(messagePtr);
      return func(new Buffer3(bufferPtr), new Font(fontPtr), message) ? 1 : 0;
    };
    const traceFuncPtr = Module.addFunction(traceFunc, "iiiii");
    exports.hb_buffer_set_message_func(this.ptr, traceFuncPtr, 0, 0);
  }
  /**
  * Get the the number of items in the buffer.
  * @returns The buffer length.
  */
  getLength() {
    return exports.hb_buffer_get_length(this.ptr);
  }
  /**
  * Get the glyph information from the buffer.
  * @returns An array of {@link GlyphInfo} objects.
  */
  getGlyphInfos() {
    const infosPtr = exports.hb_buffer_get_glyph_infos(this.ptr, 0);
    const infosArray = Module.HEAPU32.subarray(infosPtr / 4, infosPtr / 4 + this.getLength() * 5);
    const infos = [];
    for (let i = 0; i < infosArray.length; i += 5) infos.push({
      codepoint: infosArray[i],
      cluster: infosArray[i + 2],
      flags: exports.hb_glyph_info_get_glyph_flags(infosPtr + i * 4)
    });
    return infos;
  }
  /**
  * Get the glyph positions from the buffer.
  * @returns An array of {@link GlyphPosition} objects.
  */
  getGlyphPositions() {
    const positionsPtr32 = exports.hb_buffer_get_glyph_positions(this.ptr, 0) / 4;
    if (positionsPtr32 == 0) return [];
    const positionsArray = Module.HEAP32.subarray(positionsPtr32, positionsPtr32 + this.getLength() * 5);
    const positions = [];
    for (let i = 0; i < positionsArray.length; i += 5) positions.push({
      xAdvance: positionsArray[i],
      yAdvance: positionsArray[i + 1],
      xOffset: positionsArray[i + 2],
      yOffset: positionsArray[i + 3]
    });
    return positions;
  }
  /**
  * Get the glyph information and positions from the buffer.
  * @returns The glyph information and positions.
  *
  * The glyph information is returned as an array of objects with the
  * properties from getGlyphInfos and getGlyphPositions combined.
  */
  getGlyphInfosAndPositions() {
    const infosPtr = exports.hb_buffer_get_glyph_infos(this.ptr, 0);
    const infosArray = Module.HEAPU32.subarray(infosPtr / 4, infosPtr / 4 + this.getLength() * 5);
    const positionsPtr32 = exports.hb_buffer_get_glyph_positions(this.ptr, 0) / 4;
    const positionsArray = positionsPtr32 ? Module.HEAP32.subarray(positionsPtr32, positionsPtr32 + this.getLength() * 5) : void 0;
    const out = [];
    for (let i = 0; i < infosArray.length; i += 5) {
      const info = {
        codepoint: infosArray[i],
        cluster: infosArray[i + 2],
        flags: exports.hb_glyph_info_get_glyph_flags(infosPtr + i * 4)
      };
      for (const [name, idx] of [
        ["mask", 1],
        ["var1", 3],
        ["var2", 4]
      ]) Object.defineProperty(info, name, {
        value: infosArray[i + idx],
        enumerable: false
      });
      if (positionsArray) {
        info.xAdvance = positionsArray[i];
        info.yAdvance = positionsArray[i + 1];
        info.xOffset = positionsArray[i + 2];
        info.yOffset = positionsArray[i + 3];
        Object.defineProperty(info, "var", {
          value: positionsArray[i + 4],
          enumerable: false
        });
      }
      out.push(info);
    }
    return out;
  }
  /**
  * Update the glyph positions in the buffer.
  * WARNING: Do not use unless you know what you are doing.
  */
  updateGlyphPositions(positions) {
    const positionsPtr32 = exports.hb_buffer_get_glyph_positions(this.ptr, 0) / 4;
    if (positionsPtr32 == 0) return;
    const len = Math.min(positions.length, this.getLength());
    const positionsArray = Module.HEAP32.subarray(positionsPtr32, positionsPtr32 + len * 5);
    for (let i = 0; i < len; i++) {
      positionsArray[i * 5] = positions[i].xAdvance;
      positionsArray[i * 5 + 1] = positions[i].yAdvance;
      positionsArray[i * 5 + 2] = positions[i].xOffset;
      positionsArray[i * 5 + 3] = positions[i].yOffset;
    }
  }
  /**
  * Serialize the buffer contents to a string.
  * @param options Serialization options:
  *  - `font`: the font to use for serialization;
  *  - `start`: the starting index of the glyphs (default `0`);
  *  - `end`: the ending index of the glyphs (default end of buffer);
  *  - `format`: a {@link BufferSerializeFormat} value (default `TEXT`);
  *  - `flags`: a combination of {@link BufferSerializeFlag} values (default `0`).
  * @returns The serialized buffer contents.
  */
  serialize(options = {}) {
    let { font, start = 0, end, format = BufferSerializeFormat.TEXT, flags = 0 } = options;
    const sp = Module.stackSave();
    const endPos = end ?? this.getLength();
    const bufLen = 32 * 1024;
    const bufPtr = exports.malloc(bufLen);
    const bufConsumedPtr = Module.stackAlloc(4);
    let result = "";
    while (start < endPos) {
      start += exports.hb_buffer_serialize(this.ptr, start, endPos, bufPtr, bufLen, bufConsumedPtr, font ? font.ptr : 0, format, flags);
      const bufConsumed = Module.HEAPU32[bufConsumedPtr / 4];
      if (bufConsumed == 0) break;
      result += utf8_ptr_to_string(bufPtr, bufConsumed);
    }
    exports.free(bufPtr);
    Module.stackRestore(sp);
    return result;
  }
  /**
  * Return the buffer content type.
  *
  * @returns The buffer content type as a {@link BufferContentType} value.
  */
  getContentType() {
    return exports.hb_buffer_get_content_type(this.ptr);
  }
};
var Feature = class Feature2 {
  static {
    this.GLOBAL_START = 0;
  }
  static {
    this.GLOBAL_END = 4294967295;
  }
  constructor(tag, value = 1, start = Feature2.GLOBAL_START, end = Feature2.GLOBAL_END) {
    this.tag = tag;
    this.value = value;
    this.start = start;
    this.end = end;
  }
  /**
  * Parses a string into a Feature.
  *
  * The format for specifying feature strings follows. All valid CSS
  * font-feature-settings values other than `normal` and the global values are
  * also accepted, though not documented below. CSS string escapes are not
  * supported.
  *
  * The range indices refer to the positions between Unicode characters. The
  * position before the first character is always 0.
  *
  * The format is Python-esque. Here is how it all works:
  *
  * | Syntax        | Value | Start | End | Meaning                          |
  * | ------------- | ----- | ----- | --- | -------------------------------- |
  * | `kern`        | 1     | 0     | ∞   | Turn feature on                  |
  * | `+kern`       | 1     | 0     | ∞   | Turn feature on                  |
  * | `-kern`       | 0     | 0     | ∞   | Turn feature off                 |
  * | `kern=0`      | 0     | 0     | ∞   | Turn feature off                 |
  * | `kern=1`      | 1     | 0     | ∞   | Turn feature on                  |
  * | `aalt=2`      | 2     | 0     | ∞   | Choose 2nd alternate             |
  * | `kern[]`      | 1     | 0     | ∞   | Turn feature on                  |
  * | `kern[:]`     | 1     | 0     | ∞   | Turn feature on                  |
  * | `kern[5:]`    | 1     | 5     | ∞   | Turn feature on, partial         |
  * | `kern[:5]`    | 1     | 0     | 5   | Turn feature on, partial         |
  * | `kern[3:5]`   | 1     | 3     | 5   | Turn feature on, range           |
  * | `kern[3]`     | 1     | 3     | 3+1 | Turn feature on, single char     |
  * | `aalt[3:5]=2` | 2     | 3     | 5   | Turn 2nd alternate on for range  |
  *
  * @param str The string to parse.
  * @returns A Feature, or undefined if the string is not a valid feature.
  */
  static fromString(str) {
    const sp = Module.stackSave();
    const featurePtr = Module.stackAlloc(16);
    const strPtr = string_to_ascii_ptr(str);
    let feature;
    if (exports.hb_feature_from_string(strPtr.ptr, -1, featurePtr)) feature = new Feature2(hb_untag(Module.HEAPU32[featurePtr / 4]), Module.HEAPU32[featurePtr / 4 + 1], Module.HEAPU32[featurePtr / 4 + 2], Module.HEAPU32[featurePtr / 4 + 3]);
    strPtr.free();
    Module.stackRestore(sp);
    return feature;
  }
  /**
  * Converts the feature to a string in the format understood by
  * {@link Feature.fromString}.
  *
  * Note that the feature value will be omitted if it is `1`, but the string
  * won't include any whitespace.
  *
  * @returns The feature string.
  */
  toString() {
    const sp = Module.stackSave();
    const featurePtr = Module.stackAlloc(16);
    this.writeTo(featurePtr);
    const bufLen = 128;
    const bufPtr = Module.stackAlloc(bufLen);
    exports.hb_feature_to_string(featurePtr, bufPtr, bufLen);
    const result = utf8_ptr_to_string(bufPtr);
    Module.stackRestore(sp);
    return result;
  }
  /** @internal Write this feature into the given hb_feature_t pointer. */
  writeTo(ptr) {
    Module.HEAPU32[ptr / 4] = hb_tag(this.tag);
    Module.HEAPU32[ptr / 4 + 1] = this.value;
    Module.HEAPU32[ptr / 4 + 2] = this.start;
    Module.HEAPU32[ptr / 4 + 3] = this.end;
  }
};
var Variation = class Variation2 {
  constructor(tag, value = 0) {
    this.tag = tag;
    this.value = value;
  }
  /**
  * Parses a string into a Variation.
  *
  * The format for specifying variation settings follows. All valid CSS
  * font-variation-settings values other than `normal` and `inherited` are
  * also accepted, though, not documented below.
  *
  * The format is a tag, optionally followed by an equals sign, followed by a
  * number. For example `wght=500`, or `slnt=-7.5`.
  *
  * @param str The string to parse.
  * @returns A Variation, or undefined if the string is not a valid variation.
  */
  static fromString(str) {
    const sp = Module.stackSave();
    const variationPtr = Module.stackAlloc(8);
    const strPtr = string_to_ascii_ptr(str);
    let variation;
    if (exports.hb_variation_from_string(strPtr.ptr, -1, variationPtr)) variation = new Variation2(hb_untag(Module.HEAPU32[variationPtr / 4]), Module.HEAPF32[variationPtr / 4 + 1]);
    strPtr.free();
    Module.stackRestore(sp);
    return variation;
  }
  /**
  * Converts the variation to a string in the format understood by
  * {@link Variation.fromString}.
  *
  * Note that the string won't include any whitespace.
  *
  * @returns The variation string.
  */
  toString() {
    const sp = Module.stackSave();
    const variationPtr = Module.stackAlloc(8);
    this.writeTo(variationPtr);
    const bufLen = 128;
    const bufPtr = Module.stackAlloc(bufLen);
    exports.hb_variation_to_string(variationPtr, bufPtr, bufLen);
    const result = utf8_ptr_to_string(bufPtr);
    Module.stackRestore(sp);
    return result;
  }
  /** @internal Write this variation into the given hb_variation_t pointer. */
  writeTo(ptr) {
    Module.HEAPU32[ptr / 4] = hb_tag(this.tag);
    Module.HEAPF32[ptr / 4 + 1] = this.value;
  }
};
var TracePhase = {
  DONT_STOP: 0,
  GSUB: 1,
  GPOS: 2
};
function shape(font, buffer, features) {
  const featuresLen = features?.length ?? 0;
  const sp = Module.stackSave();
  let featuresPtr = 0;
  if (featuresLen) {
    featuresPtr = Module.stackAlloc(16 * featuresLen);
    features.forEach((feature, i) => {
      feature.writeTo(featuresPtr + i * 16);
    });
  }
  exports.hb_shape(font.ptr, buffer.ptr, featuresPtr, featuresLen);
  Module.stackRestore(sp);
}
function shapeWithTrace(font, buffer, features, stop_at, stop_phase) {
  const trace = [];
  let currentPhase = TracePhase.DONT_STOP;
  let stopping = false;
  buffer.setMessageFunc((buffer2, font2, message) => {
    if (message.startsWith("start table GSUB")) currentPhase = TracePhase.GSUB;
    else if (message.startsWith("start table GPOS")) currentPhase = TracePhase.GPOS;
    if (currentPhase != stop_phase) stopping = false;
    if (stop_phase != TracePhase.DONT_STOP && currentPhase == stop_phase && message.startsWith("end lookup " + stop_at)) stopping = true;
    if (stopping) return false;
    const traceBuf = buffer2.serialize({
      font: font2,
      format: BufferSerializeFormat.JSON,
      flags: BufferSerializeFlag.NO_GLYPH_NAMES
    });
    trace.push({
      m: message,
      t: JSON.parse(traceBuf),
      glyphs: buffer2.getContentType() == BufferContentType.GLYPHS
    });
    return true;
  });
  shape(font, buffer, features);
  return trace;
}
function version() {
  const sp = Module.stackSave();
  const versionPtr = Module.stackAlloc(12);
  exports.hb_version(versionPtr, versionPtr + 4, versionPtr + 8);
  const ver = {
    major: Module.HEAPU32[versionPtr / 4],
    minor: Module.HEAPU32[(versionPtr + 4) / 4],
    micro: Module.HEAPU32[(versionPtr + 8) / 4]
  };
  Module.stackRestore(sp);
  return ver;
}
function versionString() {
  return utf8_ptr_to_string(exports.hb_version_string());
}
function otTagToScript(tag) {
  const hbTag = hb_tag(tag);
  return hb_untag(exports.hb_ot_tag_to_script(hbTag));
}
function otTagToLanguage(tag) {
  const hbTag = hb_tag(tag);
  return language_to_string(exports.hb_ot_tag_to_language(hbTag));
}
init(await harfbuzz_default());

// electron/millrect-text-engine-browser.js
var import_text_engine_harfbuzz_core = __toESM(require_text_engine_harfbuzz_core());
var import_builtin_fonts = __toESM(require_builtin_fonts());
var WEB_FONT_CATALOG = [
  {
    id: "gen-interface-jp",
    regularUrl: "fonts/GenInterfaceJP-Regular.ttf",
    boldUrl: "fonts/GenInterfaceJP-Bold.ttf",
    families: [import_builtin_fonts.BUILTIN_FONT_GEN]
  }
];
function matchCatalogEntry(family, bold) {
  const name = (0, import_builtin_fonts.normalizeTextFontFamily)(family);
  const entry = WEB_FONT_CATALOG.find((e) => e.families.includes(name));
  const picked = entry || WEB_FONT_CATALOG[0];
  return {
    cacheId: `${picked.id}-${bold ? "b" : "r"}`,
    url: bold ? picked.boldUrl : picked.regularUrl
  };
}
async function createBrowserTextEngine() {
  const fontBytes = /* @__PURE__ */ new Map();
  async function loadFontEntry(family, _style, bold) {
    const fetchProject = globalThis.__millrectFetchProjectFontBytes;
    if (typeof fetchProject === "function") {
      const projectBytes = await fetchProject(family, bold);
      if (projectBytes?.length) {
        return (0, import_text_engine_harfbuzz_core.openHbFont)(dist_exports, projectBytes, 0);
      }
    }
    const matched = matchCatalogEntry(family, bold);
    if (!matched?.url) return null;
    let bytes = fontBytes.get(matched.cacheId);
    if (!bytes) {
      const res = await fetch(matched.url);
      if (!res.ok) {
        throw new Error(`Web font not found: ${matched.url}`);
      }
      bytes = new Uint8Array(await res.arrayBuffer());
      fontBytes.set(matched.cacheId, bytes);
    }
    return (0, import_text_engine_harfbuzz_core.openHbFont)(dist_exports, bytes, 0);
  }
  return (0, import_text_engine_harfbuzz_core.createHarfBuzzTextEngine)(dist_exports, loadFontEntry);
}
var _engine = null;
var _initPromise = null;
async function init2() {
  if (_engine) return _engine;
  if (!_initPromise) {
    _initPromise = createBrowserTextEngine().then((engine) => {
      _engine = engine;
      return engine;
    });
  }
  return _initPromise;
}
async function measureTextLayout(payload) {
  const engine = await init2();
  return engine.measureTextLayout(payload);
}
async function outlineText(payload) {
  const engine = await init2();
  return engine.outlineText(payload);
}
var api = {
  get ready() {
    return Boolean(_engine);
  },
  init: init2,
  measureTextLayout,
  outlineText,
  catalog: WEB_FONT_CATALOG
};
globalThis.MillrectTextEngine = api;
