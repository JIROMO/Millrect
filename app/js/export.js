"use strict";

const _LEGACY_STROKE_WIDTH_MM = { thin: 0.25, medium: 0.5, thick: 1.0 };

function _stripLegacyFeature(shape) {
  if (!shape || typeof shape !== "object") return shape;
  const out = { ...shape };
  delete out.feature;
  if (out.type === "group" && Array.isArray(out.children)) {
    out.children = out.children.map(_stripLegacyFeature);
  }
  return out;
}

function _migrateImportedShape(shape) {
  if (!shape || typeof shape !== "object") return shape;
  if (shape.type === "dimension") return _migrateImportedDimension(shape);
  const out = _stripLegacyFeature(shape);
  if (out.color != null && out.stroke == null) {
    out.stroke = out.color;
    delete out.color;
  }
  if (out.lineWidth != null && out.strokeWidth == null) {
    out.strokeWidth = out.lineWidth;
    delete out.lineWidth;
  }
  return out;
}

function _migrateImportedDimension(dim) {
  const out = _stripLegacyFeature(dim);
  if (out.stroke != null && out.color == null) {
    out.color = out.stroke;
    delete out.stroke;
  }
  if (out.strokeWidth != null && out.lineWidth == null) {
    const sw = out.strokeWidth;
    out.lineWidth =
      typeof sw === "number" ? sw : (_LEGACY_STROKE_WIDTH_MM[sw] ?? 0.25);
    delete out.strokeWidth;
  }
  delete out.unit;
  return out;
}

function _migrateImportedPage(page) {
  const dimensions = [...(page.dimensions || [])].map(
    _migrateImportedDimension,
  );
  const layers = (page.layers || []).map((layer) => {
    const shapes = [];
    for (const shape of layer.shapes || []) {
      if (shape.type === "dimension") {
        dimensions.push(_migrateImportedDimension(shape));
      } else {
        shapes.push(_migrateImportedShape(shape));
      }
    }
    return { ...layer, shapes };
  });
  return {
    ...page,
    viewDefinition: page.viewDefinition ?? {
      type: "top",
      normal: [0, 0, 1],
      up: [0, 1, 0],
    },
    dimensions,
    constraints: page.constraints || [],
    layers,
  };
}

function _migrateImportedProject(data) {
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    fonts: Array.isArray(data.fonts) ? data.fonts : [],
    pages: (data.pages || []).map(_migrateImportedPage),
  };
}

function _pagesForExport(pages) {
  return pages.map((page) => ({
    ...page,
    layers: (page.layers || []).map((layer) => ({
      ...layer,
      shapes: (layer.shapes || []).map(_stripLegacyFeature),
    })),
  }));
}

function _projectDataFromState(state) {
  const data = {
    projectName: state.projectName,
    unit: state.unit,
    fonts: state.fonts || [],
    pages: _pagesForExport(state.pages),
  };
  if (state.partIntent) data.partIntent = state.partIntent;
  return data;
}

function exportProjectJson() {
  const state = getState();
  const data = _projectDataFromState(state);
  const now = new Date();
  const ts =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0");
  const title = (state.projectName || "millrect").replace(/\s+/g, "_");
  dl(JSON.stringify(data, null, 2), `${title}_${ts}.json`, "application/json");
}
function exportProjectJsonString() {
  return JSON.stringify(_projectDataFromState(getState()), null, 2);
}

function projectJsonFromState(state) {
  return JSON.stringify(_projectDataFromState(state), null, 2);
}
function importProjectFromJsonString(jsonStr) {
  const raw = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
  if (!isMillrectProjectJson(raw)) {
    const err = new Error("NotMillrectProject");
    err.code = "NotMillrectProject";
    throw err;
  }
  const data = _migrateImportedProject(raw);
  const state = getState();
  if (data.pages) state.pages = data.pages;
  if (data.projectName) state.projectName = data.projectName;
  if (data.unit) state.unit = data.unit;
  state.fonts = Array.isArray(data.fonts) ? data.fonts : [];
  state.partIntent = data.partIntent !== undefined ? data.partIntent : null;
  state.currentPageId = data.pages?.[0]?.id || state.pages[0]?.id || "";
  state.currentLayerId = data.pages?.[0]?.layers?.[0]?.id || "";
  state.selectedShapeIds = [];
  const nameEl = document.getElementById("project-name");
  if (nameEl && data.projectName) nameEl.value = data.projectName;
  // Reset history so undo doesn't revert to the pre-load empty state
  replaceState(state);
  if (typeof hydrateProjectFontsFromState === "function") {
    hydrateProjectFontsFromState();
  }
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
}

