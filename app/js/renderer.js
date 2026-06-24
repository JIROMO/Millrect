"use strict";

// ── SVG helpers ──────────────────────────────────────────────
const NS = "http://www.w3.org/2000/svg";
function se(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// ── 線の役割（line.role）→ 視覚スタイル ───────────────────────
// drawing / cut … 実形状（実線）。cut は通常その色で区別される
// annotation    … 注釈・引出線（短破線）。3D 非対象
// construction  … 作図補助線（一点鎖線・半透明）
function lineRoleStyle(role, sw) {
  switch (role) {
    case "annotation":
      return { dash: `${sw * 3} ${sw * 2}`, opacity: null };
    case "construction":
      return { dash: `${sw * 6} ${sw * 2} ${sw} ${sw * 2}`, opacity: "0.55" };
    case "cut":
    case "drawing":
    default:
      return { dash: null, opacity: null };
  }
}

// User-selectable line style → stroke-dasharray (scaled to the line weight so
// the dash rhythm stays proportional). Returns null for solid/unset.
function lineStyleDashArray(style, sw) {
  const w = sw || 0.5;
  switch (style) {
    case "dashed":
      return `${w * 6} ${w * 4}`;
    case "dotted":
      return `${w * 1.2} ${w * 2}`;
    case "dashdot":
      return `${w * 7} ${w * 3} ${w * 1.2} ${w * 3}`;
    case "solid":
    default:
      return null;
  }
}

// ── 矢印ヘッド ────────────────────────────────────────────────
// arrowStyle: "arrow" (塗りつぶし矢印) | "dot" (黒丸) | "slash" (斜線) | "open" (開き矢印)
function arrowHead(
  g,
  x,
  y,
  angle,
  size = 2.5,
  color = "#1a1a2e",
  arrowStyle = "dot",
) {
  switch (arrowStyle) {
    case "arrow": {
      // 塗りつぶし三角矢印
      const len = size * 2.2,
        w = size * 0.7;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const px = x + len * cos,
        py = y + len * sin;
      const lx = px - w * sin,
        ly = py + w * cos;
      const rx = px + w * sin,
        ry = py - w * cos;
      const poly = se("polygon", {
        points: `${x},${y} ${lx},${ly} ${rx},${ry}`,
        fill: color,
        stroke: "none",
        "pointer-events": "none",
      });
      g.appendChild(poly);
      break;
    }
    case "slash": {
      // 斜線（建築図面スタイル）
      const len = size * 0.9;
      const a = angle + Math.PI / 4;
      g.appendChild(
        se("line", {
          x1: x - len * Math.cos(a),
          y1: y - len * Math.sin(a),
          x2: x + len * Math.cos(a),
          y2: y + len * Math.sin(a),
          stroke: color,
          "stroke-width": 0.4,
          "pointer-events": "none",
        }),
      );
      break;
    }
    case "open": {
      // 開き矢印
      const len = size * 1.8,
        w = size * 0.65;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const px = x + len * cos,
        py = y + len * sin;
      const lx = px - w * sin,
        ly = py + w * cos;
      const rx = px + w * sin,
        ry = py - w * cos;
      g.appendChild(
        se("polyline", {
          points: `${lx},${ly} ${x},${y} ${rx},${ry}`,
          fill: "none",
          stroke: color,
          "stroke-width": 0.35,
          "pointer-events": "none",
        }),
      );
      break;
    }
    case "dot":
    default: {
      // 黒丸（JIS 狭小スタイル・デフォルト）
      const r = size * 0.38;
      g.appendChild(
        se("circle", {
          cx: x,
          cy: y,
          r,
          fill: color,
          stroke: "none",
          "pointer-events": "none",
        }),
      );
      break;
    }
  }
}

function rtp(v, scale) {
  return realToPaperDist(v, scale);
}

function addHitLine(g, x1, y1, x2, y2) {
  g.appendChild(
    se("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: "transparent",
      // ズーム非依存の一定幅（画面px）にして、寸法線をどのズームでも掴めるようにする。
      "stroke-width": 10,
      "vector-effect": "non-scaling-stroke",
      "pointer-events": "stroke",
    }),
  );
}

