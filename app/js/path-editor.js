"use strict";

// ── Bezier draw state ─────────────────────────────────────────
// nodes: [{x, y, h1:{x,y}|null, h2:{x,y}|null}]
// h1 = incoming handle, h2 = outgoing handle
let _bezierDraw = null;
// { nodes, isDragging, cursorRP }

let _bezierEditId = null; // shape ID in edit mode
let _bezierDragH = null; // { nodeIdx, type:'anchor'|'h1'|'h2', origNodes }

// ── SVG path string ───────────────────────────────────────────
function bezierPathToD(nodes, closed, scale) {
  if (!nodes || !nodes.length) return "";
  const px = (v) => realToPaper(v, scale);
  const pt = (n) => `${px(n.x)},${px(n.y)}`;

  let d = "";
  let subStart = -1; // index of current subpath's first node
  let prev = null; // last non-break node

  for (let i = 0; i < nodes.length; i++) {
    const cur = nodes[i];

    if (cur.break || i === 0) {
      // close previous subpath if needed
      if (closed && subStart >= 0 && prev) {
        const s = nodes[subStart];
        if (prev.h2 || s.h1) {
          const cp1 = prev.h2 ?? prev,
            cp2 = s.h1 ?? s;
          d += ` C ${px(cp1.x)},${px(cp1.y)} ${px(cp2.x)},${px(cp2.y)} ${pt(s)}`;
        }
        d += " Z";
      }
      // start new subpath
      d += `${d ? " " : ""}M ${pt(cur)}`;
      subStart = i;
      prev = cur;
      continue;
    }

    if (prev.h2 || cur.h1) {
      const cp1 = prev.h2 ?? prev,
        cp2 = cur.h1 ?? cur;
      d += ` C ${px(cp1.x)},${px(cp1.y)} ${px(cp2.x)},${px(cp2.y)} ${pt(cur)}`;
    } else {
      d += ` L ${pt(cur)}`;
    }
    prev = cur;
  }

  // close last subpath
  if (closed && subStart >= 0 && prev) {
    const s = nodes[subStart];
    if (prev !== s && (prev.h2 || s.h1)) {
      const cp1 = prev.h2 ?? prev,
        cp2 = s.h1 ?? s;
      d += ` C ${px(cp1.x)},${px(cp1.y)} ${px(cp2.x)},${px(cp2.y)} ${pt(s)}`;
    }
    d += " Z";
  }
  return d;
}

// BBox for bezier shape (simple anchor-point bbox, conservative)
function bezierBBox(shape, scale) {
  if (!shape.nodes?.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of shape.nodes) {
    if (n.break) continue;
    const px = realToPaper(n.x, scale),
      py = realToPaper(n.y, scale);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    for (const h of [n.h1, n.h2]) {
      if (!h) continue;
      const hx = realToPaper(h.x, scale),
        hy = realToPaper(h.y, scale);
      if (hx < minX) minX = hx;
      if (hy < minY) minY = hy;
      if (hx > maxX) maxX = hx;
      if (hy > maxY) maxY = hy;
    }
  }
  return isFinite(minX)
    ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    : null;
}

// ── Draw tool ─────────────────────────────────────────────────
function startBezierDraw() {
  _bezierDraw = null;
}

function handleBezierDown(rp, pp) {
  if (!_bezierDraw) {
    _bezierDraw = {
      nodes: [{ x: rp.x, y: rp.y, h1: null, h2: null }],
      isDragging: true,
      cursorRP: { ...rp },
      cursorPP: pp ? { ...pp } : null,
    };
    render();
    renderBezierOverlay();
    return;
  }
  // Click near first node → close path (threshold: ~10 paper px at current zoom)
  if (_bezierDraw.nodes.length > 1 && pp) {
    const page = getCurrentPage();
    const first = _bezierDraw.nodes[0];
    const fpx = realToPaper(first.x, page.scale),
      fpy = realToPaper(first.y, page.scale);
    const zoom = getState().zoom;
    if (Math.hypot(pp.x - fpx, pp.y - fpy) < 10 / zoom) {
      commitBezierPath(true);
      return;
    }
  }
  _bezierDraw.nodes.push({ x: rp.x, y: rp.y, h1: null, h2: null });
  _bezierDraw.isDragging = true;
  render();
  renderBezierOverlay();
}