async function importProjectJsonFromFile() {
  if (window.electronAPI) {
    const result = await window.electronAPI.openProjectJson();
    if (!result) throw new Error("No file");
    const data = JSON.parse(result.json);
    if (!isMillrectProjectJson(data)) {
      const err = new Error("NotMillrectProject");
      err.code = "NotMillrectProject";
      throw err;
    }
    return { data, filePath: result.filePath };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error("No file"));
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!isMillrectProjectJson(data)) {
            const err = new Error("NotMillrectProject");
            err.code = "NotMillrectProject";
            return reject(err);
          }
          resolve({ data });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
async function importSvgFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg,image/svg+xml";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error("No file"));
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    };
    input.click();
  });
}

async function importImageFromFile() {
  const IMAGE_COMPRESSION = {
    maxDimension: 1600,
    mimeType: "image/webp",
    quality: 0.82,
  };

  function dataUrlMime(dataUrl) {
    const match = /^data:([^;,]+)[;,]/.exec(String(dataUrl || ""));
    return match?.[1]?.toLowerCase() || "";
  }

  function dataUrlBytes(dataUrl) {
    const str = String(dataUrl || "");
    const comma = str.indexOf(",");
    if (comma === -1) return str.length;
    const header = str.slice(0, comma);
    const body = str.slice(comma + 1);
    if (/;base64/i.test(header)) {
      const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
      return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
    }
    try {
      return new TextEncoder().encode(decodeURIComponent(body)).length;
    } catch {
      return body.length;
    }
  }

  function maybeCompressImageDataUrl(dataUrl, img) {
    const originalBytes = dataUrlBytes(dataUrl);
    const mime = dataUrlMime(dataUrl);
    if (mime === "image/svg+xml") {
      return {
        dataUrl,
        originalBytes,
        storageBytes: originalBytes,
        compressed: false,
      };
    }

    const naturalWidth = img.naturalWidth || img.width || 1;
    const naturalHeight = img.naturalHeight || img.height || 1;
    const maxSide = Math.max(naturalWidth, naturalHeight);
    const scale =
      maxSide > IMAGE_COMPRESSION.maxDimension
        ? IMAGE_COMPRESSION.maxDimension / maxSide
        : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return {
        dataUrl,
        originalBytes,
        storageBytes: originalBytes,
        compressed: false,
      };
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let compressedUrl = canvas.toDataURL(
      IMAGE_COMPRESSION.mimeType,
      IMAGE_COMPRESSION.quality,
    );
    if (!compressedUrl.startsWith(`data:${IMAGE_COMPRESSION.mimeType}`)) {
      compressedUrl = canvas.toDataURL("image/jpeg", IMAGE_COMPRESSION.quality);
    }
    const storageBytes = dataUrlBytes(compressedUrl);
    if (storageBytes >= originalBytes) {
      return {
        dataUrl,
        originalBytes,
        storageBytes: originalBytes,
        compressed: false,
      };
    }
    return {
      dataUrl: compressedUrl,
      originalBytes,
      storageBytes,
      compressed: true,
    };
  }

  const loadImageMeta = (dataUrl, info = {}) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const stored = maybeCompressImageDataUrl(dataUrl, img);
        resolve({
          dataUrl: stored.dataUrl,
          name: info.name,
          naturalWidth: img.naturalWidth || img.width || 1,
          naturalHeight: img.naturalHeight || img.height || 1,
          originalBytes: stored.originalBytes,
          storageBytes: stored.storageBytes,
          compressed: stored.compressed,
        });
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    });

  if (window.electronAPI?.openImageFile) {
    const result = await window.electronAPI.openImageFile();
    if (!result) throw new Error("No file");
    return loadImageMeta(result.dataUrl, result);
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return reject(new Error("No file"));
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        loadImageMeta(dataUrl, { name: file.name }).then(resolve, reject);
      };
      reader.onerror = () => reject(reader.error || new Error("Read failed"));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

