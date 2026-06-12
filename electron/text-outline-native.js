"use strict";

const fontkit = require("fontkit");
const { findFontFile } = require("./font-path");
const {
  BUILTIN_FONT_GEN,
  normalizeTextFontFamily,
} = require("../packages/builtin-fonts");
const {
  textEngineGroupRingsIntoPolygons,
} = require("../packages/text-engine-utils");

const BEZIER_STEPS = 8;

function textNeedsCjk(text) {
  return /[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf]/.test(text || "");
}

function expandFontFamilyCandidates(shape) {
  const raw = (shape.fontFamily || "Helvetica,Arial,sans-serif")
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
    .filter((f) => f && !/^(sans-serif|serif|monospace)$/i.test(f));

  const out = [];
  const seen = new Set();
  const add = (name) => {
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push(name);
  };

  for (const f of raw) {
    add(f);
    if (/helvetica/i.test(f)) {
      add("Helvetica Neue");
      add("Helvetica");
    } else if (/hiragino|ヒラギノ/i.test(f)) {
      add("Hiragino Sans");
      add("Hiragino Kaku Gothic ProN");
    } else if (/yu gothic|游ゴシック|yugothic/i.test(f)) {
      add("YuGothic");
      add("Yu Gothic");
    } else if (/meiryo|メイリオ/i.test(f)) {
      add("Meiryo");
    } else if (/noto|gen interface/i.test(f)) {
      add(BUILTIN_FONT_GEN);
    }
  }

  if (textNeedsCjk(shape.text)) {
    add("Hiragino Sans");
    add("Arial Unicode MS");
    add("Arial Unicode");
  }
  add("Helvetica Neue");
  add("Helvetica");
  add("Arial");
  return out;
}

function openFontkitFile(filePath, familyHint) {
  const handle = fontkit.openSync(filePath);
  if (!handle.fonts?.length) return handle;
  if (!familyHint) return handle.fonts[0];
  const needle = familyHint.toLowerCase().replace(/[\s-_]/g, "");
  const match = handle.fonts.find((f) => {
    const name = (f.familyName || f.postscriptName || "")
      .toLowerCase()
      .replace(/[\s-_]/g, "");
    return name.includes(needle) || needle.includes(name);
  });
  return match || handle.fonts[0];
}

function openFontkitBuffer(buffer, familyHint) {
  const handle = fontkit.create(buffer);
  if (!handle.fonts?.length) return handle;
  if (!familyHint) return handle.fonts[0];
  const needle = familyHint.toLowerCase().replace(/[\s-_]/g, "");
  const match = handle.fonts.find((f) => {
    const name = (f.familyName || f.postscriptName || "")
      .toLowerCase()
      .replace(/[\s-_]/g, "");
    return name.includes(needle) || needle.includes(name);
  });
  return match || handle.fonts[0];
}

function effectiveNativeFontFamily(shape) {
  return normalizeTextFontFamily(shape?.fontFamily);
}

function resolveFontFromPayload(shape, payload) {
  const wantBold = shape.fontWeight === "bold";
  const projectFiles = [...(payload?.projectFontFiles || [])].sort((a, b) => {
    const aMatch = a.bold === wantBold ? 0 : 1;
    const bMatch = b.bold === wantBold ? 0 : 1;
    return aMatch - bMatch;
  });
  for (const pf of projectFiles) {
    if (!pf?.data?.length) continue;
    if (pf.bold !== undefined && pf.bold !== wantBold) continue;
    try {
      const font = openFontkitBuffer(Buffer.from(pf.data), pf.family);
      if (font) return { font, familyName: pf.family || font.familyName };
    } catch (_) {}
  }

  const primaryStyle = shape.fontWeight === "bold" ? "Bold" : "Regular";
  const styles = [primaryStyle, "Regular", "Normal", "Book"];
  const effective = effectiveNativeFontFamily(shape);
  const families = [];
  const seen = new Set();
  const add = (name) => {
    const k = String(name || "").toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    families.push(name);
  };
  add(effective);
  add(normalizeTextFontFamily(shape?.fontFamily));
  for (const f of expandFontFamilyCandidates(shape)) add(f);
  if (textNeedsCjk(shape?.text)) add(BUILTIN_FONT_GEN);

  for (const family of families) {
    for (const style of styles) {
      const filePath = findFontFile(family, style, { includeTtc: true });
      if (!filePath) continue;
      try {
        const font = openFontkitFile(filePath, family);
        if (font) return { font, familyName: font.familyName || family };
      } catch (_) {}
    }
  }
  return null;
}

