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

// Snap `pt` so the vector from `from` is constrained to 0/45/90… increments.
function _bezierAngleSnap(from, pt) {
  const dx = pt.x - from.x,
    dy = pt.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: pt.x, y: pt.y };
  // 15° increments (0/15/30/45…) — fine enough to hit 45° corners precisely.
  const step = Math.PI / 12;
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: from.x + len * Math.cos(snapped),
    y: from.y + len * Math.sin(snapped),
  };
}

// Smart guides: snap the cursor so it lines up (same x or same y) with an
// already-placed node. Returns the snapped real point + guide segments (paper
// coords) to draw. This is what makes a precise square easy: each new corner
// locks onto the previous corners' axes.
function _bezierAlignSnap(rp, pp) {
  const out = { x: rp.x, y: rp.y, guides: [] };
  if (!_bezierDraw || !pp || !_bezierDraw.nodes.length) return out;
  const scale = getCurrentPage().scale;
  const zoom = getState().zoom;
  const TH = 6 / zoom; // tolerance in paper px
  let bestV = null,
    bestVd = TH; // match X (vertical guide)
  let bestH = null,
    bestHd = TH; // match Y (horizontal guide)
  for (const n of _bezierDraw.nodes) {
    if (n.break) continue;
    const npx = realToPaper(n.x, scale),
      npy = realToPaper(n.y, scale);
    const dxp = Math.abs(pp.x - npx);
    if (dxp < bestVd) ((bestVd = dxp), (bestV = { x: n.x, px: npx, py: npy }));
    const dyp = Math.abs(pp.y - npy);
    if (dyp < bestHd) ((bestHd = dyp), (bestH = { y: n.y, px: npx, py: npy }));
  }
  if (bestV) {
    out.x = bestV.x;
    out.guides.push({ x1: bestV.px, y1: bestV.py, x2: bestV.px, y2: pp.y });
  }
  if (bestH) {
    out.y = bestH.y;
    out.guides.push({ x1: bestH.px, y1: bestH.py, x2: pp.x, y2: bestH.py });
  }
  return out;
}