function parseSvgToShapes(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) throw new Error("SVG要素が見つかりません");

  // coordinate scale: map SVG units → Millrect real units (1mm = 10)
  const vb = svgEl.getAttribute("viewBox");
  const wAttr = svgEl.getAttribute("width") || "";
  const hAttr = svgEl.getAttribute("height") || "";
  let scaleX = 1,
    scaleY = 1;

  if (vb) {
    const [, , vbW, vbH] = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const mmW = parseMmAttr(wAttr) || parseMmAttr(hAttr) || null;
    if (mmW && vbW) {
      // SVG in mm → real units (×10)
      scaleX = (mmW * 10) / vbW;
      const mmH = parseMmAttr(hAttr) || mmW;
      scaleY = (mmH * 10) / vbH;
    } else if (vbW) {
      // assume 1 SVG unit = 1 real unit
      scaleX = scaleY = 1;
    }
  } else if (wAttr && hAttr) {
    const mmW = parseMmAttr(wAttr);
    if (mmW) {
      scaleX = scaleY = (mmW * 10) / parseFloat(wAttr);
    }
  }

  const shapes = [];
  const colorMap = (c) => (!c || c === "none" ? "none" : c);
  const sw = (el) => {
    const v = parseFloat(el.getAttribute("stroke-width") || "1");
    if (v <= 0.3) return "thin";
    if (v <= 0.7) return "medium";
    return "thick";
  };
  // resolve inherited fill/stroke by walking up ancestors (simplified)
  const resolveAttr = (el, attr, fallback) => {
    let node = el;
    while (node && node !== doc) {
      const v = node.getAttribute?.(attr);
      if (v !== null && v !== undefined) return v;
      node = node.parentElement;
    }
    return fallback;
  };
  const base = (el) => {
    const strokeAttr = resolveAttr(el, "stroke", null);
    const fillAttr = resolveAttr(el, "fill", null);
    return {
      id: genId("shape"),
      stroke: colorMap(strokeAttr ?? "none"),
      fill: colorMap(fillAttr ?? "none"),
      strokeWidth: sw(el),
    };
  };
  const sx = (v) => parseFloat(v || 0) * scaleX;
  const sy = (v) => parseFloat(v || 0) * scaleY;

  function processEl(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "rect") {
      shapes.push({
        ...base(el),
        type: "rect",
        x: sx(el.getAttribute("x")),
        y: sy(el.getAttribute("y")),
        width: sx(el.getAttribute("width")),
        height: sy(el.getAttribute("height")),
        rx: el.getAttribute("rx") ? sx(el.getAttribute("rx")) : undefined,
      });
    } else if (tag === "circle") {
      shapes.push({
        ...base(el),
        type: "circle",
        cx: sx(el.getAttribute("cx")),
        cy: sy(el.getAttribute("cy")),
        r: sx(el.getAttribute("r")),
      });
    } else if (tag === "ellipse") {
      shapes.push({
        ...base(el),
        type: "ellipse",
        cx: sx(el.getAttribute("cx")),
        cy: sy(el.getAttribute("cy")),
        rx: sx(el.getAttribute("rx")),
        ry: sy(el.getAttribute("ry")),
      });
    } else if (tag === "line") {
      shapes.push({
        ...base(el),
        type: "line",
        x1: sx(el.getAttribute("x1")),
        y1: sy(el.getAttribute("y1")),
        x2: sx(el.getAttribute("x2")),
        y2: sy(el.getAttribute("y2")),
      });
    } else if (tag === "text") {
      shapes.push({
        ...base(el),
        type: "text",
        x: sx(el.getAttribute("x")),
        y: sy(el.getAttribute("y")),
        text: el.textContent || "",
        fontSize: el.getAttribute("font-size")
          ? sy(el.getAttribute("font-size"))
          : undefined,
      });
    } else if (tag === "polyline" || tag === "polygon") {
      const pts = (el.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length >= 4) {
        const nodes = [];
        for (let i = 0; i < pts.length - 1; i += 2) {
          nodes.push({
            x: pts[i] * scaleX,
            y: pts[i + 1] * scaleY,
            h1: null,
            h2: null,
          });
        }
        shapes.push({
          ...base(el),
          type: "bezier",
          nodes,
          closed: tag === "polygon",
        });
      }
    } else if (tag === "path") {
      const { nodes, closed } = parseSvgPathToCompound(
        el.getAttribute("d") || "",
        scaleX,
        scaleY,
      );
      if (nodes.filter((n) => !n.break).length >= 2) {
        shapes.push({ ...base(el), type: "bezier", nodes, closed });
      }
    } else if (tag === "g") {
      for (const child of el.children) processEl(child);
    }
  }

  for (const child of svgEl.children) processEl(child);
  return shapes;
}