function resolveFont(shape) {
  const primaryStyle = shape.fontWeight === "bold" ? "Bold" : "Regular";
  const styles = [primaryStyle, "Regular", "Normal", "Book"];
  const families = expandFontFamilyCandidates(shape);

  for (const family of families) {
    for (const style of styles) {
      const filePath = findFontFile(family, style, { includeTtc: true });
      if (!filePath) continue;
      try {
        const font = openFontkitFile(filePath, family);
        if (font) return { font, familyName: font.familyName || family };
      } catch (_) {}
    }
  }
  return null;
}

function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

function glyphToContours(glyphPath, scale) {
  if (!glyphPath?.commands?.length) return null;
  const rings = fontkitPathToPaperRings(glyphPath.commands);
  if (!rings.length) return null;
  const contours = textEngineGroupRingsIntoPolygons(rings).map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => paperToReal(x, y, scale))),
  );
  return pathHasArea(contours) ? contours : null;
}

function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, emit) {
  for (let i = 1; i <= BEZIER_STEPS; i++) {
    const t = i / BEZIER_STEPS;
    const mt = 1 - t;
    emit(
      mt ** 3 * x0 + 3 * mt ** 2 * t * x1 + 3 * mt * t ** 2 * x2 + t ** 3 * x3,
      mt ** 3 * y0 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y3,
    );
  }
}

function sampleQuad(x0, y0, x1, y1, x2, y2, emit) {
  for (let i = 1; i <= BEZIER_STEPS; i++) {
    const t = i / BEZIER_STEPS;
    const mt = 1 - t;
    emit(
      mt ** 2 * x0 + 2 * mt * t * x1 + t ** 2 * x2,
      mt ** 2 * y0 + 2 * mt * t * y1 + t ** 2 * y2,
    );
  }
}

function fontkitPathToPaperRings(commands) {
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

  for (const cmd of commands) {
    switch (cmd.command) {
      case "moveTo":
        pushRing();
        cx = cmd.args[0];
        cy = cmd.args[1];
        sx = cx;
        sy = cy;
        ring.push([cx, cy]);
        break;
      case "lineTo":
        cx = cmd.args[0];
        cy = cmd.args[1];
        ring.push([cx, cy]);
        break;
      case "quadraticCurveTo":
        sampleQuad(
          cx,
          cy,
          cmd.args[0],
          cmd.args[1],
          cmd.args[2],
          cmd.args[3],
          (x, y) => ring.push([x, y]),
        );
        cx = cmd.args[2];
        cy = cmd.args[3];
        break;
      case "bezierCurveTo":
        sampleCubic(
          cx,
          cy,
          cmd.args[0],
          cmd.args[1],
          cmd.args[2],
          cmd.args[3],
          cmd.args[4],
          cmd.args[5],
          (x, y) => ring.push([x, y]),
        );
        cx = cmd.args[4];
        cy = cmd.args[5];
        break;
      case "closePath":
        if (ring.length > 2) {
          ring.push([ring[0][0], ring[0][1]]);
          pushRing();
        } else {
          ring = [];
        }
        cx = sx;
        cy = sy;
        break;
      default:
        break;
    }
  }
  pushRing();
  return rings;
}

function paperToReal(x, y, scale) {
  scale = scale || { numerator: 1, denominator: 1 };
  const f = 10 * (scale.denominator / scale.numerator);
  return [x * f, y * f];
}

function pathHasArea(contours) {
  for (const poly of contours) {
    for (const ring of poly) {
      if (ring.length > 2 && Math.abs(ringSignedArea(ring)) > 0.01) return true;
    }
  }
  return false;
}