function handleBezierMove(rp, pp) {
  if (!_bezierDraw) return;
  _bezierDraw.cursorRP = { ...rp };
  _bezierDraw.cursorPP = pp ? { ...pp } : null;
  if (_bezierDraw.isDragging) {
    const last = _bezierDraw.nodes[_bezierDraw.nodes.length - 1];
    const dx = rp.x - last.x,
      dy = rp.y - last.y;
    if (Math.hypot(dx, dy) > 1) {
      last.h2 = { x: last.x + dx, y: last.y + dy };
      last.h1 = { x: last.x - dx, y: last.y - dy };
    } else {
      last.h2 = null;
      last.h1 = null;
    }
  }
  render();
  renderBezierOverlay();
}

function handleBezierUp() {
  if (_bezierDraw) _bezierDraw.isDragging = false;
}

function handleBezierDblClick(rp) {
  if (!_bezierDraw || _bezierDraw.nodes.length < 1) return;
  // Remove the last node added on mousedown of this dblclick
  if (_bezierDraw.nodes.length > 1) _bezierDraw.nodes.pop();
  commitBezierPath(false);
}

function handleBezierKey(e) {
  if (!_bezierDraw) return false;
  if (e.key === "Escape") {
    cancelBezierDraw();
    return true;
  }
  if (e.key === "Enter") {
    commitBezierPath(_bezierDraw.nodes.length > 2);
    return true;
  }
  return false;
}

function cancelBezierDraw() {
  _bezierDraw = null;
  render();
}

function commitBezierPath(closed) {
  const nodes = _bezierDraw?.nodes;
  if (!nodes || nodes.length < 2) {
    cancelBezierDraw();
    return;
  }
  const id = genId("bezier");
  const style = getState();
  addShape({
    id,
    type: "bezier",
    nodes: JSON.parse(JSON.stringify(nodes)),
    closed,
    stroke: style.drawStroke || "#1a1a2e",
    fill: style.drawFill ?? "none",
    strokeWidth: "medium",
  });
  _bezierDraw = null;
  const state = getState();
  state.activeTool = "select";
  state.selectedShapeIds = [id];
  updateToolbar();
  render();
  uiUpdate();
}