function parseMmAttr(attr) {
  if (!attr) return null;
  if (attr.endsWith("mm")) return parseFloat(attr);
  if (attr.endsWith("cm")) return parseFloat(attr) * 10;
  if (attr.endsWith("in")) return parseFloat(attr) * 25.4;
  if (attr.endsWith("pt")) return parseFloat(attr) * 0.352778;
  return null;
}

function tokenizeSvgPath(d) {
  // split path data into [cmd, num, num, ...] tokens handling "100.5-20.3" and "1.5.6" forms
  const tokens = [];
  const re =
    /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[1] ?? parseFloat(m[2]));
  }
  return tokens;
}

// Returns { nodes, closed } where nodes may contain break markers { x,y,break:true }
// that signal subpath boundaries in compound paths.
function parseSvgPathToCompound(d, scaleX, scaleY) {
  const tokens = tokenizeSvgPath(d);
  const nodes = [];
  let anyClosed = false;
  let cx = 0,
    cy = 0,
    mx = 0,
    my = 0;
  let lastCp2x = null,
    lastCp2y = null;
  let afterZ = false;

  let i = 0;
  let cmd = "M";

  while (i < tokens.length) {
    const t = tokens[i];

    if (typeof t === "string") {
      const prevCmd = cmd;
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        anyClosed = true;
        cx = mx;
        cy = my;
        lastCp2x = null;
        lastCp2y = null;
        afterZ = true;
      }
      continue;
    }

    const abs = cmd === cmd.toUpperCase();
    const type = cmd.toUpperCase();
    if (type !== "C" && type !== "S") {
      lastCp2x = null;
      lastCp2y = null;
    }

    if (type === "M") {
      cx = abs ? t : cx + t;
      cy = abs ? tokens[i + 1] : cy + tokens[i + 1];
      i += 2;
      mx = cx;
      my = cy;
      // after Z, mark as subpath break instead of a plain node
      const node = { x: cx * scaleX, y: cy * scaleY, h1: null, h2: null };
      if (afterZ && nodes.length > 0) node.break = true;
      afterZ = false;
      nodes.push(node);
      cmd = abs ? "L" : "l";
    } else if (type === "L") {
      cx = abs ? t : cx + t;
      cy = abs ? tokens[i + 1] : cy + tokens[i + 1];
      i += 2;
      nodes.push({ x: cx * scaleX, y: cy * scaleY, h1: null, h2: null });
    } else if (type === "H") {
      cx = abs ? t : cx + t;
      i++;
      nodes.push({ x: cx * scaleX, y: cy * scaleY, h1: null, h2: null });
    } else if (type === "V") {
      cy = abs ? t : cy + t;
      i++;
      nodes.push({ x: cx * scaleX, y: cy * scaleY, h1: null, h2: null });
    } else if (type === "C") {
      const cp1x = abs ? t : cx + t;
      const cp1y = abs ? tokens[i + 1] : cy + tokens[i + 1];
      const cp2x = abs ? tokens[i + 2] : cx + tokens[i + 2];
      const cp2y = abs ? tokens[i + 3] : cy + tokens[i + 3];
      const ex = abs ? tokens[i + 4] : cx + tokens[i + 4];
      const ey = abs ? tokens[i + 5] : cy + tokens[i + 5];
      i += 6;
      if (nodes.length > 0)
        nodes[nodes.length - 1].h2 = { x: cp1x * scaleX, y: cp1y * scaleY };
      nodes.push({
        x: ex * scaleX,
        y: ey * scaleY,
        h1: { x: cp2x * scaleX, y: cp2y * scaleY },
        h2: null,
      });
      cx = ex;
      cy = ey;
      lastCp2x = cp2x;
      lastCp2y = cp2y;
    } else if (type === "S") {
      const prevH2x = lastCp2x !== null ? 2 * cx - lastCp2x : cx;
      const prevH2y = lastCp2y !== null ? 2 * cy - lastCp2y : cy;
      const cp2x = abs ? t : cx + t;
      const cp2y = abs ? tokens[i + 1] : cy + tokens[i + 1];
      const ex = abs ? tokens[i + 2] : cx + tokens[i + 2];
      const ey = abs ? tokens[i + 3] : cy + tokens[i + 3];
      i += 4;
      if (nodes.length > 0)
        nodes[nodes.length - 1].h2 = {
          x: prevH2x * scaleX,
          y: prevH2y * scaleY,
        };
      nodes.push({
        x: ex * scaleX,
        y: ey * scaleY,
        h1: { x: cp2x * scaleX, y: cp2y * scaleY },
        h2: null,
      });
      cx = ex;
      cy = ey;
      lastCp2x = cp2x;
      lastCp2y = cp2y;
    } else if (type === "Q") {
      const qx = abs ? t : cx + t;
      const qy = abs ? tokens[i + 1] : cy + tokens[i + 1];
      const ex = abs ? tokens[i + 2] : cx + tokens[i + 2];
      const ey = abs ? tokens[i + 3] : cy + tokens[i + 3];
      i += 4;
      const cp1x = cx + (2 / 3) * (qx - cx),
        cp1y = cy + (2 / 3) * (qy - cy);
      const cp2x = ex + (2 / 3) * (qx - ex),
        cp2y = ey + (2 / 3) * (qy - ey);
      if (nodes.length > 0)
        nodes[nodes.length - 1].h2 = { x: cp1x * scaleX, y: cp1y * scaleY };
      nodes.push({
        x: ex * scaleX,
        y: ey * scaleY,
        h1: { x: cp2x * scaleX, y: cp2y * scaleY },
        h2: null,
      });
      cx = ex;
      cy = ey;
    } else {
      i++;
    }
  }
  return { nodes, closed: anyClosed };
}