function outlineTextNative(payload) {
  let lines = payload.lines;
  if (!lines?.length) {
    const measured = measureTextLayoutNative(payload);
    lines = measured.layout?.lines || [];
    payload = { ...payload, lines };
  }

  const { shape, scale, layoutPaper, anchorPaper } = payload;
  if (!shape?.text || !/\S/.test(shape.text)) {
    throw new Error("アウトライン化するテキストがありません");
  }

  const resolved = resolveFontFromPayload(shape, payload) || resolveFont(shape);
  if (!resolved) {
    throw new Error("フォントファイルが見つかりませんでした");
  }

  const { font } = resolved;
  const fontSize = shape.fontSize ?? 3.5;
  const lineHeight =
    Number(shape.lineHeight) > 0 ? Number(shape.lineHeight) : 1;
  const fontScale = fontSize / font.unitsPerEm;
  const ascender = font.ascent * fontScale;
  const fillColor = shape.stroke || "#1a1a2e";
  const strokeWidth = shape.strokeWidth || "thin";
  const children = [];

  for (const line of lines) {
    if (!line.text) continue;
    const yBaseline =
      line.yBaselinePaper ??
      (line.yTopPaper != null
        ? line.yTopPaper + ascender
        : anchorPaper.y +
          ascender +
          (line.lineIndex || 0) * fontSize * lineHeight);
    const run = font.layout(line.text);
    let cursor = 0;

    for (let i = 0; i < run.glyphs.length; i++) {
      const glyph = run.glyphs[i];
      const pos = run.positions[i];
      if (!glyph?.path?.commands?.length) {
        cursor += pos.xAdvance;
        continue;
      }

      const gx = line.xPaper + (cursor + pos.xOffset) * fontScale;
      const gy = yBaseline;
      const transformed = glyph.path.transform(
        fontScale,
        0,
        0,
        -fontScale,
        gx,
        gy,
      );
      const contours = glyphToContours(transformed, scale);
      cursor += pos.xAdvance;
      if (!contours) continue;

      children.push({
        type: "path",
        contours,
        stroke: "none",
        fill: fillColor,
        strokeWidth: "thin",
      });
    }
  }

  if (children.length === 0) {
    throw new Error("アウトライン化できるグリフがありませんでした");
  }

  return { children };
}

function lineWidthFontkit(font, text, fontSize) {
  const fontScale = fontSize / font.unitsPerEm;
  const run = font.layout(text || "");
  let w = 0;
  for (let i = 0; i < run.positions.length; i++) {
    w += run.positions[i].xAdvance;
  }
  return w * fontScale;
}

function wrapParagraphFontkit(font, text, fontSize, maxWidth) {
  if (!text) return [""];
  if (!maxWidth || maxWidth <= 0) return [text];

  const lines = [];
  let start = 0;
  while (start < text.length) {
    let end = start + 1;
    while (end <= text.length) {
      const slice = text.slice(start, end);
      if (
        lineWidthFontkit(font, slice, fontSize) > maxWidth &&
        end > start + 1
      ) {
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

function alignedX(lineWidth, frameWidth, anchorX, align) {
  switch (align) {
    case "center":
      return anchorX + Math.max(0, (frameWidth - lineWidth) / 2);
    case "right":
      return anchorX + Math.max(0, frameWidth - lineWidth);
    default:
      return anchorX;
  }
}

function measureTextLayoutNative(payload) {
  const { shape, anchorPaper, paperWidth } = payload;
  const fontSize = shape.fontSize ?? 3.5;
  const lineHeightMult =
    Number(shape.lineHeight) > 0 ? Number(shape.lineHeight) : 1;
  const lineHeight = fontSize * lineHeightMult;
  const align = shape.textAlign || "left";
  const text = shape.text ?? "";

  if (!text) {
    return {
      layout: {
        layoutPaper: {
          w: Math.max(fontSize * 0.25, 1),
          h: fontSize * lineHeightMult,
          insetTop: 0,
          insetLeft: 0,
        },
        anchorPaper,
        lines: [],
      },
    };
  }

  const resolved = resolveFontFromPayload(shape, payload) || resolveFont(shape);
  if (!resolved) {
    throw new Error("フォントファイルが見つかりませんでした");
  }
  const { font } = resolved;

  const paragraphs = text.split("\n");
  const visualLines = [];
  let globalIndex = 0;
  for (const para of paragraphs) {
    const wrapped = wrapParagraphFontkit(font, para, fontSize, paperWidth);
    for (const wLine of wrapped) {
      visualLines.push({ text: wLine, lineIndex: globalIndex });
      globalIndex += 1;
    }
  }

  let maxLineWidth = 0;
  const lines = [];
  for (let idx = 0; idx < visualLines.length; idx++) {
    const vLine = visualLines[idx];
    const lw = lineWidthFontkit(font, vLine.text, fontSize);
    maxLineWidth = Math.max(maxLineWidth, lw);
    const fw = paperWidth ?? lw;
    lines.push({
      text: vLine.text,
      lineIndex: vLine.lineIndex,
      xPaper: alignedX(lw, fw, anchorPaper.x, align),
      yTopPaper: anchorPaper.y + idx * lineHeight,
    });
  }

  const pad = Math.max(0.5, fontSize * 0.06);
  const layoutW = paperWidth ?? Math.max(maxLineWidth + pad, 1);
  const layoutH = Math.max(visualLines.length * lineHeight, lineHeight);

  return {
    layout: {
      layoutPaper: {
        w: layoutW,
        h: layoutH,
        insetTop: 0,
        insetLeft: 0,
      },
      anchorPaper,
      lines,
    },
  };
}

module.exports = { outlineTextNative, measureTextLayoutNative };