// _doRender の末尾と各イベントハンドラから呼ばれる。冪等（既存オーバーレイを差し替え）
function renderBezierOverlay() {
  if (!_vp) return;
  _vp.querySelector("#bezier-overlay")?.remove();
  if (!_bezierDraw) return;
  const page = getCurrentPage();
  const { nodes, cursorRP, cursorPP, isDragging } = _bezierDraw;
  if (!cursorRP || !nodes.length) return;

  const scale = page.scale;
  const zoom = getState().zoom;
  const hs = 4.5 / zoom;
  const vsw = 0.5 / zoom;
  const blue = "#2563eb";
  const sw = LINE_WIDTHS.medium / zoom;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.id = "bezier-overlay";
  g.style.pointerEvents = "none";

  const rp2p = (v) => realToPaper(v, scale);
  const rpx = (n) => rp2p(n.x),
    rpy = (n) => rp2p(n.y);

  const last = nodes[nodes.length - 1];

  if (isDragging) {
    // ── Drag mode: user is pulling handles on the most recently placed node ──

    // 1. Placed path so far (nodes before the current one)
    if (nodes.length >= 2) {
      const d = bezierPathToD(nodes.slice(0, -1), false, scale);
      if (d)
        g.appendChild(
          se("path", {
            d,
            stroke: blue,
            "stroke-width": sw,
            fill: "none",
            opacity: "0.8",
          }),
        );
    }

    // 2. Anchor squares for all confirmed nodes
    for (const n of nodes) {
      const px = rpx(n),
        py = rpy(n);
      g.appendChild(
        se("rect", {
          x: px - hs / 2,
          y: py - hs / 2,
          width: hs,
          height: hs,
          fill: "#fff",
          stroke: blue,
          "stroke-width": vsw,
        }),
      );
    }

    // 3. Handle arms on the node being dragged
    const px = rpx(last),
      py = rpy(last);
    if (last.h2) {
      const hx = rp2p(last.h2.x),
        hy = rp2p(last.h2.y);
      g.appendChild(
        se("line", {
          x1: px,
          y1: py,
          x2: hx,
          y2: hy,
          stroke: blue,
          "stroke-width": sw,
        }),
      );
      g.appendChild(se("circle", { cx: hx, cy: hy, r: 4 / zoom, fill: blue }));
    }
    if (last.h1) {
      const hx = rp2p(last.h1.x),
        hy = rp2p(last.h1.y);
      g.appendChild(
        se("line", {
          x1: px,
          y1: py,
          x2: hx,
          y2: hy,
          stroke: blue,
          "stroke-width": sw,
          opacity: "0.5",
        }),
      );
      g.appendChild(
        se("circle", {
          cx: hx,
          cy: hy,
          r: 3 / zoom,
          fill: blue,
          opacity: "0.6",
        }),
      );
    }
  } else {
    // ── Hover mode: show committed path + ghost segment from last node to cursor ──

    // 1. Full placed path
    if (nodes.length >= 2) {
      const d = bezierPathToD(nodes, false, scale);
      if (d)
        g.appendChild(
          se("path", {
            d,
            stroke: blue,
            "stroke-width": sw,
            fill: "none",
            opacity: "0.8",
          }),
        );
    }

    // 2. Ghost segment: last → cursor, respecting last.h2 for curve
    const lx = rpx(last),
      ly = rpy(last);
    const cx = rp2p(cursorRP.x),
      cy = rp2p(cursorRP.y);
    let ghostD;
    if (last.h2) {
      // Smooth node: use h2 as cp1, cursor as cp2+endpoint (straight into cursor)
      const cp1x = rp2p(last.h2.x),
        cp1y = rp2p(last.h2.y);
      ghostD = `M ${lx},${ly} C ${cp1x},${cp1y} ${cx},${cy} ${cx},${cy}`;
    } else {
      ghostD = `M ${lx},${ly} L ${cx},${cy}`;
    }
    g.appendChild(
      se("path", {
        d: ghostD,
        stroke: blue,
        "stroke-width": sw,
        fill: "none",
        "stroke-dasharray": `${4 / zoom} ${3 / zoom}`,
        opacity: "0.6",
      }),
    );

    // 3. Anchor squares + handle arms for all placed nodes
    for (const n of nodes) {
      const px = rpx(n),
        py = rpy(n);
      for (const h of [n.h1, n.h2]) {
        if (!h) continue;
        const hx = rp2p(h.x),
          hy = rp2p(h.y);
        g.appendChild(
          se("line", {
            x1: px,
            y1: py,
            x2: hx,
            y2: hy,
            stroke: blue,
            "stroke-width": 0.4 / zoom,
            opacity: "0.6",
          }),
        );
        g.appendChild(
          se("circle", {
            cx: hx,
            cy: hy,
            r: 3 / zoom,
            fill: blue,
            opacity: "0.7",
          }),
        );
      }
      g.appendChild(
        se("rect", {
          x: px - hs / 2,
          y: py - hs / 2,
          width: hs,
          height: hs,
          fill: "#fff",
          stroke: blue,
          "stroke-width": vsw,
        }),
      );
    }

    // 4. Close-path ring: when cursor is within ~10px (paper) of first node
    if (nodes.length > 1 && cursorPP) {
      const first = nodes[0];
      const fpx = realToPaper(first.x, scale),
        fpy = realToPaper(first.y, scale);
      const distPaper = Math.hypot(cursorPP.x - fpx, cursorPP.y - fpy);
      if (distPaper < 10 / zoom) {
        g.appendChild(
          se("circle", {
            cx: fpx,
            cy: fpy,
            r: 7 / zoom,
            fill: "none",
            stroke: blue,
            "stroke-width": vsw * 2,
            opacity: "0.9",
          }),
        );
      }
    }
  }

  _vp.appendChild(g);
}