function _prepareDimensionForExport(dimEl) {
  for (const fo of Array.from(dimEl.querySelectorAll("foreignObject"))) {
    const label = fo.textContent || "";
    if (!label) {
      fo.remove();
      continue;
    }
    const x = parseFloat(fo.getAttribute("x") || "0");
    const y = parseFloat(fo.getAttribute("y") || "0");
    const w = parseFloat(fo.getAttribute("width") || "0");
    const h = parseFloat(fo.getAttribute("height") || "0");
    const div = fo.firstElementChild;
    const fontSize = parseFloat(div?.style?.fontSize || "3") || 3;
    const fill = div?.style?.color || "#1a1a2e";
    const fontFamily = div?.style?.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    const text = se("text", {
      x: x + w / 2,
      y: y + h / 2,
      fill,
      "font-size": fontSize,
      "font-family": fontFamily,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "pointer-events": "none",
    });
    const transform = fo.getAttribute("transform");
    if (transform) text.setAttribute("transform", transform);
    text.textContent = label;
    fo.replaceWith(text);
  }
  return dimEl;
}

function buildPageSVG(page, options = {}) {
  const includeDimensions = !!options.includeDimensions;
  const phys = getPaperSizeMm(page);
  const { width: pw, height: ph } = getPaperDimensions(page);
  const svg = se("svg");
  svg.setAttribute("xmlns", NS);
  svg.setAttribute("width", `${phys.width}mm`);
  svg.setAttribute("height", `${phys.height}mm`);
  svg.setAttribute("viewBox", `0 0 ${pw} ${ph}`);
  svg.appendChild(
    se("rect", { x: 0, y: 0, width: pw, height: ph, fill: "white" }),
  );
  for (const layer of page.layers) {
    if (!layer.visible) continue;
    const g = se("g", { id: layer.id });
    for (const shape of layer.shapes) {
      const el = renderShape(shape, page.scale, []);
      if (el) g.appendChild(el);
    }
    svg.appendChild(g);
  }
  if (includeDimensions && page.dimensions?.length) {
    const dg = se("g", { id: "dimension-root" });
    for (const dim of page.dimensions) {
      const el = renderShape(dim, page.scale, []);
      if (el) dg.appendChild(_prepareDimensionForExport(el));
    }
    svg.appendChild(dg);
  }
  return svg;
}
function exportCurrentPageSvg() {
  const page = getCurrentPage();
  const svg = buildPageSVG(page);
  dl(
    new XMLSerializer().serializeToString(svg),
    `${page.name || "drawing"}.svg`,
    "image/svg+xml",
  );
}
async function exportAllPagesPdf() {
  if (typeof ensurePdfExportLibs === "function") {
    await ensurePdfExportLibs();
  }
  if (!window.jspdf) {
    alert(t("common.alert.jspdfMissing"));
    return;
  }
  const { jsPDF } = window.jspdf;
  const state = getState();
  const hasDimensions = state.pages.some((page) => page.dimensions?.length);
  const includeDimensions =
    hasDimensions &&
    confirm(
      typeof t === "function"
        ? t("common.confirm.exportPdfIncludeDimensions")
        : "Include dimension lines in the PDF?",
    );
  const fp = state.pages[0];
  const fd = getPaperSizeMm(fp);
  const pdf = new jsPDF({
    orientation: fp.orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: [fd.width, fd.height],
  });
  for (let i = 0; i < state.pages.length; i++) {
    const page = state.pages[i];
    const phys = getPaperSizeMm(page);
    const dims = getPaperDimensions(page);
    if (i > 0)
      pdf.addPage(
        [phys.width, phys.height],
        page.orientation === "landscape" ? "l" : "p",
      );
    const pageSvg = buildPageSVG(page, { includeDimensions });
    document.body.appendChild(pageSvg);
    pageSvg.style.cssText = "position:absolute;left:-9999px;top:-9999px";
    try {
      const svg2pdfFn = window.svg2pdf?.svg2pdf ?? window.svg2pdf;
      if (typeof svg2pdfFn === "function")
        await svg2pdfFn(pageSvg, pdf, {
          x: 0,
          y: 0,
          width: phys.width,
          height: phys.height,
        });
      else await svgToPdfFallback(pageSvg, pdf, phys);
    } finally {
      document.body.removeChild(pageSvg);
    }
  }
  pdf.save(`${state.projectName || "millrect"}.pdf`);
}
async function svgToPdfFallback(svgEl, pdf, dims) {
  return new Promise((res) => {
    const str = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([str], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const dpi = 150;
      canvas.width = Math.round((dims.width / 25.4) * dpi);
      canvas.height = Math.round((dims.height / 25.4) * dpi);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        dims.width,
        dims.height,
      );
      URL.revokeObjectURL(url);
      res();
    };
    img.onerror = res;
    img.src = url;
  });
}
async function dl(content, filename, mime) {
  if (window.electronAPI) {
    if (mime === "image/svg+xml") {
      await window.electronAPI.saveSvg(filename, content);
    } else if (mime === "application/dxf" && window.electronAPI.saveDxf) {
      await window.electronAPI.saveDxf(filename, content);
    } else {
      await window.electronAPI.saveProjectJson(filename, content);
    }
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