function handleBezierDown(rp, pp, shiftKey, altKey) {
  if (!_bezierDraw) {
    _bezierDraw = {
      nodes: [{ x: rp.x, y: rp.y, h1: null, h2: null }],
      isDragging: true,
      dragAlt: !!altKey,
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
  // Shift → constrain the new segment to a 15° increment from the previous
  // anchor. Otherwise apply smart alignment to previous corners' axes.
  let np = { x: rp.x, y: rp.y };
  if (shiftKey) {
    const prev = _bezierDraw.nodes[_bezierDraw.nodes.length - 1];
    np = _bezierAngleSnap(prev, rp);
  } else {
    const al = _bezierAlignSnap(rp, pp);
    np = { x: al.x, y: al.y };
  }
  _bezierDraw.nodes.push({ x: np.x, y: np.y, h1: null, h2: null });
  _bezierDraw.isDragging = true;
  // Alt → break the handle: this corner's outgoing tangent is set independently
  // of its incoming side (keeps a sharp "tip" on one side, curve on the other).
  _bezierDraw.dragAlt = !!altKey;
  render();
  renderBezierOverlay();
}

function handleBezierMove(rp, pp, shiftKey, altKey) {
  if (!_bezierDraw) return;
  _bezierDraw.cursorRP = { ...rp };
  _bezierDraw.cursorPP = pp ? { ...pp } : null;
  _bezierDraw.shiftKey = !!shiftKey;
  _bezierDraw.alignGuides = null;
  if (_bezierDraw.isDragging) {
    const last = _bezierDraw.nodes[_bezierDraw.nodes.length - 1];
    // Alt can be (re)pressed mid-drag to toggle the break.
    const broken = _bezierDraw.dragAlt || !!altKey;
    _bezierDraw.dragAlt = broken;
    let hp = { x: rp.x, y: rp.y };
    if (shiftKey) hp = _bezierAngleSnap(last, rp); // snap handle direction to 15°
    const dx = hp.x - last.x,
      dy = hp.y - last.y;
    if (Math.hypot(dx, dy) > 1) {
      last.h2 = { x: last.x + dx, y: last.y + dy };
      // Mirror to h1 for a smooth node; with Alt, leave the incoming side a corner.
      last.h1 = broken ? null : { x: last.x - dx, y: last.y - dy };
    } else {
      last.h2 = null;
      last.h1 = null;
    }
  } else if (_bezierDraw.nodes.length) {
    // Hover preview snaps too, so the ghost segment matches where the click lands.
    if (shiftKey) {
      const prev = _bezierDraw.nodes[_bezierDraw.nodes.length - 1];
      _bezierDraw.cursorRP = _bezierAngleSnap(prev, rp);
    } else {
      const al = _bezierAlignSnap(rp, pp);
      _bezierDraw.cursorRP = { x: al.x, y: al.y };
      _bezierDraw.alignGuides = al.guides.length ? al.guides : null;
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

  // Smart alignment guides (Figma-red) — drawn first so they sit behind the path.
  if (_bezierDraw.alignGuides) {
    for (const gl of _bezierDraw.alignGuides) {
      g.appendChild(
        se("line", {
          x1: gl.x1,
          y1: gl.y1,
          x2: gl.x2,
          y2: gl.y2,
          stroke: "#f24822",
          "stroke-width": vsw,
          "stroke-dasharray": `${3 / zoom} ${2 / zoom}`,
        }),
      );
    }
  }

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

  // ── HUD: length (mm) + angle, so connecting/snapping is legible ──
  {
    const last = nodes[nodes.length - 1];
    let vx, vy, anchor;
    if (isDragging && last.h2) {
      vx = last.h2.x - last.x;
      vy = last.h2.y - last.y;
      anchor = last;
    } else if (!isDragging) {
      vx = cursorRP.x - last.x;
      vy = cursorRP.y - last.y;
      anchor = last;
    }
    if (anchor && Math.hypot(vx, vy) > 0.5) {
      const lenMm = Math.hypot(vx, vy) / 10;
      let deg = (-Math.atan2(vy, vx) * 180) / Math.PI; // screen y is down → negate
      if (deg < 0) deg += 360;
      const label = `${fmtNum(lenMm)} mm  ${deg.toFixed(0)}°`;
      const fs = 11 / zoom;
      const lx = realToPaper(cursorRP.x, scale) + 12 / zoom;
      const ly = realToPaper(cursorRP.y, scale) - 12 / zoom;
      const padX = 4 / zoom,
        padY = 3 / zoom;
      const w = label.length * fs * 0.55 + padX * 2;
      g.appendChild(
        se("rect", {
          x: lx - padX,
          y: ly - fs,
          width: w,
          height: fs + padY * 2,
          rx: 3 / zoom,
          fill: "#1a1a2e",
          opacity: "0.85",
        }),
      );
      const t = se("text", {
        x: lx,
        y: ly + padY,
        "font-size": fs,
        "font-family": "Helvetica,Arial,sans-serif",
        fill: "#fff",
      });
      t.textContent = label;
      g.appendChild(t);
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
    // Alt-click an anchor → convert point type (Figma's convert-point tool):
    //   smooth (has handles) → corner (sharp, no handles),
    //   corner (no handles)  → smooth (handles aligned with neighbors).
    if (e.altKey) {
      _convertBezierNode(shape, ni);
      pushHistory();
      render();
      return true;
    }
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

function handleBezierEditMove(rp, shiftKey, altKey) {
  if (!_bezierDragH) return false;
  const { nodeIdx, type, shapeId, startRP, origNodes } = _bezierDragH;
  let dx = rp.x - startRP.x,
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
    // Shift → constrain handle direction to a 15° increment from its anchor.
    if (shiftKey) {
      const snapped = _bezierAngleSnap(orig, {
        x: orig[type].x + dx,
        y: orig[type].y + dy,
      });
      dx = snapped.x - orig[type].x;
      dy = snapped.y - orig[type].y;
    }
    // Move just this handle
    const h = { x: orig[type].x + dx, y: orig[type].y + dy };
    shape.nodes[nodeIdx] = { ...orig, [type]: h };
    // Mirror opposite handle for smooth nodes; Alt breaks the mirror (independent corner).
    const opp = type === "h1" ? "h2" : "h1";
    if (orig[opp] && !altKey) {
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
  // liveUpdateShapes bumps the render version (markShapeDirty) so the path itself
  // rebuilds — a plain render() would hit the shape-cache and only move the
  // handle, leaving the curve frozen until release.
  if (typeof liveUpdateShapes === "function") liveUpdateShapes([shapeId]);
  else render();
  return true;
}

function handleBezierEditUp() {
  if (!_bezierDragH) return false;
  pushHistory();
  _bezierDragH = null;
  return true;
}

// Toggle a node between corner (no handles) and smooth (mirrored handles).
function _convertBezierNode(shape, ni) {
  const nodes = shape.nodes;
  const n = nodes[ni];
  if (!n) return;
  if (n.h1 || n.h2) {
    // smooth → corner
    n.h1 = null;
    n.h2 = null;
    return;
  }
  // corner → smooth: align handles along the line joining the neighbours,
  // length ~1/3 of the gap to each side (Figma-style auto-smooth).
  const prev = nodes[ni - 1];
  const next = nodes[ni + 1];
  const a = prev && !prev.break ? prev : n;
  const b = next && !next.break ? next : n;
  let tx = b.x - a.x,
    ty = b.y - a.y;
  const tlen = Math.hypot(tx, ty);
  if (tlen < 1e-6) {
    tx = 1;
    ty = 0;
  } else {
    tx /= tlen;
    ty /= tlen;
  }
  const d1 = (Math.hypot(n.x - a.x, n.y - a.y) || 30) / 3;
  const d2 = (Math.hypot(b.x - n.x, b.y - n.y) || 30) / 3;
  n.h1 = { x: n.x - tx * d1, y: n.y - ty * d1 };
  n.h2 = { x: n.x + tx * d2, y: n.y + ty * d2 };
}

function exitBezierEditMode() {
  _bezierEditId = null;
  _bezierDragH = null;
}
