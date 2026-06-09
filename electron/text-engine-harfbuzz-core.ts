"use strict";

// Node の require とブラウザ esbuild の ESM import 両方から使われる。
// ES module（export）として隔離し、packages/*.ts の global script 名との衝突を避ける。
const {
  textEngineExpandFontCandidates,
  textEngineAlignedX,
  textEngineHbPathToContoursReal,
  textEngineNeedsCjk,
  textEngineSplitScriptRuns,
} = require("../packages/text-engine-utils");
const {
  BUILTIN_FONT_GEN,
  isBuiltinFontFamily,
  textEnginePrimaryFontFamily,
} = require("../packages/builtin-fonts");

function createFontResolver(loadFontEntry: any) {
  const cache = new Map<string, any>();

  async function resolveFontEntry(shape: any, fontCandidates: any): Promise<any> {
    const bold = shape.fontWeight === "bold";
    const families = textEngineExpandFontCandidates(shape, fontCandidates);
    const styles = bold
      ? ["Bold", "bold", "700"]
      : ["Regular", "Normal", "Book"];
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

  async function resolveCjkEntry(shape: any, fontCandidates: any): Promise<any> {
    const bold = shape.fontWeight === "bold";
    const styles = bold
      ? ["Bold", "bold", "700"]
      : ["Regular", "Normal", "Book"];
    const families: string[] = [];
    const seen = new Set<string>();
    const add = (name: any) => {
      const k = name.toLowerCase();
      if (!name || seen.has(k)) return;
      seen.add(k);
      families.push(name);
    };

    for (const f of fontCandidates || []) {
      if (f === BUILTIN_FONT_GEN) add(f);
    }
    add(BUILTIN_FONT_GEN);

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

function createHarfBuzzTextEngine(hb: any, loadFontEntry: any) {
  const { resolveFontEntry, resolveCjkEntry } =
    createFontResolver(loadFontEntry);

  function prepareFont(entry: any, fontSize: number): any {
    entry.font.setScale(fontSize * entry.upem, fontSize * entry.upem);
    return entry;
  }

  function shapeLineText(
    entry: any,
    text: any,
    fontSize: number,
    features: any,
  ): any {
    prepareFont(entry, fontSize);
    const buffer = new hb.Buffer();
    buffer.addText(text || "");
    buffer.guessSegmentProperties();
    hb.shape(entry.font, buffer, features);
    return buffer.getGlyphInfosAndPositions();
  }

  function cjkShapingEntry(primary: any, fallback: any, shape: any): any {
    const family = textEnginePrimaryFontFamily(shape);
    if (isBuiltinFontFamily(family)) return primary;
    return fallback || primary;
  }

  function shapeLineWithFallback(
    primary: any,
    cjk: any,
    text: any,
    fontSize: number,
    features: any,
    shape: any,
  ): any[] {
    const fallback = cjk && cjk !== primary ? cjk : null;

    if (!fallback || !textEngineNeedsCjk(text)) {
      return shapeLineText(primary, text, fontSize, features).map(
        (glyph: any) => ({
          entry: primary,
          glyph,
        }),
      );
    }

    const scriptRuns = textEngineSplitScriptRuns(text);
    const mixed =
      scriptRuns.some((r: any) => r.cjk) && scriptRuns.some((r: any) => !r.cjk);

    if (!mixed) {
      const entry = cjkShapingEntry(primary, fallback, shape);
      return shapeLineText(entry, text, fontSize, features).map(
        (glyph: any) => ({
          entry,
          glyph,
        }),
      );
    }

    const out: any[] = [];
    for (const run of scriptRuns) {
      const entry = run.cjk
        ? cjkShapingEntry(primary, fallback, shape)
        : primary;
      if (!entry || !run.text) continue;
      const glyphs = shapeLineText(entry, run.text, fontSize, features);
      for (const glyph of glyphs) {
        out.push({ entry, glyph });
      }
    }
    return out;
  }

  function measureLineWidthPaper(
    primary: any,
    cjk: any,
    text: any,
    fontSize: number,
    features: any,
    shape: any,
  ): number {
    if (!text) return 0;
    const shaped = shapeLineWithFallback(
      primary,
      cjk,
      text,
      fontSize,
      features,
      shape,
    );
    let w = 0;
    for (const { entry, glyph } of shaped) {
      w += glyph.xAdvance / entry.upem;
    }
    return w;
  }

  function wrapParagraph(
    primary: any,
    cjk: any,
    text: any,
    fontSize: number,
    maxWidthPaper: any,
    features: any,
    shape: any,
  ): string[] {
    if (!text) return [""];
    if (!maxWidthPaper || maxWidthPaper <= 0) return [text];

    const lines: string[] = [];
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
          shape,
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

  function hbFeatures(_shape: any): any {
    // Bold は専用 OTF を loadFontEntry で読む。合成 wght は使わない。
    return undefined;
  }

  async function computeTextLayout(payload: any): Promise<any> {
    const { shape, anchorPaper, paperWidth, fontCandidates } = payload;
    const text = shape.text ?? "";
    const fontSize = shape.fontSize ?? 3.5;
    const lineHeightMult =
      Number(shape.lineHeight) > 0 ? Number(shape.lineHeight) : 1;
    const lineHeight = fontSize * lineHeightMult;
    const align = shape.textAlign || "left";
    const anchor = anchorPaper;

    if (!text) {
      return {
        layoutPaper: {
          w: Math.max(fontSize * 0.25, 1),
          h: fontSize * lineHeightMult,
          insetTop: 0,
          insetLeft: 0,
        },
        anchorPaper: anchor,
        lines: [],
      };
    }

    const primary = await resolveFontEntry(shape, fontCandidates);
    if (!primary) {
      throw new Error("フォントファイルが見つかりませんでした");
    }
    const cjk = textEngineNeedsCjk(text)
      ? (await resolveCjkEntry(shape, fontCandidates)) || primary
      : primary;

    const features = hbFeatures(shape);
    const paragraphs = text.split("\n");
    const visualLines: { text: string; lineIndex: number }[] = [];
    let globalIndex = 0;

    for (const para of paragraphs) {
      const wrapped = wrapParagraph(
        primary,
        cjk,
        para,
        fontSize,
        paperWidth,
        features,
        shape,
      );
      for (const wLine of wrapped) {
        visualLines.push({ text: wLine, lineIndex: globalIndex });
        globalIndex += 1;
      }
    }

    let maxLineWidth = 0;
    const lines: any[] = [];
    for (let idx = 0; idx < visualLines.length; idx++) {
      const vLine = visualLines[idx];
      const lw = measureLineWidthPaper(
        primary,
        cjk,
        vLine.text,
        fontSize,
        features,
        shape,
      );
      maxLineWidth = Math.max(maxLineWidth, lw);
      const fw = paperWidth ?? lw;
      lines.push({
        text: vLine.text,
        lineIndex: vLine.lineIndex,
        xPaper: textEngineAlignedX(lw, fw, anchor.x, align),
        yTopPaper: anchor.y + idx * lineHeight,
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
        insetLeft: 0,
      },
      anchorPaper: anchor,
      lines,
    };
  }

  async function measureTextLayout(payload: any): Promise<any> {
    const layout = await computeTextLayout(payload);
    return { layout, engine: "harfbuzz" };
  }

  async function outlineText(payload: any): Promise<any> {
    const { shape, scale, anchorPaper } = payload;
    if (!shape?.text || !/\S/.test(shape.text)) {
      throw new Error("アウトライン化するテキストがありません");
    }

    const layout =
      payload.lines?.length && payload.layoutPaper
        ? {
            layoutPaper: payload.layoutPaper,
            anchorPaper: payload.anchorPaper || anchorPaper,
            lines: payload.lines,
          }
        : await computeTextLayout(payload);

    const primary = await resolveFontEntry(shape, payload.fontCandidates);
    if (!primary) {
      throw new Error("フォントファイルが見つかりませんでした");
    }
    const cjk = textEngineNeedsCjk(shape.text)
      ? (await resolveCjkEntry(shape, payload.fontCandidates)) || primary
      : primary;

    const fontSize = shape.fontSize ?? 3.5;
    const lineHeightMult =
      Number(shape.lineHeight) > 0 ? Number(shape.lineHeight) : 1;
    const features = hbFeatures(shape);
    const fillColor = (() => {
      const valid = (c: any) =>
        typeof c === "string" && c && c !== "none" && c !== "transparent";
      if (valid(shape.fill)) return shape.fill;
      if (valid(shape.stroke)) return shape.stroke;
      return "#1a1a2e";
    })();
    prepareFont(primary, fontSize);
    const ascenderPaper = primary.font.hExtents().ascender / primary.upem;
    const children: any[] = [];

    for (const line of layout.lines) {
      if (!line.text) continue;
      const yBaseline =
        line.yTopPaper != null
          ? line.yTopPaper + ascenderPaper
          : anchorPaper.y +
            ascenderPaper +
            (line.lineIndex || 0) * fontSize * lineHeightMult;

      const shaped = shapeLineWithFallback(
        primary,
        cjk,
        line.text,
        fontSize,
        features,
        shape,
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
          scale,
        );
        cursorPaper += g.xAdvance;
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

    if (!children.length) {
      throw new Error("アウトライン化できるグリフがありませんでした");
    }

    return { children, layout, engine: "harfbuzz" };
  }

  return { measureTextLayout, outlineText, computeTextLayout };
}

function openHbFont(hb: any, buffer: any, faceIndex = 0): any {
  const blob = new hb.Blob(buffer);
  const face = new hb.Face(blob, faceIndex);
  const font = new hb.Font(face);
  return {
    blob,
    face,
    font,
    upem: face.upem,
    buffer,
  };
}

export { createHarfBuzzTextEngine, openHbFont };