// ── Edit mode handles ─────────────────────────────────────────
function renderBezierEditHandles(shape, page, zoom, g) {
  const scale = page.scale;
  const hs = 5 / zoom,
    vsw = 0.5 / zoom,
    hr = 3.5 / zoom;

  for (let ni = 0; ni < shape.nodes.length; ni++) {
    const n = shape.nodes[ni];
    const px = realToPaper(n.x, scale),
      py = realToPaper(n.y, scale);

    // Handle arms + circles
    for (const type of ["h1", "h2"]) {
      const h = n[type];
      if (!h) continue;
      const hx = realToPaper(h.x, scale),
        hy = realToPaper(h.y, scale);
      g.appendChild(
        se("line", {
          x1: px,
          y1: py,
          x2: hx,
          y2: hy,
          stroke: "#2563eb",
          "stroke-width": 0.4 / zoom,
          "pointer-events": "none",
          opacity: "0.6",
        }),
      );
      g.appendChild(
        se("circle", {
          cx: hx,
          cy: hy,
          r: hr,
          fill: "#2563eb",
          stroke: "#fff",
          "stroke-width": vsw,
          "data-bezier-handle": `${ni},${type}`,
          "data-sid": shape.id,
          cursor: "crosshair",
        }),
      );
    }

    // Anchor square
    g.appendChild(
      se("rect", {
        x: px - hs / 2,
        y: py - hs / 2,
        width: hs,
        height: hs,
        fill: "#fff",
        stroke: "#2563eb",
        "stroke-width": vsw,
        "data-bezier-anchor": ni,
        "data-sid": shape.id,
        cursor: "move",
      }),
    );
  }
}

// ── Edit mode interaction ─────────────────────────────────────
function handleBezierEditDown(e, rp) {
  // Anchor
  const anchorEl = e.target.closest("[data-bezier-anchor]");
  if (anchorEl) {
    const ni = parseInt(anchorEl.getAttribute("data-bezier-anchor"));
    const sid = anchorEl.getAttribute("data-sid");
    let shape = null;
    for (const layer of getCurrentPage().layers) {
      shape = layer.shapes.find((s) => s.id === sid);
      if (shape) break;
    }
    if (!shape) return false;
    _bezierDragH = {
      nodeIdx: ni,
      type: "anchor",
      shapeId: sid,
      startRP: { ...rp },
      origNodes: JSON.parse(JSON.stringify(shape.nodes)),
    };
    return true;
  }
  // Handle circle
  const handleEl = e.target.closest("[data-bezier-handle]");
  if (handleEl) {
    const [ni, type] = handleEl.getAttribute("data-bezier-handle").split(",");
    const sid = handleEl.getAttribute("data-sid");
    let shape = null;
    for (const layer of getCurrentPage().layers) {
      shape = layer.shapes.find((s) => s.id === sid);
      if (shape) break;
    }
    if (!shape) return false;
    _bezierDragH = {
      nodeIdx: parseInt(ni),
      type,
      shapeId: sid,
      startRP: { ...rp },
      origNodes: JSON.parse(JSON.stringify(shape.nodes)),
    };
    return true;
  }
  return false;
}

function handleBezierEditMove(rp) {
  if (!_bezierDragH) return false;
  const { nodeIdx, type, shapeId, startRP, origNodes } = _bezierDragH;
  const dx = rp.x - startRP.x,
    dy = rp.y - startRP.y;
  let shape = null;
  for (const layer of getCurrentPage().layers) {
    shape = layer.shapes.find((s) => s.id === shapeId);
    if (shape) break;
  }
  if (!shape) return false;
  const orig = origNodes[nodeIdx];

  if (type === "anchor") {
    // Move anchor + both handles by same delta
    shape.nodes[nodeIdx] = {
      x: orig.x + dx,
      y: orig.y + dy,
      h1: orig.h1 ? { x: orig.h1.x + dx, y: orig.h1.y + dy } : null,
      h2: orig.h2 ? { x: orig.h2.x + dx, y: orig.h2.y + dy } : null,
    };
  } else {
    // Move just this handle
    const h = { x: orig[type].x + dx, y: orig[type].y + dy };
    shape.nodes[nodeIdx] = { ...orig, [type]: h };
    // Mirror opposite handle for smooth nodes
    const opp = type === "h1" ? "h2" : "h1";
    if (orig[opp]) {
      const len = Math.hypot(orig[opp].x - orig.x, orig[opp].y - orig.y);
      const newDx = h.x - orig.x,
        newDy = h.y - orig.y;
      const newLen = Math.hypot(newDx, newDy) || 1;
      shape.nodes[nodeIdx][opp] = {
        x: orig.x - (newDx / newLen) * len,
        y: orig.y - (newDy / newLen) * len,
      };
    }
  }
  render();
  return true;
}

function handleBezierEditUp() {
  if (!_bezierDragH) return false;
  pushHistory();
  _bezierDragH = null;
  return true;
}

function exitBezierEditMode() {
  _bezierEditId = null;
  _bezierDragH = null;
}