function renderDimensionSVG(dim, scale) {
  const g = se("g", {
    "data-id": dim.id,
    "data-type": "dimension",
    class: "dimension-group",
    "pointer-events": "all",
  });

  // ── スタイル設定（dim プロパティ優先、なければデフォルト） ────
  const stroke = dim.color || "#1a1a2e";
  const sw = dim.lineWidth || 0.25;
  const ts = dim.textSize || 3.0;
  const arrowStyle = dim.arrowStyle || "dot"; // "dot"|"arrow"|"slash"|"open"
  const over = 1.5,
    gap = 1.0;

  // ── 数値フォーマット ──────────────────────────────────────────
  // dim.value: 手動上書き値（未設定なら座標から自動計算）
  // dim.decimals: 小数点以下桁数（デフォルト 0）
  // dim.prefix: 数値の前に付くテキスト（例: "L="）
  // dim.suffix: 数値の後に付くテキスト（例: " mm"、デフォルト ""）
  function formatDimValue(rawVal) {
    const decimals = dim.decimals != null ? dim.decimals : 0;
    const numStr = Number(rawVal).toFixed(decimals);
    return `${dim.prefix || ""}${numStr}${dim.suffix || ""}`;
  }

  // Helper: add text label with optional offset + leader line
  function addDimLabel(
    val,
    defaultX,
    defaultY,
    baseRotate,
    anchorX,
    anchorY,
    textAnchor = "middle",
  ) {
    const lox = rtp(dim.textOffsetX || 0, scale);
    const loy = rtp(dim.textOffsetY || 0, scale);
    const tx = defaultX + lox;
    const ty = defaultY + loy;
    const hasOffset = Math.abs(lox) > 0.5 || Math.abs(loy) > 0.5;

    // Total rotation = base (0 or -90) + user textRotation
    const userRot = dim.textRotation || 0;
    const totalRot = (baseRotate || 0) + userRot;
    const rotAttr = totalRot !== 0 ? `rotate(${totalRot}, ${tx}, ${ty})` : null;

    // Leader line from dimension-line anchor to text when offset
    if (hasOffset) {
      g.appendChild(
        se("line", {
          x1: anchorX,
          y1: anchorY,
          x2: tx,
          y2: ty,
          stroke,
          "stroke-width": sw * 0.8,
          "stroke-dasharray": `${sw * 3} ${sw * 2}`,
          "pointer-events": "none",
        }),
      );
    }

    // White background rect behind text (also serves as hit area for dragging)
    const pad = ts * 0.2;
    const charW = ts * 0.62;
    const bgW = String(val).length * charW + pad * 2;
    const bgH = ts * 0.82 + pad; // ascender height + top padding
    const bgY = ty - ts * 0.82 - pad;
    const bgX =
      textAnchor === "end"
        ? tx - bgW
        : textAnchor === "start"
          ? tx
          : tx - bgW / 2;
    const hitR = se("rect", {
      x: bgX,
      y: bgY,
      width: bgW,
      height: bgH + pad,
      fill: "white",
      "fill-opacity": "0.85",
      stroke: "none",
      rx: ts * 0.15,
      "data-dim-label": dim.id,
      cursor: "move",
      "pointer-events": "all",
    });
    if (rotAttr) hitR.setAttribute("transform", rotAttr);
    g.appendChild(hitR);

    // SVG <text> はフォントによって stroke 交差部が透明穴になり、
    // 白背景 rect が透けて見える。foreignObject で DOM テキスト描画する。
    const labelFo = se("foreignObject", {
      x: bgX,
      y: bgY,
      width: bgW,
      height: bgH + pad,
      overflow: "visible",
      "pointer-events": "none",
    });
    const labelDiv = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    );
    labelDiv.className = "millrect-dim-label";
    labelDiv.style.fontSize = `${ts}px`;
    labelDiv.style.fontFamily = dim.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    labelDiv.style.color = stroke;
    labelDiv.style.lineHeight = `${bgH + pad}px`;
    labelDiv.style.height = "100%";
    labelDiv.style.display = "flex";
    labelDiv.style.alignItems = "center";
    labelDiv.style.justifyContent =
      textAnchor === "end"
        ? "flex-end"
        : textAnchor === "start"
          ? "flex-start"
          : "center";
    labelDiv.style.whiteSpace = "nowrap";
    labelDiv.style.userSelect = "none";
    labelDiv.style.margin = "0";
    labelDiv.style.padding = "0";
    labelDiv.textContent = String(val);
    labelFo.appendChild(labelDiv);
    if (rotAttr) labelFo.setAttribute("transform", rotAttr);
    g.appendChild(labelFo);
  }

  if (dim.dimensionType === "horizontal") {
    const x1 = rtp(dim.from.x, scale);
    const yf = rtp(dim.from.y, scale);
    const x2 = rtp(dim.to.x, scale);
    const offP = rtp(dim.offset || -80, scale);
    const dimY = yf + offP;
    const above = offP < 0;
    const ey1 = above ? yf - gap : yf + gap;
    const ey2 = dimY + (above ? over : -over);
    addHitLine(g, x1, ey1, x1, ey2);
    addHitLine(g, x2, ey1, x2, ey2);
    addHitLine(g, x1, dimY, x2, dimY);
    g.appendChild(
      se("line", {
        x1,
        y1: ey1,
        x2: x1,
        y2: ey2,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    g.appendChild(
      se("line", {
        x1: x2,
        y1: ey1,
        x2: x2,
        y2: ey2,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    g.appendChild(
      se("line", {
        x1,
        y1: dimY,
        x2,
        y2: dimY,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    arrowHead(g, x1, dimY, 0, 2.5, stroke, arrowStyle);
    arrowHead(g, x2, dimY, Math.PI, 2.5, stroke, arrowStyle);
    const rawVal = dimensionValueMM(dim);
    const mx = (x1 + x2) / 2;
    const defaultTy = dimY - ts * 0.7;
    addDimLabel(formatDimValue(rawVal), mx, defaultTy, null, mx, dimY);
  } else if (dim.dimensionType === "vertical") {
    const xf = rtp(dim.from.x, scale);
    const y1 = rtp(dim.from.y, scale);
    const y2 = rtp(dim.to.y, scale);
    const offP = rtp(dim.offset || -80, scale);
    const dimX = xf + offP;
    const left = offP < 0;
    const ex1 = left ? xf - gap : xf + gap;
    const ex2 = dimX + (left ? over : -over);
    addHitLine(g, ex1, y1, ex2, y1);
    addHitLine(g, ex1, y2, ex2, y2);
    addHitLine(g, dimX, y1, dimX, y2);
    g.appendChild(
      se("line", {
        x1: ex1,
        y1,
        x2: ex2,
        y2: y1,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    g.appendChild(
      se("line", {
        x1: ex1,
        y1: y2,
        x2: ex2,
        y2: y2,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    g.appendChild(
      se("line", {
        x1: dimX,
        y1,
        x2: dimX,
        y2,
        stroke,
        "stroke-width": sw,
        "pointer-events": "none",
      }),
    );
    arrowHead(g, dimX, y1, Math.PI / 2, 2.5, stroke, arrowStyle);
    arrowHead(g, dimX, y2, -Math.PI / 2, 2.5, stroke, arrowStyle);
    const rawVal = dimensionValueMM(dim);
    const my = (y1 + y2) / 2;
    const defaultTx = dimX - ts * 0.5;
    addDimLabel(formatDimValue(rawVal), defaultTx, my, 0, dimX, my, "end");
  }
  return g;
}

// ── Renderer ──────────────────────────────────────────────────
let _svg = null,
  _vp = null,
  _marquee = null;

function initRenderer(svgElement) {
  _svg = svgElement;
  _svg.appendChild(se("defs"));
  _vp = se("g", { id: "vp" });
  _svg.appendChild(_vp);
}

function realToPaper(v, scale) {
  return realToPaperDist(v, scale);
}

// Measure text in paper units using a hidden DOM element (matches foreignObject layout)
let _textMeasureEl = null;
function measureTextHeight(shape, paperWidth) {
  return measureTextLayout(shape, paperWidth).h;
}

function measureTextWidth(shape, scale) {
  scale = scale || getCurrentPage()?.scale;
  if (textHasFixedWidth(shape) && scale) {
    return realToPaper(shape.width, scale);
  }
  if (scale && typeof getTextNativePreviewChildren === "function") {
    const preview = getTextNativePreviewChildren(shape.id, shape, scale);
    if (preview?.length) {
      const bb = textNativePreviewBBoxPaper(preview, scale);
      if (bb) return bb.w;
    }
  }
  return measureTextLayout(shape, null).w;
}

function applyTextShapeInset(el, layout) {
  el.style.marginTop = layout?.insetTop ? `${layout.insetTop}px` : "0";
  el.style.marginLeft = layout?.insetLeft ? `${layout.insetLeft}px` : "0";
}

function _getTextMeasureEl() {
  if (!_textMeasureEl) {
    _textMeasureEl = document.createElement("div");
    _textMeasureEl.className = "millrect-text-measure";
    document.body.appendChild(_textMeasureEl);
  }
  return _textMeasureEl;
}

function textShapeLineHeight(shape) {
  const lh = Number(shape?.lineHeight);
  if (!Number.isFinite(lh)) return 1;
  return Math.max(0.5, Math.min(4, lh));
}

function textShapeInkColor(shape) {
  const valid = (c) =>
    typeof c === "string" &&
    c &&
    c !== "none" &&
    c !== "transparent" &&
    !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(c);
  if (valid(shape?.fill)) return shape.fill;
  if (valid(shape?.stroke)) return shape.stroke;
  return "#1a1a2e";
}

function applyTextShapeElementStyle(el, shape) {
  const fs = shape.fontSize ?? 3.5;
  const color = textShapeInkColor(shape);
  el.style.color = color;
  el.style.fontSize = `${fs}px`;
  el.style.fontFamily =
    normalizeTextFontFamily(shape.fontFamily) || DEFAULT_TEXT_FONT_FAMILY;
  el.style.fontWeight = shape.fontWeight === "bold" ? "700" : "400";
  el.style.textAlign = shape.textAlign || "left";
  el.style.lineHeight = String(textShapeLineHeight(shape));
  el.style.margin = "0";
  el.style.padding = "0";
  el.style.padding = "0";
  el.style.border = "0";
  el.style.height = "auto";
  el.style.boxSizing = "border-box";
  el.style.whiteSpace = "pre-wrap";
  el.style.wordBreak = "break-word";
}

function measureTextLayoutDom(shape, paperWidth) {
  const el = _getTextMeasureEl();
  const fs = shape.fontSize ?? 3.5;
  applyTextShapeElementStyle(el, shape);
  el.style.marginTop = "0";
  el.style.marginLeft = "0";
  if (paperWidth != null && paperWidth > 0) el.style.width = `${paperWidth}px`;
  else el.style.width = "max-content";

  const text = shape.text ?? "";
  el.textContent = text || "\u200b";

  if (!text) {
    const lh = textShapeLineHeight(shape);
    return { w: Math.max(fs * 0.25, 1), h: fs * lh, insetTop: 0, insetLeft: 0 };
  }

  const elRect = el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width || r.height);

  if (rects.length > 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const r of rects) {
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
    }
    const insetTop = Math.max(0, elRect.top - minY);
    const insetLeft = Math.max(0, minX - elRect.left);
    const pad = Math.max(0.5, fs * 0.06);
    return {
      w: Math.max(1, maxX - minX + pad),
      h: Math.max(1, maxY - minY + pad * 0.25),
      insetTop,
      insetLeft,
    };
  }

  const w = Math.max(1, el.scrollWidth);
  const h = Math.max(el.scrollHeight, fs);
  return { w: w + fs * 0.1, h, insetTop: 0, insetLeft: 0 };
}

function measureTextLayout(shape, paperWidth) {
  const scale = getCurrentPage()?.scale;
  if (scale && shape?.id && typeof getTextNativeLayoutMetrics === "function") {
    const metrics = getTextNativeLayoutMetrics(shape.id, shape, scale);
    if (metrics?.layoutPaper) {
      const fixedW = textHasFixedWidth(shape);
      const expectedW = fixedW ? realToPaper(shape.width, scale) : null;
      const pw = paperWidth != null && paperWidth > 0 ? paperWidth : null;
      if (pw === expectedW || (pw == null && !fixedW)) {
        return metrics.layoutPaper;
      }
    }
  }
  return measureTextLayoutDom(shape, paperWidth);
}

function measureTextOutlineMetricsDom(shape, scale) {
  const boxPaperW = textPaperWidth(shape, scale);
  const layout = measureTextLayoutDom(shape, boxPaperW);
  const anchorPaper = {
    x: realToPaper(shape.x, scale),
    y: realToPaper(shape.y, scale),
  };
  const fs = shape.fontSize ?? 3.5;
  const lh = textShapeLineHeight(shape);

  const el = _getTextMeasureEl();
  applyTextShapeElementStyle(el, shape);
  applyTextShapeInset(el, layout);
  if (boxPaperW > 0) el.style.width = `${boxPaperW}px`;
  else el.style.width = "max-content";

  const fullText = shape.text ?? "";
  el.textContent = fullText || "\u200b";
  const elRect = el.getBoundingClientRect();
  const textLines = fullText.split("\n");
  const textNode = el.firstChild;
  const lines = [];
  let offset = 0;

  for (let lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
    const lineText = textLines[lineIndex];
    let xPaper = anchorPaper.x;
    let yTopPaper = anchorPaper.y + lineIndex * fs * lh;

    if (
      lineText.length > 0 &&
      textNode &&
      textNode.nodeType === Node.TEXT_NODE
    ) {
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + lineText.length);
      const rects = [...range.getClientRects()].filter(
        (r) => r.width || r.height,
      );
      if (rects.length > 0) {
        const r = rects[0];
        xPaper = anchorPaper.x + (r.left - elRect.left);
        // 1行目は foreignObject 上端 = インク上端（inset 補正済み）
        yTopPaper =
          lineIndex === 0
            ? anchorPaper.y
            : anchorPaper.y + (r.top - elRect.top);
      }
    } else if (lineIndex > 0 && lines[lineIndex - 1]) {
      yTopPaper = lines[lineIndex - 1].yTopPaper + fs * lh;
    }

    lines.push({
      text: lineText,
      lineIndex,
      xPaper,
      yTopPaper,
    });
    offset += lineText.length;
    if (lineIndex < textLines.length - 1) offset += 1;
  }

  return { anchorPaper, layoutPaper: layout, lines };
}

function measureTextOutlineMetrics(shape, scale) {
  if (shape?.id && typeof getTextNativeLayoutMetrics === "function") {
    const cached = getTextNativeLayoutMetrics(shape.id, shape, scale);
    if (cached?.lines) return cached;
  }
  return measureTextOutlineMetricsDom(shape, scale);
}

function textHasFixedWidth(shape) {
  return shape.width != null && shape.width > 0;
}

function getTextLayoutBoxPaper(shape, scale) {
  const anchorX = realToPaper(shape.x, scale);
  const anchorY = realToPaper(shape.y, scale);
  const fixedW = textHasFixedWidth(shape);
  const pw = textPaperWidth(shape, scale);
  const layout = measureTextLayout(shape, pw);
  let h = layout.h;

  // 行高は layout 基準。glyph がはみ出す場合のみ下端を延長（幅は typographic frame）
  const preview =
    typeof getTextNativePreviewChildren === "function"
      ? getTextNativePreviewChildren(shape.id, shape, scale)
      : null;
  if (preview?.length) {
    const inkBb = textNativePreviewBBoxPaper(preview, scale);
    if (inkBb) {
      h = Math.max(h, inkBb.y + inkBb.h - anchorY);
    }
  }

  return {
    x: anchorX,
    y: anchorY,
    w: fixedW ? pw : layout.w,
    h,
  };
}

function computeTextRealWidth(shape, scale) {
  scale = scale || getCurrentPage().scale;
  const bb = getTextLayoutBoxPaper(shape, scale);
  return paperToRealDist(bb.w, scale);
}

function textPaperWidth(shape, scale) {
  if (textHasFixedWidth(shape)) return realToPaper(shape.width, scale);
  return measureTextWidth(shape, scale);
}

let _rafPending = false;

function render() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(_doRender);
}

// パン専用の軽量更新。パンは vp の translate が変わるだけで、図形・グリッド・
// 選択ハンドル等の中身は一切変わらない（ズームと違いストローク幅 1/zoom にも
// 影響しない）。フルレンダーを呼ばず transform だけ書き換える。
function applyViewportTransform() {
  if (!_vp || _isPrintRenderMode()) return;
  const state = getState();
  _vp.setAttribute(
    "transform",
    `translate(${state.panX},${state.panY}) scale(${state.zoom})`,
  );
}

function _isPrintRenderMode() {
  return document.getElementById("app")?.classList.contains("mode-print");
}

function _doRender() {
  _rafPending = false;
  if (!_svg || !_vp) return;
  const state = getState();
  const page = getCurrentPage();
  const { width: pw, height: ph } = getPaperDimensions(page);
  const printMode = _isPrintRenderMode();
  const renderZoom = printMode ? 1 : state.zoom;
  if (printMode) {
    _svg.setAttribute("viewBox", `0 0 ${pw} ${ph}`);
    _svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  } else {
    _svg.removeAttribute("viewBox");
    _svg.removeAttribute("preserveAspectRatio");
  }
  _vp.setAttribute(
    "transform",
    printMode
      ? "translate(0,0) scale(1)"
      : `translate(${state.panX},${state.panY}) scale(${state.zoom})`,
  );
  _vp.replaceChildren();
  renderPaper(pw, ph, renderZoom);
  const refSelected =
    !printMode &&
    typeof isReferenceImageSelected === "function" &&
    isReferenceImageSelected();
  if (page.referenceImage?.dataUrl && (!refSelected || printMode)) {
    renderReferenceImage(page, renderZoom);
  }
  if (!printMode && typeof getReferenceScaleAnchorState === "function") {
    const anchor = getReferenceScaleAnchorState();
    if (anchor)
      renderReferenceScaleAnchorOverlay(anchor, page.scale, renderZoom);
  }
  if (state.showGrid && !printMode) renderGrid(pw, ph, renderZoom);
  renderShapes(page, printMode ? [] : state.selectedShapeIds);
  if (state.showViewGuides && !printMode)
    renderViewGuides(page, pw, ph, renderZoom);
  if (!printMode && page.referenceImage?.dataUrl && refSelected) {
    renderReferenceImage(page, renderZoom);
    renderReferenceImageEditOverlay(page, renderZoom);
  }
  if (!printMode && state.selectedShapeIds.length > 0)
    renderSelectionHandles(state.selectedShapeIds, page, renderZoom);
  if (!printMode && _marquee) _renderMarqueeRect(_marquee.a, _marquee.b);
  // ベジェ描画中のオーバーレイは再描画のたびにここで復元する。
  // render() は rAF 遅延のため、イベントハンドラ側の手動 append だけだと
  // 次フレームの replaceChildren で消えてチラつく
  if (!printMode && typeof renderBezierOverlay === "function")
    renderBezierOverlay();
  if (typeof window.__3d_render_hook === "function") window.__3d_render_hook();
}

function _renderMarqueeRect(a, b) {
  const el = se("rect", {
    id: "marquee-rect",
    fill: "rgba(37,99,235,0.08)",
    stroke: "#2563eb",
    "stroke-width": 0.5 / getState().zoom,
    "stroke-dasharray": `${3 / getState().zoom} ${2 / getState().zoom}`,
    "pointer-events": "none",
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  });
  _vp.appendChild(el);
}

function setMarquee(a, b) {
  _marquee = { a, b };
}
function clearMarquee() {
  _marquee = null;
}

function renderPaper(w, h, zoom) {
  _vp.appendChild(
    se("rect", {
      x: 2 / zoom,
      y: 2 / zoom,
      width: w,
      height: h,
      fill: "#c8c8c8",
      rx: 0.5 / zoom,
    }),
  );
  _vp.appendChild(
    se("rect", {
      x: 0,
      y: 0,
      width: w,
      height: h,
      fill: "#fff",
      stroke: "#999",
      "stroke-width": 0.3 / zoom,
    }),
  );
}

function renderReferenceImage(page, zoom) {
  const img = page.referenceImage;
  if (!img?.dataUrl) return;
  const scale = page.scale || { numerator: 1, denominator: 1 };
  const x = realToPaper(img.x, scale);
  const y = realToPaper(img.y, scale);
  const w = realToPaperDist(img.width, scale);
  const h = realToPaperDist(img.height, scale);
  const g = se("g", { id: "reference-image-layer" });
  const el = se("image", {
    href: img.dataUrl,
    x,
    y,
    width: w,
    height: h,
    opacity: img.opacity ?? 0.45,
    preserveAspectRatio: "none",
    "pointer-events": "all",
  });
  el.setAttribute("id", "reference-image");
  g.appendChild(el);
  _vp.appendChild(g);
}

function renderReferenceImageEditOverlay(page, zoom) {
  const img = page.referenceImage;
  if (!img?.dataUrl) return;
  const scale = page.scale || { numerator: 1, denominator: 1 };
  const sw = 0.35 / zoom;
  const hs = 5.5 / zoom;
  const x = realToPaper(img.x, scale);
  const y = realToPaper(img.y, scale);
  const w = realToPaperDist(img.width, scale);
  const h = realToPaperDist(img.height, scale);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [
    [x, y],
    [cx, y],
    [x + w, y],
    [x + w, cy],
    [x + w, y + h],
    [cx, y + h],
    [x, y + h],
    [x, cy],
  ];
  const g = se("g", {
    id: "reference-image-edit-overlay",
    style: "user-select:none;-webkit-user-select:none",
  });

  g.appendChild(
    se("rect", {
      x: x - 1 / zoom,
      y: y - 1 / zoom,
      width: w + 2 / zoom,
      height: h + 2 / zoom,
      fill: "none",
      stroke: "#2563eb",
      "stroke-width": sw,
      "stroke-dasharray": `${4 / zoom} ${2 / zoom}`,
      "pointer-events": "none",
    }),
  );

  for (let i = 0; i < pts.length; i++) {
    const [hx, hy] = pts[i];
    g.appendChild(
      se("rect", {
        x: hx - hs / 2,
        y: hy - hs / 2,
        width: hs,
        height: hs,
        fill: "#fff",
        stroke: "#2563eb",
        "stroke-width": sw,
        "data-ref-hi": String(i),
        cursor: HANDLE_CURSORS[i],
      }),
    );
  }

  _vp.appendChild(g);
}

function renderReferenceScaleAnchorOverlay(anchor, scale, zoom) {
  const g = se("g", { id: "reference-scale-anchor", "pointer-events": "none" });
  const rtp = (v) => realToPaper(v, scale);
  const dotR = 4 / zoom;
  const strokeW = 1.5 / zoom;
  const dash = `${6 / zoom} ${4 / zoom}`;

  const addDot = (pt, fill) => {
    g.appendChild(
      se("circle", {
        cx: rtp(pt.x),
        cy: rtp(pt.y),
        r: dotR,
        fill,
        stroke: "#fff",
        "stroke-width": strokeW,
      }),
    );
  };

  if (anchor.from) addDot(anchor.from, "#2563eb");
  if (anchor.to) addDot(anchor.to, "#dc2626");

  const lineEnd = anchor.to || anchor.cursor;
  if (anchor.from && lineEnd) {
    g.appendChild(
      se("line", {
        x1: rtp(anchor.from.x),
        y1: rtp(anchor.from.y),
        x2: rtp(lineEnd.x),
        y2: rtp(lineEnd.y),
        stroke: "#2563eb",
        "stroke-width": strokeW,
        "stroke-dasharray": dash,
      }),
    );
  }

  _vp.appendChild(g);
}

// ── ビューガイド（見通し線）──────────────────────────────────
//
// 他ページの正投影ビューの輪郭位置を、共有する 3D 軸に沿って現在ページへ
// 投影し、破線ガイドとして表示する（製図の「見通し線」相当）。
// 軸対応は 3d-view.js の _profileToThreeShapesForView / _applyViewTransform
// と同じ規約に従う:
//   X(幅) t∈[0,W] / Y(高さ) t∈[0,H] / Z(奥行) t∈[0,D]
// dir=-1 はビュー内でページ座標が軸と逆向きに走ることを示す。
const _VIEW_GUIDE_AXES = {
  top: { x: { axis: "X", dir: 1 }, y: { axis: "Z", dir: -1 } },
  bottom: { x: { axis: "X", dir: 1 }, y: { axis: "Z", dir: 1 } },
  front: { x: { axis: "X", dir: 1 }, y: { axis: "Y", dir: -1 } },
  back: { x: { axis: "X", dir: -1 }, y: { axis: "Y", dir: -1 } },
  right: { x: { axis: "Z", dir: 1 }, y: { axis: "Y", dir: -1 } },
  left: { x: { axis: "Z", dir: -1 }, y: { axis: "Y", dir: -1 } },
};

function _guideViewType(type) {
  if (!type) return null;
  if (type === "section" || type === "detail" || type === "plan") return "top";
  return _VIEW_GUIDE_AXES[type] ? type : null;
}

function _guideFrameForPage(page) {
  if (typeof extractProfilesFromPage !== "function") return null;
  // 不正な図形で Profile 抽出が失敗しても描画を止めない
  let profiles;
  try {
    profiles = extractProfilesFromPage(page);
  } catch {
    return null;
  }
  const boxes = profiles.map((p) => p.bbox).filter(Boolean);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return { minX, minY, w: maxX - minX, h: maxY - minY, boxes };
}

// ガイド位置を計算して返す（描画とスナップで共用）。
// 戻り値: { v: Map(paperX→出典ビュー名), h: Map(paperY→出典ビュー名) } | null
function computeViewGuides(page) {
  const curType = _guideViewType(page.viewDefinition?.type);
  const curAxes = curType && _VIEW_GUIDE_AXES[curType];
  if (!curAxes) return null;
  const state = getState();
  const curFrame = _guideFrameForPage(page);

  // paper 座標（丸め）→ 出典ビュー名。重複ガイドを統合する
  const vGuides = new Map();
  const hGuides = new Map();

  for (const other of state.pages) {
    if (other.id === page.id) continue;
    const oType = _guideViewType(other.viewDefinition?.type);
    const oAxes = oType && _VIEW_GUIDE_AXES[oType];
    if (!oAxes) continue;
    const oFrame = _guideFrameForPage(other);
    if (!oFrame) continue;

    for (const oPageAxis of ["x", "y"]) {
      const oMap = oAxes[oPageAxis];
      for (const cPageAxis of ["x", "y"]) {
        const cMap = curAxes[cPageAxis];
        if (oMap.axis !== cMap.axis) continue;
        const oMin = oPageAxis === "x" ? oFrame.minX : oFrame.minY;
        const oSize = oPageAxis === "x" ? oFrame.w : oFrame.h;
        // 現ページがまだ空のときは出典ビューと同じ位置に重ねて表示する
        // （上面図の真下に正面図を描く製図配置を想定）
        let cMin, cSize;
        if (curFrame) {
          cMin = cPageAxis === "x" ? curFrame.minX : curFrame.minY;
          cSize = cPageAxis === "x" ? curFrame.w : curFrame.h;
        } else {
          cMin = oMin;
          cSize = oSize;
        }
        for (const bb of oFrame.boxes) {
          const vals =
            oPageAxis === "x" ? [bb.x, bb.x + bb.w] : [bb.y, bb.y + bb.h];
          for (const v of vals) {
            const t = oMap.dir > 0 ? v - oMin : oSize - (v - oMin);
            const cl = cMap.dir > 0 ? t : cSize - t;
            const paper = realToPaper(cMin + cl, page.scale);
            const key = Math.round(paper * 100) / 100;
            (cPageAxis === "x" ? vGuides : hGuides).set(key, oType);
          }
        }
      }
    }
  }

  return { v: vGuides, h: hGuides };
}

// スナップ用ガイド取得（ページ単位キャッシュ）。
// 戻り値: { v: [paperX...], h: [paperY...] } | null
let _viewGuidesCache = null; // { pageId, guides }
function getViewSnapGuides() {
  const state = getState();
  if (!state.showViewGuides) return null;
  const page = getCurrentPage();
  if (!_viewGuidesCache || _viewGuidesCache.pageId !== page.id) {
    _viewGuidesCache = { pageId: page.id, guides: computeViewGuides(page) };
  }
  const g = _viewGuidesCache.guides;
  if (!g || (!g.v.size && !g.h.size)) return null;
  return { v: [...g.v.keys()], h: [...g.h.keys()] };
}

function renderViewGuides(page, pw, ph, zoom) {
  const guides = computeViewGuides(page);
  _viewGuidesCache = { pageId: page.id, guides };
  if (!guides) return;
  const { v: vGuides, h: hGuides } = guides;
  if (!vGuides.size && !hGuides.size) return;
  const g = se("g", { id: "view-guides", "pointer-events": "none" });
  const sw = 1 / zoom;
  const dash = `${6 / zoom} ${4 / zoom}`;
  const fontSize = 9 / zoom;
  const guideLine = (attrs) =>
    g.appendChild(
      se("line", {
        stroke: "#0ea5e9",
        "stroke-width": sw,
        "stroke-dasharray": dash,
        opacity: "0.55",
        ...attrs,
      }),
    );
  const guideLabel = (x, y, viewType, vertical) => {
    const label =
      typeof t === "function"
        ? t("view.type." + viewType).replace(/\s*\([^)]*\)\s*$/, "")
        : viewType;
    const el = se("text", {
      x,
      y,
      fill: "#0ea5e9",
      opacity: "0.7",
      "font-size": fontSize,
      "font-family": "sans-serif",
      ...(vertical ? { transform: `rotate(90 ${x} ${y})` } : {}),
    });
    el.textContent = label;
    g.appendChild(el);
  };
  for (const [px, oType] of vGuides) {
    guideLine({ x1: px, y1: 0, x2: px, y2: ph });
    guideLabel(px + 2 / zoom, 2 / zoom, oType, true);
  }
  for (const [py, oType] of hGuides) {
    guideLine({ x1: 0, y1: py, x2: pw, y2: py });
    guideLabel(2 / zoom, py - 2 / zoom, oType, false);
  }
  _vp.appendChild(g);
}

// グリッドは 10mm タイルの <pattern> 1 枚 ＋ それを塗る <rect> 1 枚で描く。
// 以前は用紙サイズに比例した数千本の <line> を毎フレーム生成していた
// （A4 横で ~5000 要素）。pattern 化で要素数を用紙サイズと無関係な定数に抑える。
function renderGrid(pw, ph, zoom) {
  const show1 = zoom >= 1.5;
  const show5 = zoom >= 1.0;
  const TILE = 10; // 10mm メジャータイル
  const defs = _svg.querySelector("defs");
  // ズームでストローク幅(=1/zoom)と表示レベルが変わるため毎回作り直す（≤ ~20 要素）
  defs.querySelector("#grid-pattern")?.remove();
  const pat = se("pattern", {
    id: "grid-pattern",
    patternUnits: "userSpaceOnUse",
    width: TILE,
    height: TILE,
    x: 0,
    y: 0,
  });
  const ln = (x1, y1, x2, y2, stroke, sw) =>
    pat.appendChild(se("line", { x1, y1, x2, y2, stroke, "stroke-width": sw }));
  if (show1) {
    for (let mm = 1; mm < TILE; mm++) {
      if (mm % 5 === 0) continue;
      ln(mm, 0, mm, TILE, "#ebebeb", 0.15 / zoom);
      ln(0, mm, TILE, mm, "#ebebeb", 0.15 / zoom);
    }
  }
  if (show5) {
    ln(5, 0, 5, TILE, "#ddd", 0.2 / zoom);
    ln(0, 5, TILE, 5, "#ddd", 0.2 / zoom);
  }
  // 10mm メジャー線はタイル境界（x=0 / y=0）に置く。タイリングで全面に繰り返される
  ln(0, 0, 0, TILE, "#ccc", 0.3 / zoom);
  ln(0, 0, TILE, 0, "#ccc", 0.3 / zoom);
  defs.appendChild(pat);
  _vp.appendChild(
    se("rect", {
      id: "grid",
      x: 0,
      y: 0,
      width: pw,
      height: ph,
      fill: "url(#grid-pattern)",
      "pointer-events": "none",
    }),
  );
}

// ── 図形レイヤーのキャッシュ（変更検知）─────────────────────────
// renderShape は (shape, scale) のみに依存し zoom / 選択状態には依存しない。
// そのため図形が変わっていないフレーム（パン・ズーム・マーキー・スナップ・
// 描画プレビュー・選択切替）では #shape-root を作り直さず再利用でき、
// DOM 生成とテキスト reflow をまるごと省ける。
let _shapeRootCache = null; // { sig, node }

function invalidateShapeCache() {
  _shapeRootCache = null;
}

// 図形描画結果を決める入力だけを署名化する。テキストは HarfBuzz の非同期計測
// （text-outline.js）でレイアウトが後から変わるため、そのバージョンも含める。
function _shapesSig(page) {
  const tlv =
    typeof textLayoutCacheVersion === "function" ? textLayoutCacheVersion() : 0;
  const sc = page.scale
    ? `${page.scale.numerator}/${page.scale.denominator}`
    : "1/1";
  const docv =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : 0;
  const layers = page.layers
    .map(
      (l) =>
        `${l.id}:${l.visible ? 1 : 0}:${l.locked ? 1 : 0}:${l.shapes.length}`,
    )
    .join(",");
  return `${docv}|${tlv}|${page.id}|${sc}|${layers}|${(page.dimensions || []).length}`;
}

function _cssEsc(s) {
  return window.CSS && CSS.escape
    ? CSS.escape(String(s))
    : String(s).replace(/[^\w-]/g, "\\$&");
}

// 1 図形ぶんの描画結果を決める入力の署名（key reconcile 用）。
function _shapeSig(shape, scale) {
  const sc = scale ? `${scale.numerator}/${scale.denominator}` : "1/1";
  const rv =
    typeof getShapeRenderVersion === "function"
      ? getShapeRenderVersion(shape.id)
      : JSON.stringify(shape);
  const tlv =
    shape.type === "text" && typeof textLayoutCacheVersion === "function"
      ? textLayoutCacheVersion()
      : 0;
  return `${shape.id}|${shape.type}|${sc}|${rv}|${tlv}`;
}

// コンテナ直下の図形ノードを data-id で突合して差分更新する（React の key+memo 相当）。
// data-sig が一致するノードはそのまま再利用（DOM 生成・テキスト reflow を回避）、
// 変わったものだけ作り直し、消えたものを削除、順序を desired に合わせる。
function _reconcileShapes(container, shapes, scale, selIds) {
  const existing = new Map();
  for (const ch of Array.from(container.children)) {
    const k = ch.getAttribute("data-id");
    if (k != null) existing.set(k, ch);
  }
  const keep = new Set();
  for (const shape of shapes) {
    keep.add(shape.id);
    const sig = _shapeSig(shape, scale);
    let node = existing.get(shape.id);
    if (!node || node.getAttribute("data-sig") !== sig) {
      const fresh = renderShape(shape, scale, selIds);
      if (!fresh) {
        if (node) node.remove();
        existing.delete(shape.id);
        continue;
      }
      fresh.setAttribute("data-sig", sig);
      if (node) node.replaceWith(fresh);
      node = fresh;
      existing.set(shape.id, node);
    }
    container.appendChild(node); // desired 順に並べ替え（既存ノードの移動は安価）
  }
  for (const [k, node] of existing) if (!keep.has(k)) node.remove();
}

// #shape-root のレイヤー群 + dimension-root を差分更新する。
function _reconcileShapeRoot(root, page, selIds) {
  const order = [];
  for (const layer of page.layers) {
    if (!layer.visible) continue;
    let lg = root.querySelector(`:scope > #layer-${_cssEsc(layer.id)}`);
    if (!lg) lg = se("g", { id: `layer-${layer.id}` });
    lg.setAttribute("opacity", layer.locked ? "0.6" : "1");
    _reconcileShapes(lg, layer.shapes, page.scale, selIds);
    order.push(lg);
  }
  // 寸法線アノテーションは常に最前面（レイヤーより上）
  let dg = root.querySelector(":scope > #dimension-root");
  if (!dg) dg = se("g", { id: "dimension-root" });
  _reconcileShapes(dg, page.dimensions || [], page.scale, selIds);
  order.push(dg);

  // 非表示になったレイヤー等、不要な最上位グループを削除してから順序を整える
  const keep = new Set(order);
  for (const ch of Array.from(root.children)) if (!keep.has(ch)) ch.remove();
  for (const node of order) root.appendChild(node);
}

function renderShapes(page, selIds) {
  const sig = _shapesSig(page);
  if (_shapeRootCache && _shapeRootCache.sig === sig && _shapeRootCache.node) {
    _vp.appendChild(_shapeRootCache.node); // 無変更: 作り直さず再アタッチ
    return;
  }
  // 変更あり: 既存ツリーを使い回して差分更新（1 図形編集で全再構築しない）
  let root = _shapeRootCache && _shapeRootCache.node;
  if (!root) root = se("g", { id: "shape-root" });
  _reconcileShapeRoot(root, page, selIds);
  _shapeRootCache = { sig, node: root };
  _vp.appendChild(root);
}

// ドラッグ中の差分更新: 動いた図形のノードだけを作り直して差し替える。
// 全再描画(_doRender)を介さないため、図形数に比例するコストを避けられる。
// 前回フルレンダーで作った #shape-root（キャッシュ）を直接編集し、
// sig を無効化して次のフルレンダー（ドラッグ終了時）で作り直させる。
function liveUpdateShapes(ids) {
  const root = _shapeRootCache && _shapeRootCache.node;
  if (!root || !root.isConnected) {
    render();
    return;
  }
  const page = getCurrentPage();
  const scale = page.scale;
  const selIds = getState().selectedShapeIds;
  for (const id of ids) {
    if (typeof markShapeDirty === "function") markShapeDirty(id);
    const old = root.querySelector(`[data-id="${_cssEsc(id)}"]`);
    const res = findShapeById(id);
    if (!res) {
      if (old) old.remove();
      continue;
    }
    const fresh = renderShape(res.shape, scale, selIds);
    if (old) {
      fresh ? old.replaceWith(fresh) : old.remove();
    } else if (fresh) {
      render(); // ノードが見つからない異常時は安全側でフルレンダー
      return;
    }
  }
  // 変更を反映済みだが座標は変わったので、次のフルレンダーで作り直させる
  if (_shapeRootCache) _shapeRootCache.sig = null;
  // 選択ハンドルは #shape-root の外（_vp 直下）なので個別に更新
  _vp.querySelector("#sel-handles")?.remove();
  if (selIds.length > 0) renderSelectionHandles(selIds, page, getState().zoom);
}

// ── ドラッグ中のライブ移動（transform のみ・DOM 非再生成）──────────
// グループのように子の多い図形を毎フレーム renderShape で作り直すと重い
// （renderShape(group) が全子要素を再生成する）。代わりに既存ノードへ
// translate を被せるだけにして 1 フレーム O(1) にする。実座標への確定は
// mouseup 時に一度だけ行う（interaction.js）。
function liveDragByTransform(ids, dxPaper, dyPaper) {
  const root = _shapeRootCache && _shapeRootCache.node;
  if (!root || !root.isConnected) return false;
  const tr = `translate(${dxPaper},${dyPaper})`;
  const apply = (node) => {
    // ノード本来の transform（回転・反転）を一度だけ退避し、その外側に
    // translate を被せる（合成順: translate → 既存）。
    let base = node.getAttribute("data-drag-base");
    if (base == null) {
      base = node.getAttribute("transform") || "";
      node.setAttribute("data-drag-base", base);
    }
    node.setAttribute("transform", base ? `${tr} ${base}` : tr);
  };
  const dimRoot = _vp.querySelector("#dimension-root");
  for (const id of ids) {
    const sel = `[data-id="${_cssEsc(id)}"]`;
    const node =
      root.querySelector(sel) || (dimRoot && dimRoot.querySelector(sel));
    if (!node) return false; // ノード未生成 → 呼び出し側で従来パスにフォールバック
    apply(node);
  }
  // 選択ハンドルも同じ変位で追従（ドラッグ開始時に一度だけ描かれている）
  const handles = _vp.querySelector("#sel-handles");
  if (handles) apply(handles);
  return true;
}

// ライブドラッグの transform を消して本来の transform に戻す。
// （複製開始など、確定前に DOM を素の状態へ戻したいときに使う）
function clearLiveDragTransforms() {
  if (!_vp) return;
  for (const node of _vp.querySelectorAll("[data-drag-base]")) {
    const base = node.getAttribute("data-drag-base");
    if (base) node.setAttribute("transform", base);
    else node.removeAttribute("transform");
    node.removeAttribute("data-drag-base");
  }
}

// 鉛筆の点列（real units）を滑らかな SVG path d（用紙座標）へ。
// Catmull-Rom スプラインを 3 次ベジェに変換して、雑なメモ線でも角張らないようにする。
function pencilPathToD(points, scale) {
  if (!points || points.length === 0) return "";
  const p = points.map((pt) => [
    realToPaper(pt.x, scale),
    realToPaper(pt.y, scale),
  ]);
  if (p.length === 1) {
    // 単一点はドット（同じ点への極小線分）として描く
    const [x, y] = p[0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  if (p.length === 2) {
    return `M ${p[0][0]} ${p[0][1]} L ${p[1][0]} ${p[1][1]}`;
  }
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function renderShape(shape, scale, selIds) {
  const sw = resolveStrokeWidthMm(shape.strokeWidth);
  const stroke = shape.stroke || "#1a1a2e";
  const fill = shape.fill || "none";
  const isGhost = Boolean(shape.ghost);
  const ghostDash = isGhost ? `${sw * 4} ${sw * 3}` : null;
  // User line style (dashed/dotted/dashdot). For non-line shapes it rides on the
  // group so every child inherits it; lines fold it into their own dash chain.
  const userDash = lineStyleDashArray(shape.strokeStyle, sw);

  const gAttrs = {
    "data-id": shape.id,
    "data-type": shape.type,
    cursor: "default",
  };
  if (isGhost) {
    gAttrs.opacity = "0.55";
    gAttrs["data-ghost"] = "true";
  }
  // テキストは子 path / foreignObject が個別に色を持つ。g の fill=none 継承を避ける
  if (shape.type !== "text") {
    gAttrs.fill = fill;
    gAttrs.stroke = stroke;
  }
  // Non-line shapes inherit the user dash from the group (per-element ghost/role
  // dashes still override it where set). Lines handle dash on their own element.
  if (shape.type !== "line" && !isGhost && userDash) {
    gAttrs["stroke-dasharray"] = userDash;
  }
  const g = se("g", gAttrs);

  if (shape.type === "line") {
    const x1 = realToPaper(shape.x1, scale),
      y1 = realToPaper(shape.y1, scale);
    const x2 = realToPaper(shape.x2, scale),
      y2 = realToPaper(shape.y2, scale);
    const cap = shape.strokeLinecap || "butt";
    // ghost は role より優先（digitize プレビュー）
    const roleStyle = isGhost ? null : lineRoleStyle(shape.role, sw);
    const dash = ghostDash || userDash || roleStyle?.dash || null;
    if (roleStyle?.opacity && !isGhost)
      g.setAttribute("opacity", roleStyle.opacity);
    g.appendChild(
      se("line", {
        x1,
        y1,
        x2,
        y2,
        stroke: "transparent",
        "stroke-width": Math.max(sw + 3, 4),
        "stroke-linecap": cap,
        "pointer-events": "stroke",
      }),
    );
    g.appendChild(
      se("line", {
        x1,
        y1,
        x2,
        y2,
        stroke,
        "stroke-width": sw,
        "stroke-linecap": cap,
        "pointer-events": "none",
        ...(dash ? { "stroke-dasharray": dash } : {}),
      }),
    );
  } else if (shape.type === "rect") {
    const rtp2 = (v) => realToPaper(v, scale);
    if (shape.rxMode === "individual") {
      const x = rtp2(shape.x),
        y = rtp2(shape.y),
        w = rtp2(shape.width),
        h = rtp2(shape.height);
      const tl = rtp2(shape.rxTL ?? 0),
        tr = rtp2(shape.rxTR ?? 0),
        br = rtp2(shape.rxBR ?? 0),
        bl = rtp2(shape.rxBL ?? 0);
      const d = `M ${x + tl},${y} L ${x + w - tr},${y} Q ${x + w},${y} ${x + w},${y + tr} L ${x + w},${y + h - br} Q ${x + w},${y + h} ${x + w - br},${y + h} L ${x + bl},${y + h} Q ${x},${y + h} ${x},${y + h - bl} L ${x},${y + tl} Q ${x},${y} ${x + tl},${y} Z`;
      g.appendChild(
        se("path", {
          d,
          stroke,
          "stroke-width": sw,
          fill,
          "pointer-events": "all",
          ...(ghostDash ? { "stroke-dasharray": ghostDash } : {}),
        }),
      );
    } else {
      const rectAttrs = {
        x: rtp2(shape.x),
        y: rtp2(shape.y),
        width: rtp2(shape.width),
        height: rtp2(shape.height),
        stroke,
        "stroke-width": sw,
        fill,
        "pointer-events": "all",
      };
      if (shape.rx) rectAttrs.rx = rtp2(shape.rx);
      if (ghostDash) rectAttrs["stroke-dasharray"] = ghostDash;
      g.appendChild(se("rect", rectAttrs));
    }
  } else if (shape.type === "image") {
    g.appendChild(
      se("image", {
        href: shape.dataUrl,
        x: realToPaper(shape.x, scale),
        y: realToPaper(shape.y, scale),
        width: realToPaper(shape.width, scale),
        height: realToPaper(shape.height, scale),
        opacity: shape.opacity ?? 1,
        preserveAspectRatio: "none",
        "pointer-events": "all",
      }),
    );
  } else if (shape.type === "circle") {
    g.appendChild(
      se("circle", {
        cx: realToPaper(shape.cx, scale),
        cy: realToPaper(shape.cy, scale),
        r: realToPaper(shape.r, scale),
        stroke,
        "stroke-width": sw,
        fill,
        "pointer-events": "all",
        ...(ghostDash ? { "stroke-dasharray": ghostDash } : {}),
      }),
    );
  } else if (shape.type === "ellipse") {
    g.appendChild(
      se("ellipse", {
        cx: realToPaper(shape.cx, scale),
        cy: realToPaper(shape.cy, scale),
        rx: realToPaper(shape.rx, scale),
        ry: realToPaper(shape.ry, scale),
        stroke,
        "stroke-width": sw,
        fill,
        "pointer-events": "all",
      }),
    );
  } else if (shape.type === "text") {
    const layoutBox = getTextLayoutBoxPaper(shape, scale);
    const fillColor = textShapeInkColor(shape);
    let preview =
      typeof getTextNativePreviewChildren === "function"
        ? getTextNativePreviewChildren(shape.id, shape, scale)
        : null;

    let pathCount = 0;
    if (preview?.length) {
      for (const child of preview) {
        let d = "";
        for (const polygon of child.contours || []) {
          for (const ring of polygon) {
            if (!ring.length) continue;
            d += `M ${ring.map(([x, y]) => `${realToPaper(x, scale)},${realToPaper(y, scale)}`).join(" L ")} Z `;
          }
        }
        if (!d.trim()) continue;
        pathCount++;
        g.appendChild(
          se("path", {
            d: d.trim(),
            stroke: "none",
            fill: fillColor,
            "fill-rule": child.fillRule || "nonzero",
            "pointer-events": "none",
          }),
        );
      }
    }

    if (!pathCount) {
      preview = null;
    }

    const showForeignObject =
      typeof shouldShowTextForeignObject === "function"
        ? shouldShowTextForeignObject(shape)
        : !preview?.length;

    if (!preview?.length && showForeignObject) {
      const px = layoutBox.x;
      const py = layoutBox.y;
      const fo = se("foreignObject", {
        x: px,
        y: py,
        width: layoutBox.w,
        height: layoutBox.h,
        overflow: "visible",
        "pointer-events": "none",
      });
      const div = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div",
      );
      div.className = "millrect-text-shape";
      applyTextShapeElementStyle(div, shape);
      const nativeLayout =
        typeof getTextNativeLayoutMetrics === "function"
          ? getTextNativeLayoutMetrics(shape.id, shape, scale)
          : null;
      const domLayout =
        nativeLayout?.layoutPaper ||
        measureTextLayoutDom(shape, textPaperWidth(shape, scale));
      applyTextShapeInset(div, domLayout);
      div.style.pointerEvents = "none";
      div.style.userSelect = "none";
      div.textContent = shape.text || "";
      fo.appendChild(div);
      g.appendChild(fo);
    }

    if (
      !preview?.length &&
      typeof isTextNativePreviewEnabled === "function" &&
      isTextNativePreviewEnabled() &&
      shape.text &&
      /\S/.test(shape.text) &&
      !(
        typeof isTextNativeLiveTransform === "function" &&
        isTextNativeLiveTransform(shape.id)
      )
    ) {
      scheduleTextNativeLayout(shape.id, 0);
      scheduleTextNativePreview(shape.id, 0);
    }

    g.appendChild(
      se("rect", {
        x: layoutBox.x,
        y: layoutBox.y,
        width: layoutBox.w,
        height: layoutBox.h,
        fill: "transparent",
        stroke: "none",
        "pointer-events": "all",
      }),
    );
  } else if (shape.type === "rawpath") {
    // Text-outline compound path: d is in paper units at (0,0), shifted by real anchor
    const ox = realToPaper(shape.x, scale);
    const oy = realToPaper(shape.y, scale);
    g.appendChild(
      se("path", {
        d: shape.d,
        transform: `translate(${ox},${oy})`,
        fill: shape.fill || stroke,
        "fill-rule": "evenodd",
        stroke: "none",
        "pointer-events": "all",
      }),
    );
  } else if (shape.type === "path") {
    let d = "";
    for (const polygon of shape.contours) {
      for (const ring of polygon) {
        if (!ring.length) continue;
        d += `M ${ring.map(([x, y]) => `${realToPaper(x, scale)},${realToPaper(y, scale)}`).join(" L ")} Z `;
      }
    }
    g.appendChild(
      se("path", {
        d: d.trim(),
        stroke,
        "stroke-width": sw,
        fill,
        "fill-rule": shape.fillRule || "evenodd",
        "pointer-events": "all",
      }),
    );
  } else if (shape.type === "bezier") {
    const d = bezierPathToD(shape.nodes, shape.closed, scale);
    if (d) {
      g.appendChild(
        se("path", {
          d,
          stroke,
          "stroke-width": sw,
          fill,
          "fill-rule": "evenodd",
          "pointer-events": "all",
        }),
      );
    }
  } else if (shape.type === "pencil") {
    const d = pencilPathToD(shape.points, scale);
    if (d) {
      const pw = Number(shape.penWidth) || 1.0;
      // 太い透明ストロークで掴みやすくする（細いメモ線でも選択できる）
      g.appendChild(
        se("path", {
          d,
          stroke: "transparent",
          "stroke-width": Math.max(pw + 2, 4),
          fill: "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "pointer-events": "stroke",
        }),
      );
      g.appendChild(
        se("path", {
          d,
          stroke,
          "stroke-width": pw,
          fill: "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "pointer-events": "none",
          ...(ghostDash ? { "stroke-dasharray": ghostDash } : {}),
        }),
      );
    }
  } else if (shape.type === "dimension") {
    return renderDimensionSVG(shape, scale);
  } else if (shape.type === "group") {
    for (const child of shape.children) {
      const cel = renderShape(child, scale, []);
      if (cel) g.appendChild(cel);
    }
  }

  if (shape.rotation) {
    const pivot =
      shape.type === "group"
        ? getGroupLocalPivotPaper(shape, scale)
        : getShapeLocalPivotPaper(shape, scale);
    if (pivot) {
      g.setAttribute(
        "transform",
        `rotate(${shape.rotation},${pivot.x},${pivot.y})`,
      );
    }
  }

  if (shape.flipH || shape.flipV) {
    const pivot =
      shape.type === "group"
        ? getGroupLocalPivotPaper(shape, scale)
        : getShapeLocalPivotPaper(shape, scale);
    if (pivot) {
      const cx = pivot.x;
      const cy = pivot.y;
      const sx = shape.flipH ? -1 : 1;
      const sy = shape.flipV ? -1 : 1;
      const existing = g.getAttribute("transform") || "";
      const flip = `scale(${sx},${sy})`;
      g.setAttribute(
        "transform",
        `translate(${cx},${cy}) ${flip} translate(${-cx},${-cy})${existing ? " " + existing : ""}`,
      );
    }
  }

  return g;
}

function getShapeLocalPivotPaper(shape, scale) {
  const sample = sampleShapePointsReal(shape);
  if (!sample.length) return null;
  const paper = sample.map(([x, y]) => [
    realToPaper(x, scale),
    realToPaper(y, scale),
  ]);
  const bb = aabbFromPoints(paper);
  if (!bb) return null;
  return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
}

function getGroupLocalPivotPaper(shape, scale, ancestorGroups = []) {
  if (!ancestorGroups.length) {
    const bb = getShapeLocalBBoxPaper(shape, scale);
    return bb ? { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 } : null;
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const child of shape.children || []) {
    const bb = getShapeBBox(child, scale, ancestorGroups);
    if (!bb) continue;
    if (bb.x < minX) minX = bb.x;
    if (bb.y < minY) minY = bb.y;
    if (bb.x + bb.w > maxX) maxX = bb.x + bb.w;
    if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
  }
  if (!isFinite(minX)) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function getShapeBBox(shape, scale, ancestorGroups) {
  if (
    ancestorGroups === undefined &&
    shape?.type !== "group" &&
    shape?.id &&
    typeof findAncestorGroups === "function"
  ) {
    ancestorGroups = findAncestorGroups(shape.id);
  }
  ancestorGroups = ancestorGroups || [];

  if (shape.type === "group") {
    return _getCachedShapeBBox(shape, scale, ancestorGroups, "world", () => {
      const pts = collectWorldPointsReal(shape, ancestorGroups);
      if (!pts.length) return null;
      const paperPts = pts.map(([x, y]) => [
        realToPaper(x, scale),
        realToPaper(y, scale),
      ]);
      const bb = aabbFromPoints(paperPts);
      if (!bb) return null;
      return { x: bb.x, y: bb.y, w: bb.w, h: bb.h };
    });
  }

  const sample = sampleShapePointsReal(shape);
  if (!sample.length) return _getShapeBBoxLegacy(shape, scale);

  const hasTransform =
    hasVisualTransform(shape) ||
    ancestorGroups.some((g) => hasVisualTransform(g));

  if (!hasTransform) {
    return _getShapeBBoxLegacy(shape, scale);
  }

  const paperPts = sample.map(([x, y]) => {
    const [rx, ry] = applyWorldTransformReal(x, y, shape, ancestorGroups);
    return [realToPaper(rx, scale), realToPaper(ry, scale)];
  });
  const bb = aabbFromPoints(paperPts);
  if (!bb) return null;
  return { x: bb.x, y: bb.y, w: bb.w, h: bb.h };
}

function _getShapeBBoxLegacy(shape, scale) {
  if (shape.type === "line") {
    const x1 = realToPaper(shape.x1, scale),
      y1 = realToPaper(shape.y1, scale);
    const x2 = realToPaper(shape.x2, scale),
      y2 = realToPaper(shape.y2, scale);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  } else if (shape.type === "rawpath") {
    return {
      x: realToPaper(shape.bx ?? shape.x, scale),
      y: realToPaper(shape.by ?? shape.y, scale),
      w: realToPaper(shape.bw ?? 100, scale),
      h: realToPaper(shape.bh ?? 20, scale),
    };
  } else if (shape.type === "rect") {
    return {
      x: realToPaper(shape.x, scale),
      y: realToPaper(shape.y, scale),
      w: realToPaper(shape.width, scale),
      h: realToPaper(shape.height, scale),
    };
  } else if (shape.type === "image") {
    return {
      x: realToPaper(shape.x, scale),
      y: realToPaper(shape.y, scale),
      w: realToPaper(shape.width, scale),
      h: realToPaper(shape.height, scale),
    };
  } else if (shape.type === "circle") {
    const r = realToPaper(shape.r, scale);
    return {
      x: realToPaper(shape.cx, scale) - r,
      y: realToPaper(shape.cy, scale) - r,
      w: r * 2,
      h: r * 2,
    };
  } else if (shape.type === "ellipse") {
    const rx = realToPaper(shape.rx, scale);
    const ry = realToPaper(shape.ry, scale);
    return {
      x: realToPaper(shape.cx, scale) - rx,
      y: realToPaper(shape.cy, scale) - ry,
      w: rx * 2,
      h: ry * 2,
    };
  } else if (shape.type === "text") {
    return getTextLayoutBoxPaper(shape, scale);
  } else if (shape.type === "bezier") {
    return bezierBBox(shape, scale);
  } else if (shape.type === "path") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const polygon of shape.contours) {
      for (const ring of polygon) {
        for (const [x, y] of ring) {
          const px = realToPaper(x, scale),
            py = realToPaper(y, scale);
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  } else if (shape.type === "pencil") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const pt of shape.points || []) {
      const px = realToPaper(pt.x, scale),
        py = realToPaper(pt.y, scale);
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  } else if (shape.type === "dimension") {
    const fx = realToPaper(shape.from.x, scale),
      fy = realToPaper(shape.from.y, scale);
    const tx = realToPaper(shape.to.x, scale),
      ty = realToPaper(shape.to.y, scale);
    const offP = realToPaper(shape.offset || 0, scale);
    const pad = 5;
    let bx1, by1, bx2, by2;
    if (shape.dimensionType === "vertical") {
      const dimX = fx + offP;
      bx1 = dimX - pad;
      bx2 = dimX + pad;
      by1 = Math.min(fy, ty) - pad;
      by2 = Math.max(fy, ty) + pad;
    } else {
      const dimY = fy + offP;
      bx1 = Math.min(fx, tx) - pad;
      bx2 = Math.max(fx, tx) + pad;
      by1 = dimY - pad;
      by2 = dimY + pad;
    }
    return {
      x: bx1,
      y: by1,
      w: Math.max(1, bx2 - bx1),
      h: Math.max(1, by2 - by1),
    };
  }
  return null;
}

const HANDLE_CURSORS = [
  "nwse-resize",
  "ns-resize",
  "nesw-resize",
  "ew-resize",
  "nwse-resize",
  "ns-resize",
  "nesw-resize",
  "ew-resize",
];

// 回転ドラッグ用カーソル（Figma 風の円弧矢印）
const ROTATE_CURSOR = (() => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
    '<path d="M5 11a6 6 0 1 1 2.4 4.8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M5 11a6 6 0 1 1 2.4 4.8" fill="none" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M9.6 13.4 6.4 18.4 4.4 13.2z" fill="#1f2937" stroke="#fff" stroke-width="1"/>' +
    "</svg>";
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 11 11, alias`;
})();

const _shapeBBoxCache = new Map();
let _shapeBBoxCacheDocVersion = -1;

function _shapeBBoxCacheKey(shape, scale, ancestorGroups = [], kind = "world") {
  if (!shape?.id) return null;
  const sc = scale ? `${scale.numerator}/${scale.denominator}` : "1/1";
  const rv =
    typeof getShapeRenderVersion === "function"
      ? getShapeRenderVersion(shape.id)
      : 0;
  const av = ancestorGroups
    .map((g) => {
      const gv =
        typeof getShapeRenderVersion === "function"
          ? getShapeRenderVersion(g.id)
          : 0;
      return `${g.id}:${gv}`;
    })
    .join("/");
  return `${kind}|${shape.id}|${rv}|${sc}|${av}`;
}

function _getCachedShapeBBox(shape, scale, ancestorGroups, kind, compute) {
  const docv =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : -1;
  if (docv !== _shapeBBoxCacheDocVersion) {
    _shapeBBoxCache.clear();
    _shapeBBoxCacheDocVersion = docv;
  }
  const key = _shapeBBoxCacheKey(shape, scale, ancestorGroups, kind);
  if (!key) return compute();
  const hit = _shapeBBoxCache.get(key);
  if (hit) return hit;
  const bb = compute();
  if (bb) _shapeBBoxCache.set(key, bb);
  return bb;
}

// 変換前のローカル bbox（paper 座標）。回転中の選択枠は
// ローカル bbox を描いて transform で追従させる（getShapeBBox はワールド AABB を返すため不可）
function getShapeLocalBBoxPaper(shape, scale) {
  if (shape.type === "group") {
    return _getCachedShapeBBox(shape, scale, [], "local", () => {
      // getGroupLocalPivotPaper と同じ規約: 子の変換のみ適用した点群の AABB
      const pts = [];
      for (const child of shape.children || []) {
        pts.push(...collectWorldPointsReal(child, []));
      }
      return aabbFromPoints(
        pts.map(([x, y]) => [realToPaper(x, scale), realToPaper(y, scale)]),
      );
    });
  }
  return _getShapeBBoxLegacy(shape, scale);
}

// 図形の rotation / flip と同じ変換を選択枠グループへ適用するための transform 文字列
// （renderShape と同じ合成順: rotate → flip）
function buildSelectionTransform(shape, scale) {
  if (typeof hasVisualTransform !== "function" || !hasVisualTransform(shape))
    return "";
  const pivot =
    shape.type === "group"
      ? getGroupLocalPivotPaper(shape, scale)
      : getShapeLocalPivotPaper(shape, scale);
  if (!pivot) return "";
  let t = "";
  if (shape.rotation && shape.rotation % 360 !== 0) {
    t = `rotate(${shape.rotation},${pivot.x},${pivot.y})`;
  }
  if (shape.flipH || shape.flipV) {
    const sx = shape.flipH ? -1 : 1;
    const sy = shape.flipV ? -1 : 1;
    t = `translate(${pivot.x},${pivot.y}) scale(${sx},${sy}) translate(${-pivot.x},${-pivot.y})${t ? " " + t : ""}`;
  }
  return t;
}

function formatMmBadge(v) {
  const n = Math.round(v * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function appendSelectionSizeBadge(g, bb, zoom, scale, labelBB) {
  const sizeBB = labelBB || bb;
  const wMM = paperDistToMM(sizeBB.w, scale);
  const hMM = paperDistToMM(sizeBB.h, scale);
  const label = `${formatMmBadge(wMM)} × ${formatMmBadge(hMM)}`;
  const fontSize = 11 / zoom;
  const padX = 6 / zoom;
  const padY = 3 / zoom;
  const gap = 8 / zoom;
  const textW = label.length * fontSize * 0.58;
  const badgeW = textW + padX * 2;
  const badgeH = fontSize + padY * 2;
  const cx = bb.x + bb.w / 2;
  const badgeX = cx - badgeW / 2;
  const badgeY = bb.y + bb.h + gap;

  const badge = se("g", {
    class: "sel-size-badge",
    "pointer-events": "none",
    style: "user-select:none;-webkit-user-select:none",
  });
  badge.appendChild(
    se("rect", {
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      rx: badgeH / 2,
      fill: "#2563eb",
      "pointer-events": "none",
    }),
  );
  const txt = se("text", {
    x: cx,
    y: badgeY + badgeH * 0.72,
    "text-anchor": "middle",
    fill: "#fff",
    "font-size": fontSize,
    "font-family": DEFAULT_TEXT_FONT_FAMILY,
    "pointer-events": "none",
    style: "user-select:none;-webkit-user-select:none",
  });
  txt.textContent = label;
  badge.appendChild(txt);
  g.appendChild(badge);
}

function renderSelectionHandles(selIds, page, zoom) {
  const g = se("g", {
    id: "sel-handles",
    style: "user-select:none;-webkit-user-select:none",
  });
  const sw = 0.35 / zoom,
    hs = 5.5 / zoom;

  // Multi-select of same type → draw combined BB handles instead of per-shape handles
  if (selIds.length > 1) {
    const shapes = selIds
      .map((id) => {
        for (const layer of page.layers) {
          const s = layer.shapes.find((s) => s.id === id);
          if (s) return s;
        }
        // 寸法線も検索
        return (page.dimensions || []).find((d) => d.id === id) || null;
      })
      .filter(Boolean);
    const types = [...new Set(shapes.map((s) => s.type))];
    const multiResizable =
      types.length === 1 &&
      !["line", "bezier", "path", "dimension", "text", "group"].includes(
        types[0],
      );
    if (multiResizable) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const s of shapes) {
        const bb = getShapeBBox(s, page.scale);
        if (!bb) continue;
        if (bb.x < minX) minX = bb.x;
        if (bb.y < minY) minY = bb.y;
        if (bb.x + bb.w > maxX) maxX = bb.x + bb.w;
        if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
      }
      // selection outline per shape
      for (const s of shapes) {
        const bb = getShapeBBox(s, page.scale);
        if (!bb) continue;
        g.appendChild(
          se("rect", {
            x: bb.x - 1 / zoom,
            y: bb.y - 1 / zoom,
            width: bb.w + 2 / zoom,
            height: bb.h + 2 / zoom,
            fill: "none",
            stroke: "#2563eb",
            "stroke-width": sw,
            "stroke-dasharray": `${4 / zoom} ${2 / zoom}`,
            "pointer-events": "none",
          }),
        );
      }
      // combined BB handles
      const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2;
      const pts = [
        [minX, minY],
        [cx, minY],
        [maxX, minY],
        [maxX, cy],
        [maxX, maxY],
        [cx, maxY],
        [minX, maxY],
        [minX, cy],
      ];
      g.appendChild(
        se("rect", {
          x: minX - 1 / zoom,
          y: minY - 1 / zoom,
          width: maxX - minX + 2 / zoom,
          height: maxY - minY + 2 / zoom,
          fill: "none",
          stroke: "#2563eb",
          "stroke-width": sw,
          "pointer-events": "none",
        }),
      );
      for (let i = 0; i < pts.length; i++) {
        const [hx, hy] = pts[i];
        g.appendChild(
          se("rect", {
            x: hx - hs / 2,
            y: hy - hs / 2,
            width: hs,
            height: hs,
            fill: "#fff",
            stroke: "#2563eb",
            "stroke-width": sw,
            "data-handle": i,
            "data-multi-resize": "1",
            cursor: HANDLE_CURSORS[i],
          }),
        );
      }
      appendSelectionSizeBadge(
        g,
        {
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
        },
        zoom,
        page.scale,
      );
      _vp.appendChild(g);
      return;
    }
  }

  for (const id of selIds) {
    const res = findShapeById(id);
    if (!res || res.page !== page) continue;
    const shape = res.shape;

    if (_bezierEditId === id && shape.type === "bezier") {
      renderBezierEditHandles(shape, page, zoom, g);
      continue;
    }

    if (_vertexEditId === id && shape.type === "path") {
      const vr = 4 / zoom,
        vsw = 0.5 / zoom;
      for (const [pi, polygon] of shape.contours.entries()) {
        for (const [ri, ring] of polygon.entries()) {
          for (const [vi, [x, y]] of ring.entries()) {
            const px = realToPaper(x, page.scale),
              py = realToPaper(y, page.scale);
            g.appendChild(
              se("circle", {
                cx: px,
                cy: py,
                r: vr,
                fill: "#fff",
                stroke: "#2563eb",
                "stroke-width": vsw,
                "data-vertex": `${pi},${ri},${vi}`,
                "data-sid": id,
                cursor: "crosshair",
              }),
            );
          }
        }
      }
      continue;
    }

    // 回転・反転している図形は選択枠・ハンドルも同じ変換で追従させる
    const xform = res.isDimension
      ? ""
      : buildSelectionTransform(shape, page.scale);
    // 変換中はローカル bbox を使う（getShapeBBox はワールド AABB のため二重変換になる）
    const bb = xform
      ? getShapeLocalBBoxPaper(shape, page.scale)
      : getShapeBBox(shape, page.scale);
    if (!bb) continue;
    const sg = xform ? se("g", { transform: xform }) : g;

    sg.appendChild(
      se("rect", {
        x: bb.x - 1 / zoom,
        y: bb.y - 1 / zoom,
        width: bb.w + 2 / zoom,
        height: bb.h + 2 / zoom,
        fill: "none",
        stroke: "#2563eb",
        "stroke-width": sw,
        "stroke-dasharray": `${4 / zoom} ${2 / zoom}`,
        "pointer-events": "none",
      }),
    );
    // 寸法線は W×H のサイズバッジを出さない。寸法線は面積を持たず、
    // 計測値（自身の数字）こそが意味なので、選択枠の w×h は誤解を招く。
    if (!res.isDimension) {
      if (xform) {
        // バッジは回転させず、表示上の AABB の下端に置く（サイズ表記は図形自身の w×h）
        const wbb = getShapeBBox(shape, page.scale);
        if (wbb) appendSelectionSizeBadge(g, wbb, zoom, page.scale, bb);
      } else {
        appendSelectionSizeBadge(g, bb, zoom, page.scale);
      }
    }

    if (shape.type === "line") {
      const x1 = realToPaper(shape.x1, page.scale),
        y1 = realToPaper(shape.y1, page.scale);
      const x2 = realToPaper(shape.x2, page.scale),
        y2 = realToPaper(shape.y2, page.scale);
      for (const [i, hx, hy] of [
        [0, x1, y1],
        [1, x2, y2],
      ]) {
        sg.appendChild(
          se("rect", {
            x: hx - hs / 2,
            y: hy - hs / 2,
            width: hs,
            height: hs,
            fill: "#2563eb",
            stroke: "#fff",
            "stroke-width": sw,
            "data-handle": i,
            "data-sid": id,
            cursor: "crosshair",
          }),
        );
      }
    } else {
      const cx = bb.x + bb.w / 2,
        cy = bb.y + bb.h / 2;
      const pts = [
        [bb.x, bb.y],
        [cx, bb.y],
        [bb.x + bb.w, bb.y],
        [bb.x + bb.w, cy],
        [bb.x + bb.w, bb.y + bb.h],
        [cx, bb.y + bb.h],
        [bb.x, bb.y + bb.h],
        [bb.x, cy],
      ];
      // 回転ホットゾーン: コーナーハンドルの外周（ハンドルより先に追加して下層に置く）
      if (!res.isDimension) {
        const rz = hs * 3;
        for (const i of [0, 2, 4, 6]) {
          const [hx, hy] = pts[i];
          sg.appendChild(
            se("rect", {
              x: hx - rz / 2,
              y: hy - rz / 2,
              width: rz,
              height: rz,
              fill: "none",
              "pointer-events": "all",
              "data-rotate-handle": i,
              "data-sid": id,
              cursor: ROTATE_CURSOR,
            }),
          );
        }
      }
      if (shape.type === "group") {
        if (sg !== g) g.appendChild(sg);
        continue;
      }
      // 回転表示中はリサイズカーソルの向きを 45° 単位でずらして体感方向に合わせる
      const cursorShift =
        Math.round(((((shape.rotation || 0) % 360) + 360) % 360) / 45) % 8;
      for (let i = 0; i < pts.length; i++) {
        const [hx, hy] = pts[i];
        sg.appendChild(
          se("rect", {
            x: hx - hs / 2,
            y: hy - hs / 2,
            width: hs,
            height: hs,
            fill: "#fff",
            stroke: "#2563eb",
            "stroke-width": sw,
            "data-handle": i,
            "data-sid": id,
            cursor: HANDLE_CURSORS[(i + cursorShift) % 8],
          }),
        );
      }
    }
    if (sg !== g) g.appendChild(sg);
  }
  _vp.appendChild(g);
}

function renderPreview(shape) {
  removePreview();
  if (!shape || !_vp) return;
  const page = getCurrentPage();
  const el = renderShape(shape, page.scale, []);
  if (!el) return;
  el.id = "preview-shape";
  el.style.pointerEvents = "none";
  // 鉛筆は描画中も実際の色・太さで見せる（青の上書きをしない）
  if (shape.type !== "pencil") {
    el.setAttribute("opacity", "0.4");
    el.setAttribute("stroke", "#2563eb");
    if (shape.type !== "line" && shape.type !== "dimension")
      el.setAttribute("fill", "rgba(37,99,235,0.06)");
  }
  _vp.appendChild(el);
}
function removePreview() {
  _svg && _svg.querySelector("#preview-shape")?.remove();
}

// ── スナップインジケーター ─────────────────────────────────────
// snapType ごとに異なる形状を描画する
//   endpoint     → □ (小さな正方形)
//   midpoint     → △ (小さな三角形)
//   center       → ◎ (二重円)
//   intersection → × (クロス)
//   perpendicular→ ⊥ (垂線記号)
//   null/other   → ○ (フォールバック円)
//
function renderSnapIndicator(px, py, zoom, snapType) {
  removeSnapIndicator();
  if (!_vp) return;
  const s = 2.5 / zoom; // サイズ基準
  const sw = 0.5 / zoom; // stroke-width
  const col = "#2563eb";
  const base = {
    id: "snap-ind",
    fill: "none",
    stroke: col,
    "stroke-width": sw,
    "pointer-events": "none",
  };
  let el;

  switch (snapType) {
    case "endpoint": {
      // 小さな正方形
      el = se("rect", {
        ...base,
        x: px - s,
        y: py - s,
        width: s * 2,
        height: s * 2,
      });
      break;
    }
    case "midpoint": {
      // 小さな三角形
      const pts = `${px},${py - s} ${px + s},${py + s} ${px - s},${py + s}`;
      el = se("polygon", { ...base, points: pts });
      break;
    }
    case "center": {
      // 二重円（外円 + 内円）
      const g = se("g", { id: "snap-ind", "pointer-events": "none" });
      g.appendChild(
        se("circle", {
          fill: "none",
          stroke: col,
          "stroke-width": sw,
          cx: px,
          cy: py,
          r: s,
        }),
      );
      g.appendChild(
        se("circle", {
          fill: col,
          stroke: "none",
          cx: px,
          cy: py,
          r: sw * 1.5,
        }),
      );
      _vp.appendChild(g);
      return;
    }
    case "intersection": {
      // × マーク
      const g = se("g", { id: "snap-ind", "pointer-events": "none" });
      g.appendChild(
        se("line", {
          stroke: col,
          "stroke-width": sw,
          x1: px - s,
          y1: py - s,
          x2: px + s,
          y2: py + s,
        }),
      );
      g.appendChild(
        se("line", {
          stroke: col,
          "stroke-width": sw,
          x1: px + s,
          y1: py - s,
          x2: px - s,
          y2: py + s,
        }),
      );
      _vp.appendChild(g);
      return;
    }
    case "guide": {
      // ◇（ガイド色のひし形）
      const pts = `${px},${py - s} ${px + s},${py} ${px},${py + s} ${px - s},${py}`;
      el = se("polygon", { ...base, stroke: "#0ea5e9", points: pts });
      break;
    }
    case "perpendicular": {
      // ⊥ 記号（水平線 + 垂直線）
      const g = se("g", { id: "snap-ind", "pointer-events": "none" });
      g.appendChild(
        se("line", {
          stroke: col,
          "stroke-width": sw,
          x1: px - s,
          y1: py + s * 0.6,
          x2: px + s,
          y2: py + s * 0.6,
        }),
      );
      g.appendChild(
        se("line", {
          stroke: col,
          "stroke-width": sw,
          x1: px,
          y1: py - s,
          x2: px,
          y2: py + s * 0.6,
        }),
      );
      _vp.appendChild(g);
      return;
    }
    default: {
      // フォールバック: 円
      el = se("circle", { ...base, cx: px, cy: py, r: s });
      break;
    }
  }
  _vp.appendChild(el);
}
function removeSnapIndicator() {
  _svg && _svg.querySelector("#snap-ind")?.remove();
}
