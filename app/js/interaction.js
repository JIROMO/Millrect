"use strict";

let _ds = null,
  _panning = false,
  _panStart = null,
  _dimState = null,
  _lastPP = null;
let _vertexEditId = null;
let _textClickState = null;

function _drawStyle() {
  const s = getState();
  return {
    stroke: s.drawStroke || "#1a1a2e",
    fill: s.drawFill ?? "none",
  };
}

// ── 鉛筆（雑メモ用）─────────────────────────────────
// 生のカーソル座標を集めて 1 本の pencil 図形にする。スナップは効かせない。
let _pencil = null;
const PENCIL_MIN_DIST = 3; // real units。これ未満の移動は間引く

function _rawReal(e, svgEl) {
  const sv = screenToSVG(e, svgEl);
  const pp = svgToPaper(sv.x, sv.y);
  return paperToReal(pp.x, pp.y);
}

function _pencilPreviewShape() {
  const style = _drawStyle();
  return {
    id: "__pencil_prev__",
    type: "pencil",
    points: _pencil.points,
    stroke: style.stroke,
    penWidth: getState().penWidth ?? 1.5,
  };
}

function handlePencilDown(e, svgEl) {
  const rp = _rawReal(e, svgEl);
  _pencil = { points: [{ x: rp.x, y: rp.y }] };
  renderPreview(_pencilPreviewShape());
}

function handlePencilMove(e, svgEl) {
  if (!_pencil) return;
  const rp = _rawReal(e, svgEl);
  const last = _pencil.points[_pencil.points.length - 1];
  if (Math.hypot(rp.x - last.x, rp.y - last.y) < PENCIL_MIN_DIST) return;
  _pencil.points.push({ x: rp.x, y: rp.y });
  renderPreview(_pencilPreviewShape());
}

function handlePencilUp() {
  if (!_pencil) return;
  const pts = _pencil.points;
  _pencil = null;
  removePreview();
  // 1 点だけ（クリックしただけ）はメモにならないので捨てる
  if (pts.length < 2) {
    render();
    return;
  }
  const style = _drawStyle();
  const id = genId("pencil");
  addShape({
    id,
    type: "pencil",
    points: pts,
    stroke: style.stroke,
    penWidth: getState().penWidth ?? 1.5,
  });
  // ツールは pencil のまま（続けて雑にメモを描けるように）。選択もしない。
  render();
  uiUpdate();
}

// foreignObject content is in HTML namespace; this climbs both HTML and SVG trees
function svgClosest(el, selector) {
  if (!el) return null;
  const direct = el.closest(selector);
  if (direct) return direct;
  const fo = el.closest && el.closest("foreignObject");
  if (fo) return fo.parentElement && fo.parentElement.closest(selector);
  return null;
}

function screenToSVG(e, svgEl) {
  const r = svgEl.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function svgToPaper(sx, sy) {
  const { panX, panY, zoom } = getState();
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
}
function paperToReal(px, py) {
  const { scale } = getCurrentPage();
  return {
    x: paperToRealDist(px, scale),
    y: paperToRealDist(py, scale),
  };
}
// オブジェクトスナップの吸着半径（画面ピクセル基準・ズーム非依存）
const SNAP_SCREEN_PX = 8;

function getSnapped(sx, sy, opts = {}) {
  const state = getState(),
    page = getCurrentPage();
  let pt = svgToPaper(sx, sy);
  if (state.snapEnabled) {
    if (!opts.gridOnly) {
      const shapes = getAllShapesOnPage(page);
      const guides =
        typeof getViewSnapGuides === "function" ? getViewSnapGuides() : null;
      // threshold は paper 座標系（screen px = paper × zoom）
      const threshold = SNAP_SCREEN_PX / (state.zoom || 1);
      const snap = snapToShapes(pt, shapes, page.scale, threshold, guides, {
        excludeIds: opts.excludeIds,
      });
      if (snap) return { pt: snap, snapped: true, snapType: snap.snapType };
    }
    pt = snapPoint(pt, state.gridSize, page.scale);
  }
  return { pt, snapped: false, snapType: null };
}

function onMouseDown(e, svgEl) {
  const state = getState();
  const sv = screenToSVG(e, svgEl);
  const _altOnShape =
    e.altKey &&
    e.button === 0 &&
    (!!svgClosest(e.target, "[data-id]") ||
      !!e.target.closest("[data-handle]") ||
      !!e.target.closest("[data-rotate-handle]"));
  if (e.button === 1 || (e.button === 0 && e.altKey && !_altOnShape)) {
    _panning = true;
    _panStart = {
      x: e.clientX,
      y: e.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    svgEl.style.cursor = "grab";
    e.preventDefault();
    return;
  }
  if (e.button !== 0) return;
  const anchorSnap = isReferenceScaleAnchorActive?.() ? { gridOnly: true } : {};
  const { pt: pp } = getSnapped(sv.x, sv.y, anchorSnap);
  const rp = paperToReal(pp.x, pp.y);
  if (
    typeof handleReferenceScaleAnchorClick === "function" &&
    handleReferenceScaleAnchorClick(rp)
  ) {
    e.preventDefault();
    return;
  }
  const tool = state.activeTool;
  if (
    (tool === "select" || tool === "hand") &&
    typeof handleReferenceImagePointerDown === "function" &&
    handleReferenceImagePointerDown(rp, state.zoom, tool)
  ) {
    if (typeof getReferenceImageHoverCursor === "function") {
      const refCur = getReferenceImageHoverCursor(rp, state.zoom);
      if (refCur) svgEl.style.cursor = refCur;
    }
    e.preventDefault();
    return;
  }
  // Bezier edit mode is tool-independent — check first
  if (_bezierEditId) {
    // Clicked a node/handle → keep editing.
    if (handleBezierEditDown(e, rp)) return;
    // Clicked anywhere else → leave edit mode and fall through to normal
    // selection (Figma: click outside the points exits point-edit).
    exitBezierEditMode();
    render();
  }
  if (tool === "select") handleSelDown(e, svgEl, pp, rp);
  else if (tool === "hand") {
    _ds = {
      action: "pan",
      startCX: e.clientX,
      startCY: e.clientY,
      origPanX: state.panX,
      origPanY: state.panY,
    };
    svgEl.style.cursor = "grabbing";
  } else if (tool === "line") _ds = { tool, sp: pp, sr: rp };
  else if (tool === "rect") _ds = { tool, sp: pp, sr: rp };
  else if (tool === "circle") _ds = { tool, sp: pp, sr: rp };
  else if (tool === "text") handleTextToolDown(e, rp);
  else if (tool === "dimension") handleDimDown(pp, rp);
  else if (tool === "bezier") {
    handleBezierDown(rp, pp, e.shiftKey, e.altKey);
  } else if (tool === "pencil") {
    handlePencilDown(e, svgEl);
  }
}

function _getSelectSnapOpts() {
  const tool = getState().activeTool;
  if (tool !== "select" || !_ds) return {};
  if (_ds.action === "resize" && _ds.shapeId) {
    const res = findShapeById(_ds.shapeId);
    if (res?.shape?.type === "dimension") return { gridOnly: true };
    // 自分自身のキーポイントへの吸着を防ぐ
    return { excludeIds: new Set([_ds.shapeId]) };
  }
  if (_ds.action === "vertex" && _ds.shapeId) {
    return { excludeIds: new Set([_ds.shapeId]) };
  }
  if (
    _ds.action === "move" ||
    _ds.action === "move-pending" ||
    _ds.action === "multi-resize"
  ) {
    const ids = getState().selectedShapeIds;
    if (
      _ds.action !== "multi-resize" &&
      ids.length > 0 &&
      ids.every((id) => findShapeById(id)?.shape?.type === "dimension")
    ) {
      return { gridOnly: true };
    }
    return { excludeIds: new Set(ids) };
  }
  return {};
}

function onMouseMove(e, svgEl) {
  const state = getState();
  if (
    typeof isReferenceScaleAnchorActive === "function" &&
    isReferenceScaleAnchorActive()
  ) {
    const sv = screenToSVG(e, svgEl);
    const { pt: pp } = getSnapped(sv.x, sv.y, { gridOnly: true });
    const rp = paperToReal(pp.x, pp.y);
    setReferenceScaleAnchorCursor(rp);
    render();
    return;
  }
  if (_panning && _panStart) {
    state.panX = _panStart.panX + (e.clientX - _panStart.x);
    state.panY = _panStart.panY + (e.clientY - _panStart.y);
    applyViewportTransform();
    return;
  }
  // 鉛筆はスナップを使わない（生のカーソルで雑に描く）
  if (state.activeTool === "pencil") {
    removeSnapIndicator();
    if (_pencil) handlePencilMove(e, svgEl);
    const rp0 = _rawReal(e, svgEl);
    updateStatusCoords(rp0);
    return;
  }
  const sv = screenToSVG(e, svgEl);
  const tool = state.activeTool;
  const isSelectionMove =
    tool === "select" &&
    (_ds?.action === "move" || _ds?.action === "move-pending");
  const snapOpts = isSelectionMove ? { gridOnly: true } : _getSelectSnapOpts();
  const { pt: pp, snapped, snapType } = getSnapped(sv.x, sv.y, snapOpts);
  _lastPP = pp;
  const rp = paperToReal(pp.x, pp.y);
  updateStatusCoords(rp);
  if (!isSelectionMove) {
    snapped
      ? renderSnapIndicator(pp.x, pp.y, state.zoom, snapType)
      : removeSnapIndicator();
  }

  if (
    typeof handleReferenceImagePointerMove === "function" &&
    handleReferenceImagePointerMove(rp, e.shiftKey)
  ) {
    if (typeof getReferenceImageHoverCursor === "function") {
      const refCur = getReferenceImageHoverCursor(rp, state.zoom);
      if (refCur) svgEl.style.cursor = refCur;
    }
    return;
  }

  if (
    !_ds &&
    (tool === "select" || tool === "hand") &&
    typeof getReferenceImageHoverCursor === "function" &&
    typeof isReferenceImageSelected === "function" &&
    isReferenceImageSelected()
  ) {
    const refCur = getReferenceImageHoverCursor(rp, state.zoom);
    svgEl.style.cursor = refCur || (tool === "hand" ? "grab" : "default");
  }
  if ((tool === "select" || tool === "hand") && _ds?.action === "pan") {
    state.panX = _ds.origPanX + (e.clientX - _ds.startCX);
    state.panY = _ds.origPanY + (e.clientY - _ds.startCY);
    applyViewportTransform();
    return;
  }
  if (tool === "select" && _ds?.action === "marquee") {
    setMarquee(_ds.startPP, pp);
    render();
    return;
  }
  if (tool === "select" && _ds?.action === "dim-label") {
    document.body.classList.add("dragging");
    const { shapeId, startRP, origOffsetX, origOffsetY } = _ds;
    const res = findShapeById(shapeId);
    if (res) {
      res.shape.textOffsetX = origOffsetX + (rp.x - startRP.x);
      res.shape.textOffsetY = origOffsetY + (rp.y - startRP.y);
      liveUpdateShapes([shapeId]);
    }
    return;
  }
  if (tool === "select" && _ds?.action === "rotate") {
    document.body.classList.add("dragging");
    removeSnapIndicator();
    // スナップ済み rp ではなく生ポインタ座標で角度を取る
    const rawPP = svgToPaper(sv.x, sv.y);
    handleRotate(paperToReal(rawPP.x, rawPP.y), e.shiftKey);
    return;
  }
  if (tool === "select" && _ds?.action === "multi-resize") {
    document.body.classList.add("dragging");
    handleMultiResize(rp, e.shiftKey);
    return;
  }
  if (tool === "select" && _ds?.action === "move-pending") {
    const dx = pp.x - _ds.startPP.x;
    const dy = pp.y - _ds.startPP.y;
    const thresh = 3 / state.zoom;
    if (Math.hypot(dx, dy) >= thresh) _ds.action = "move";
    else return;
  }
  if (tool === "select" && _ds?.action === "resize") {
    document.body.classList.add("dragging");
    handleResize(rp, e.shiftKey);
    return;
  }
  if (tool === "select" && _ds?.action === "move") {
    document.body.classList.add("dragging");
    if (e.altKey && !_ds.duplicated) {
      _beginDuplicate([...state.selectedShapeIds]);
    }
    handleSelMove(pp, e.shiftKey);
    return;
  }
  if (tool === "select" && _ds?.action === "vertex") {
    handleVertexDrag(rp);
    return;
  }

  // Bezier edit handle drag is tool-independent
  if (_bezierEditId && handleBezierEditMove(rp, e.shiftKey, e.altKey)) return;

  if (tool === "bezier") {
    handleBezierMove(rp, pp, e.shiftKey, e.altKey);
    return;
  }

  if (!_ds) {
    if (tool === "dimension" && _dimState) {
      const ds = _dimState;
      if (ds.step === 1) {
        const dx = Math.abs(rp.x - ds.fr.x),
          dy = Math.abs(rp.y - ds.fr.y);
        renderPreview({
          id: "__prev__",
          type: "dimension",
          dimensionType: dx >= dy ? "horizontal" : "vertical",
          from: ds.fr,
          to: rp,
          offset: -80,
        });
      } else if (ds.step === 2) {
        const offset = ds.isH ? rp.y - ds.fr.y : rp.x - ds.fr.x;
        renderPreview({
          id: "__prev__",
          type: "dimension",
          dimensionType: ds.isH ? "horizontal" : "vertical",
          from: ds.fr,
          to: ds.to,
          offset,
        });
      }
    }
    return;
  }
  if (!["line", "rect", "circle"].includes(tool)) return;
  renderPreview(buildPreview(tool, _ds.sr, rp, e.shiftKey));
}

function onMouseUp(e, svgEl) {
  if (e.button === 1 || _panning) {
    _panning = false;
    _panStart = null;
    svgEl.style.cursor = "";
    return;
  }
  if (e.button !== 0) return;
  if (
    typeof handleReferenceImagePointerUp === "function" &&
    handleReferenceImagePointerUp()
  ) {
    svgEl.style.cursor = "";
    return;
  }
  const sv = screenToSVG(e, svgEl);
  const { pt: pp } = getSnapped(sv.x, sv.y);
  const rp = paperToReal(pp.x, pp.y);
  const tool = getState().activeTool;
  if ((tool === "select" || tool === "hand") && _ds?.action === "pan") {
    _ds = null;
    svgEl.style.cursor = tool === "hand" ? "grab" : "default";
    return;
  }
  if (tool === "select" && _ds?.action === "marquee") {
    commitMarquee(_ds.startPP, pp);
    clearMarquee();
    _ds = null;
    svgEl.style.cursor = "default";
    return;
  }
  if (tool === "select" && _ds?.action === "dim-label") {
    const moved =
      Math.abs(rp.x - _ds.startRP.x) > 1 || Math.abs(rp.y - _ds.startRP.y) > 1;
    if (moved) {
      if (typeof markShapeDirty === "function") markShapeDirty(_ds.shapeId);
      pushHistory();
    }
    _ds = null;
    svgEl.style.cursor = "default";
    document.body.classList.remove("dragging");
    return;
  }
  if (tool === "select" && _ds?.action === "rotate") {
    if (typeof markShapeDirty === "function") markShapeDirty(_ds.shapeId);
    pushHistory();
    _ds = null;
    svgEl.style.cursor = "default";
    document.body.classList.remove("dragging");
    uiUpdate();
    return;
  }
  if (tool === "select" && _ds?.action === "multi-resize") {
    if (typeof markShapeDirty === "function") {
      for (const id of getState().selectedShapeIds) markShapeDirty(id);
    }
    pushHistory();
    _ds = null;
    svgEl.style.cursor = "default";
    document.body.classList.remove("dragging");
    return;
  }
  if (tool === "select" && _ds?.action === "resize") {
    if (typeof setTextNativeLiveTransform === "function") {
      const res = findShapeById(_ds.shapeId);
      if (res?.shape?.type === "text") {
        setTextNativeLiveTransform(_ds.shapeId, false);
      }
    }
    if (typeof markShapeDirty === "function") markShapeDirty(_ds.shapeId);
    pushHistory();
    _ds = null;
    svgEl.style.cursor = "default";
    document.body.classList.remove("dragging");
    return;
  }
  if (tool === "select" && _ds?.action === "move") {
    // Alt+ドラッグ複製の確定時は変位を記録し、⌘D が同じ複製を繰り返せるようにする
    if (_ds.duplicated && typeof setLastDuplicateOffset === "function") {
      setLastDuplicateOffset(_ds.lastDxR || 0, _ds.lastDyR || 0);
    }
    // ライブドラッグ（transform のみ）中は実座標を動かしていないので、ここで反映する。
    // その後のフル render が transform 付きノードを素のノードへ作り直す。
    if (_ds.fastActive) {
      const dxR = _ds.lastDxR || 0,
        dyR = _ds.lastDyR || 0;
      if (dxR || dyR) {
        for (const id of getState().selectedShapeIds) {
          const res = findShapeById(id);
          if (res) shiftShape(res.shape, dxR, dyR);
        }
      }
    }
    if (typeof markShapeDirty === "function") {
      for (const id of getState().selectedShapeIds) markShapeDirty(id);
    }
    pushHistory();
    if (_ds.fastActive) render();
    _ds = null;
    svgEl.style.cursor = "default";
    document.body.classList.remove("dragging");
    return;
  }
  if (tool === "select" && _ds?.action === "move-pending") {
    _ds = null;
    svgEl.style.cursor = "default";
    return;
  }
  if (tool === "select" && _ds?.action === "vertex") {
    pushHistory();
    _ds = null;
    return;
  }
  // Bezier edit handle release is tool-independent
  if (_bezierEditId && handleBezierEditUp()) return;
  if (tool === "bezier") {
    handleBezierUp();
    return;
  }
  if (tool === "pencil") {
    handlePencilUp();
    return;
  }
  if (!_ds || ["dimension", "text", "select"].includes(tool)) return;
  commitShape(tool, _ds.sr, rp, e.shiftKey);
  removePreview();
  _ds = null;
  document.body.classList.remove("dragging");
}

function wheelBypassesCanvasPan(e) {
  const pop =
    e.target instanceof Element ? e.target.closest("#help-popover") : null;
  if (pop && !pop.hidden) {
    const body = pop.querySelector(".help-popover-body");
    if (body && body.scrollHeight > body.clientHeight + 1) {
      const max = body.scrollHeight - body.clientHeight;
      if (e.deltaY < 0 && body.scrollTop > 0) return true;
      if (e.deltaY > 0 && body.scrollTop < max - 1) return true;
    }
    e.preventDefault();
    return true;
  }

  let el = e.target instanceof Element ? e.target : null;
  while (el && el !== document.body) {
    const { overflowY } = window.getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      const max = el.scrollHeight - el.clientHeight;
      if (e.deltaY < 0 && el.scrollTop > 0) return true;
      if (e.deltaY > 0 && el.scrollTop < max - 1) return true;
    }
    el = el.parentElement;
  }
  return false;
}

function onWheel(e, svgEl) {
  if (wheelBypassesCanvasPan(e)) return;
  e.preventDefault();
  const state = getState();
  const { left, top } = svgEl.getBoundingClientRect();
  const mx = e.clientX - left,
    my = e.clientY - top;
  if (e.ctrlKey) {
    const f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const nz = Math.max(0.2, Math.min(50, state.zoom * f));
    state.panX = mx - (mx - state.panX) * (nz / state.zoom);
    state.panY = my - (my - state.panY) * (nz / state.zoom);
    state.zoom = nz;
    const el = document.getElementById("status-zoom");
    if (el) el.textContent = `${(nz * 100).toFixed(0)}%`;
    render(); // ズームはストローク幅(1/zoom)等が変わるためフルレンダー
  } else {
    state.panX -= e.deltaX;
    state.panY -= e.deltaY;
    applyViewportTransform(); // パンは transform だけ
  }
}

function onKeyDown(e) {
  if (_textEditorActive) return;
  const state = getState();
  if (e.key === "Escape") {
    if (dismissContextMenu()) return;
    if (
      typeof isReferenceScaleAnchorActive === "function" &&
      isReferenceScaleAnchorActive()
    ) {
      cancelReferenceScaleAnchor();
      return;
    }
    if (
      typeof isReferenceImageSelected === "function" &&
      isReferenceImageSelected()
    ) {
      if (typeof endReferenceImageTransformEdit === "function") {
        endReferenceImageTransformEdit();
      } else {
        deselectReferenceImage();
        render();
        uiUpdate();
      }
      return;
    }
    if (_bezierEditId) {
      exitBezierEditMode();
      render();
      uiUpdate();
      return;
    }
    if (_bezierDraw) {
      cancelBezierDraw();
      return;
    }
    if (_pencil) {
      _pencil = null;
      removePreview();
      render();
      return;
    }
    if (_vertexEditId) {
      _vertexEditId = null;
      render();
      uiUpdate();
      return;
    }
    _ds = null;
    cancelDim();
    removePreview();
    render();
    return;
  }
  if (e.key === "Enter" && _bezierDraw) {
    e.preventDefault();
    handleBezierKey(e);
    return;
  }
  if (e.key === "Enter" && _bezierEditId) {
    e.preventDefault();
    exitBezierEditMode();
    render();
    uiUpdate();
    return;
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    state.selectedShapeIds.length > 0
  ) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    e.preventDefault();
    deleteSelectedShapes();
    render();
    uiUpdate();
    return;
  }
}

function cancelDim() {
  _dimState = null;
  removePreview();
}

// ── Marquee ───────────────────────────────────────────────────
let _selOrig = null;
function commitMarquee(a, b) {
  const state = getState();
  const page = getCurrentPage();
  const x1 = Math.min(a.x, b.x),
    y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x),
    y2 = Math.max(a.y, b.y);
  if (x2 - x1 < 1 && y2 - y1 < 1) return;
  const hit = [];
  const inBox = (bb) =>
    bb && bb.x >= x1 && bb.y >= y1 && bb.x + bb.w <= x2 && bb.y + bb.h <= y2;

  for (const layer of page.layers) {
    if (!layer.visible || layer.locked) continue;
    for (const s of layer.shapes) {
      if (s.locked) continue;
      if (inBox(getShapeBBox(s, page.scale))) hit.push(s.id);
    }
  }
  // 寸法線もmarquee選択の対象にする
  for (const dim of page.dimensions || []) {
    if (inBox(getShapeBBox(dim, page.scale))) hit.push(dim.id);
  }
  state.selectedShapeIds = hit;
  render();
  uiUpdate();
}

// ── Select / Resize ───────────────────────────────────────────
function handleSelDown(e, svgEl, pp, rp) {
  const state = getState();
  const tool = state.activeTool;
  if (
    (tool === "select" || tool === "text") &&
    _tryBeginTextShapeDblClick(e, rp)
  )
    return;

  if (_vertexEditId) {
    const vertexEl = e.target.closest("[data-vertex]");
    if (vertexEl) {
      const [pi, ri, vi] = vertexEl
        .getAttribute("data-vertex")
        .split(",")
        .map(Number);
      const sid = vertexEl.getAttribute("data-sid");
      let shape = null;
      for (const layer of getCurrentPage().layers) {
        shape = layer.shapes.find((s) => s.id === sid);
        if (shape) break;
      }
      if (shape) {
        _ds = {
          action: "vertex",
          shapeId: sid,
          pi,
          ri,
          vi,
          startRP: rp,
          origContours: JSON.parse(JSON.stringify(shape.contours)),
        };
        return;
      }
    }
    const clickedId = svgClosest(e.target, "[data-id]")?.getAttribute(
      "data-id",
    );
    if (clickedId !== _vertexEditId) {
      _vertexEditId = null;
    }
  }

  // Dimension label drag
  const dimLabelEl = e.target.closest("[data-dim-label]");
  if (dimLabelEl) {
    const sid = dimLabelEl.getAttribute("data-dim-label");
    state.selectedShapeIds = [sid];
    const res = findShapeById(sid);
    if (res) {
      _ds = {
        action: "dim-label",
        shapeId: sid,
        startRP: rp,
        origOffsetX: res.shape.textOffsetX || 0,
        origOffsetY: res.shape.textOffsetY || 0,
      };
      svgEl.style.cursor = "move";
      render();
      uiUpdate();
    }
    return;
  }

  // 回転ホットゾーン（コーナー外周）— リサイズハンドルより下層にあるので先に判定
  const rotEl = e.target.closest("[data-rotate-handle]");
  if (rotEl && !e.target.closest("[data-handle]")) {
    const sid = rotEl.getAttribute("data-sid");
    const res = findShapeById(sid);
    if (!res) return;
    state.selectedShapeIds = [sid];
    // 回転はスナップ無しの生ポインタ座標で角度を取る
    const sv = screenToSVG(e, svgEl);
    const rawPP = svgToPaper(sv.x, sv.y);
    const raw = paperToReal(rawPP.x, rawPP.y);
    const pivot = getShapePivotReal(res.shape);
    _ds = {
      action: "rotate",
      shapeId: sid,
      pivot,
      startAngle: Math.atan2(raw.y - pivot.y, raw.x - pivot.x),
      origRotation: res.shape.rotation || 0,
    };
    svgEl.style.cursor = ROTATE_CURSOR;
    render();
    uiUpdate();
    return;
  }

  const handleEl = e.target.closest("[data-handle]");
  if (handleEl) {
    const hi = parseInt(handleEl.getAttribute("data-handle"));
    const isMulti = handleEl.getAttribute("data-multi-resize") === "1";
    if (isMulti) {
      // Multi-shape resize: record origShapes and combined BB
      const page = getCurrentPage();
      const origShapes = {};
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const sid of state.selectedShapeIds) {
        for (const layer of page.layers) {
          const s = layer.shapes.find((sh) => sh.id === sid);
          if (s) {
            origShapes[sid] = JSON.parse(JSON.stringify(s));
            const bb = getShapeBBox(s, page.scale);
            if (bb) {
              if (bb.x < minX) minX = bb.x;
              if (bb.y < minY) minY = bb.y;
              if (bb.x + bb.w > maxX) maxX = bb.x + bb.w;
              if (bb.y + bb.h > maxY) maxY = bb.y + bb.h;
            }
            break;
          }
        }
      }
      _ds = {
        action: "multi-resize",
        hi,
        startRP: rp,
        origShapes,
        origBB: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      };
      svgEl.style.cursor = HANDLE_CURSORS[hi] || "crosshair";
      return;
    }
    const sid = handleEl.getAttribute("data-sid");
    state.selectedShapeIds = [sid];
    const res = findShapeById(sid);
    if (!res) return;
    if (res.shape?.type === "group") return;
    const origShape = JSON.parse(JSON.stringify(res.shape));
    _ds = {
      action: "resize",
      shapeId: sid,
      hi,
      startRP: rp,
      origShape,
      origPivot: getShapePivotReal(res.shape),
    };
    if (
      origShape?.type === "text" &&
      typeof setTextNativeLiveTransform === "function"
    ) {
      setTextNativeLiveTransform(sid, true);
    }
    svgEl.style.cursor = HANDLE_CURSORS[hi] || "crosshair";
    render();
    uiUpdate();
    return;
  }

  // 寸法線はオフセット位置に描画され、ヒット線/数字ラベルが DOM 上に存在する。
  // 見えている形状を直接クリックして選べるよう、幾何 bbox 判定より先に e.target を見る。
  const dimEl = e.target.closest?.('[data-type="dimension"]');
  if (dimEl) {
    const did = dimEl.getAttribute("data-id");
    const dres = findShapeById(did);
    if (dres?.isDimension) {
      if (e.shiftKey) {
        const idx = state.selectedShapeIds.indexOf(did);
        if (idx === -1) state.selectedShapeIds.push(did);
        else state.selectedShapeIds.splice(idx, 1);
        _ds = null;
        _resetTextClickState();
        render();
        uiUpdate();
        return;
      }
      _resetTextClickState();
      if (!state.selectedShapeIds.includes(did)) {
        state.selectedShapeIds = [did];
      }
      _selOrig = {};
      for (const selId of state.selectedShapeIds) {
        const r = findShapeById(selId);
        if (r) _selOrig[selId] = JSON.parse(JSON.stringify(r.shape));
      }
      _ds = { action: "move", startPP: pp };
      svgEl.style.cursor = "move";
      if (e.altKey) _beginDuplicate([...state.selectedShapeIds]);
      render();
      uiUpdate();
      return;
    }
  }

  const picked = findTopShapeAtRealPoint(rp);
  if (picked) {
    const id = picked.id;

    // Ctrl+click: cycle through all shapes under cursor (z-order traversal)
    if (e.ctrlKey) {
      const page = getCurrentPage();
      const allShapes = [];
      for (const layer of page.layers) {
        if (!layer.visible || layer.locked) continue;
        for (const s of layer.shapes) {
          if (s.locked) continue;
          if (realPointInShapeGeometry(rp, s, page.scale)) {
            allShapes.push(s.id);
          }
        }
      }
      if (allShapes.length > 1) {
        const cur = state.selectedShapeIds[0];
        const curIdx = allShapes.indexOf(cur);
        const nextIdx = (curIdx + 1) % allShapes.length;
        state.selectedShapeIds = [allShapes[nextIdx]];
        render();
        uiUpdate();
        return;
      }
    }

    if (e.shiftKey) {
      const idx = state.selectedShapeIds.indexOf(id);
      if (idx === -1) state.selectedShapeIds.push(id);
      else state.selectedShapeIds.splice(idx, 1);
      _ds = null;
      _resetTextClickState();
      render();
      uiUpdate();
      return;
    }
    const clickedShape = picked;
    if (clickedShape?.type !== "text") _resetTextClickState();
    if (!state.selectedShapeIds.includes(id)) {
      state.selectedShapeIds = [id];
    }
    _selOrig = {};
    for (const selId of state.selectedShapeIds) {
      const res = findShapeById(selId);
      if (res) _selOrig[selId] = JSON.parse(JSON.stringify(res.shape));
    }
    if (clickedShape?.type === "text") {
      _ds = { action: "move-pending", startPP: pp };
      svgEl.style.cursor = "text";
      render();
      uiUpdate();
      return;
    }
    _ds = { action: "move", startPP: pp };
    svgEl.style.cursor = "move";
    if (e.altKey) {
      _beginDuplicate([...state.selectedShapeIds]);
    }
  } else {
    _vertexEditId = null;
    state.selectedShapeIds = [];
    _selOrig = null;
    _resetTextClickState();
    _ds = { action: "marquee", startPP: pp, startRP: rp };
    svgEl.style.cursor = "crosshair";
  }
  render();
  uiUpdate();
}

function _computeBboxAfterResize(o, hi, dx, dy, shiftKey, ratio) {
  let ndx = dx,
    ndy = dy;
  if (shiftKey) {
    if (hi === 0) {
      ndx = dx;
      ndy = dx / -ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio))
        ((ndy = dy), (ndx = dy * -ratio));
    }
    if (hi === 2) {
      ndx = dx;
      ndy = -dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio))
        ((ndy = dy), (ndx = -dy * ratio));
    }
    if (hi === 4) {
      ndx = dx;
      ndy = dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio)) ((ndy = dy), (ndx = dy * ratio));
    }
    if (hi === 6) {
      ndx = dx;
      ndy = -dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio))
        ((ndy = dy), (ndx = -dy * ratio));
    }
    if (hi === 3 || hi === 7) {
      ndy = ndx / ratio;
    }
    if (hi === 1 || hi === 5) {
      ndx = ndy * ratio;
    }
  }
  let x = o.x,
    y = o.y,
    width = o.width,
    height = o.height;
  if (hi === 0) {
    x += ndx;
    y += ndy;
    width -= ndx;
    height -= ndy;
  }
  if (hi === 1) {
    y += ndy;
    height -= ndy;
  }
  if (hi === 2) {
    y += ndy;
    width += ndx;
    height -= ndy;
  }
  if (hi === 3) {
    width += ndx;
  }
  if (hi === 4) {
    width += ndx;
    height += ndy;
  }
  if (hi === 5) {
    height += ndy;
  }
  if (hi === 6) {
    x += ndx;
    width -= ndx;
    height += ndy;
  }
  if (hi === 7) {
    x += ndx;
    width -= ndx;
  }
  return { x, y, width, height };
}

function _resizeRoundShape(origShape, shape, hi, dx, dy, shiftKey) {
  const MIN = 1;
  const o =
    origShape.type === "circle"
      ? {
          x: origShape.cx - origShape.r,
          y: origShape.cy - origShape.r,
          width: origShape.r * 2,
          height: origShape.r * 2,
        }
      : {
          x: origShape.cx - origShape.rx,
          y: origShape.cy - origShape.ry,
          width: origShape.rx * 2,
          height: origShape.ry * 2,
        };
  const ratio = shiftKey ? 1 : o.width / (o.height || 1);
  let { x, y, width, height } = _computeBboxAfterResize(
    o,
    hi,
    dx,
    dy,
    shiftKey,
    ratio,
  );
  width = Math.max(MIN, width);
  height = Math.max(MIN, height);
  if (width === MIN && (hi === 0 || hi === 2 || hi === 6))
    x = o.x + o.width - MIN;
  if (height === MIN && (hi === 0 || hi === 1 || hi === 2))
    y = o.y + o.height - MIN;

  const cx = x + width / 2;
  const cy = y + height / 2;
  if (shiftKey) {
    shape.type = "circle";
    shape.cx = cx;
    shape.cy = cy;
    shape.r = Math.min(width, height) / 2;
    delete shape.rx;
    delete shape.ry;
  } else {
    shape.type = "ellipse";
    shape.cx = cx;
    shape.cy = cy;
    shape.rx = width / 2;
    shape.ry = height / 2;
    delete shape.r;
  }
}

function handleMultiResize(rp, shiftKey) {
  if (!_ds || _ds.action !== "multi-resize") return;
  const { hi, startRP, origShapes, origBB } = _ds;
  const page = getCurrentPage();
  const scale = page.scale;
  const dx = rp.x - startRP.x;
  const dy = rp.y - startRP.y;
  const MIN = 1;

  // Compute new BB from handle drag (same logic as single rect resize)
  let nx = origBB.x,
    ny = origBB.y,
    nw = origBB.w,
    nh = origBB.h;
  if (hi === 0) {
    nx += dx;
    ny += dy;
    nw -= dx;
    nh -= dy;
  } else if (hi === 1) {
    ny += dy;
    nh -= dy;
  } else if (hi === 2) {
    ny += dy;
    nw += dx;
    nh -= dy;
  } else if (hi === 3) {
    nw += dx;
  } else if (hi === 4) {
    nw += dx;
    nh += dy;
  } else if (hi === 5) {
    nh += dy;
  } else if (hi === 6) {
    nx += dx;
    nw -= dx;
    nh += dy;
  } else if (hi === 7) {
    nx += dx;
    nw -= dx;
  }
  nw = Math.max(MIN, nw);
  nh = Math.max(MIN, nh);

  const scaleX = nw / (origBB.w || 1);
  const scaleY = nh / (origBB.h || 1);

  for (const id of getState().selectedShapeIds) {
    const orig = origShapes[id];
    if (!orig) continue;
    let shape = null;
    for (const layer of page.layers) {
      shape = layer.shapes.find((s) => s.id === id);
      if (shape) break;
    }
    if (!shape) continue;

    if (shape.type === "rect" || shape.type === "image") {
      const ox = realToPaper(orig.x, scale),
        oy = realToPaper(orig.y, scale);
      const relX = (ox - origBB.x) / (origBB.w || 1);
      const relY = (oy - origBB.y) / (origBB.h || 1);
      const newPX = nx + relX * nw,
        newPY = ny + relY * nh;
      shape.x = paperToRealDist(newPX, scale);
      shape.y = paperToRealDist(newPY, scale);
      shape.width = Math.max(MIN, orig.width * scaleX);
      shape.height = Math.max(MIN, orig.height * scaleY);
    } else if (shape.type === "circle" || shape.type === "ellipse") {
      const origRx = orig.type === "circle" ? orig.r : orig.rx;
      const origRy = orig.type === "circle" ? orig.r : orig.ry;
      const ocx = realToPaper(orig.cx, scale),
        ocy = realToPaper(orig.cy, scale);
      const relX = (ocx - origBB.x) / (origBB.w || 1);
      const relY = (ocy - origBB.y) / (origBB.h || 1);
      shape.cx = paperToRealDist(nx + relX * nw, scale);
      shape.cy = paperToRealDist(ny + relY * nh, scale);
      if (shiftKey) {
        const s = Math.min(scaleX, scaleY);
        shape.type = "circle";
        shape.r = Math.max(MIN, origRx * s);
        delete shape.rx;
        delete shape.ry;
      } else {
        shape.type = "ellipse";
        shape.rx = Math.max(MIN, origRx * scaleX);
        shape.ry = Math.max(MIN, origRy * scaleY);
        delete shape.r;
      }
    }
  }
  render();
}

function handleRotate(rp, shiftKey) {
  if (!_ds || _ds.action !== "rotate") return;
  const res = findShapeById(_ds.shapeId);
  if (!res) return;
  const { pivot, startAngle, origRotation } = _ds;
  const a = Math.atan2(rp.y - pivot.y, rp.x - pivot.x);
  // デルタを (-180, 180] に正規化して ±180° 境界での値ジャンプを防ぐ
  let delta = ((a - startAngle) * 180) / Math.PI;
  delta = (((delta % 360) + 540) % 360) - 180;
  let deg = origRotation + delta;
  if (shiftKey) deg = Math.round(deg / 15) * 15;
  res.shape.rotation = normalizeRotationDeg(deg);
  liveUpdateShapes([_ds.shapeId]);
  const rotInput = document.getElementById("rot-angle");
  if (rotInput) rotInput.value = `${res.shape.rotation}°`;
}

function handleResize(rp, shiftKey) {
  if (!_ds || _ds.action !== "resize") return;
  const { shapeId, hi, startRP, origShape } = _ds;
  const res = findShapeById(shapeId);
  if (!res) return;
  const shape = res.shape;

  let dx = rp.x - startRP.x,
    dy = rp.y - startRP.y;
  // 回転・反転した図形: ポインタ移動量をローカル座標（回転・反転前）へ逆変換し、
  // 既存のリサイズ計算をローカル座標のまま使う
  const _xf =
    origShape.type !== "dimension" &&
    typeof hasVisualTransform === "function" &&
    hasVisualTransform(origShape);
  if (_xf) {
    const fx = origShape.flipH ? -dx : dx;
    const fy = origShape.flipV ? -dy : dy;
    const rad = (-(origShape.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad),
      sin = Math.sin(rad);
    dx = fx * cos - fy * sin;
    dy = fx * sin + fy * cos;
  }
  const MIN = 1;

  if (shape.type === "line") {
    if (hi === 0) {
      shape.x1 = origShape.x1 + dx;
      shape.y1 = origShape.y1 + dy;
    } else {
      shape.x2 = origShape.x2 + dx;
      shape.y2 = origShape.y2 + dy;
    }
  } else if (shape.type === "rect" || shape.type === "image") {
    const o = origShape;
    let ndx = dx,
      ndy = dy;
    if (shiftKey) {
      const ratio = o.width / (o.height || 1);
      if (hi === 0) {
        ndx = dx;
        ndy = dx / -ratio;
        if (Math.abs(dy) > Math.abs(dx / ratio))
          ((ndy = dy), (ndx = dy * -ratio));
      }
      if (hi === 2) {
        ndx = dx;
        ndy = -dx / ratio;
        if (Math.abs(dy) > Math.abs(dx / ratio))
          ((ndy = dy), (ndx = -dy * ratio));
      }
      if (hi === 4) {
        ndx = dx;
        ndy = dx / ratio;
        if (Math.abs(dy) > Math.abs(dx / ratio))
          ((ndy = dy), (ndx = dy * ratio));
      }
      if (hi === 6) {
        ndx = dx;
        ndy = -dx / ratio;
        if (Math.abs(dy) > Math.abs(dx / ratio))
          ((ndy = dy), (ndx = -dy * ratio));
      }
      if (hi === 3 || hi === 7) {
        ndy = ndx / ratio;
      }
      if (hi === 1 || hi === 5) {
        ndx = dy * ratio;
      }
    }
    if (hi === 0) {
      shape.x = o.x + ndx;
      shape.y = o.y + ndy;
      shape.width = Math.max(MIN, o.width - ndx);
      shape.height = Math.max(MIN, o.height - ndy);
    }
    if (hi === 1) {
      shape.y = o.y + ndy;
      shape.height = Math.max(MIN, o.height - ndy);
    }
    if (hi === 2) {
      shape.y = o.y + ndy;
      shape.width = Math.max(MIN, o.width + ndx);
      shape.height = Math.max(MIN, o.height - ndy);
    }
    if (hi === 3) {
      shape.width = Math.max(MIN, o.width + ndx);
    }
    if (hi === 4) {
      shape.width = Math.max(MIN, o.width + ndx);
      shape.height = Math.max(MIN, o.height + ndy);
    }
    if (hi === 5) {
      shape.height = Math.max(MIN, o.height + ndy);
    }
    if (hi === 6) {
      shape.x = o.x + ndx;
      shape.width = Math.max(MIN, o.width - ndx);
      shape.height = Math.max(MIN, o.height + ndy);
    }
    if (hi === 7) {
      shape.x = o.x + ndx;
      shape.width = Math.max(MIN, o.width - ndx);
    }
    if (shape.width === MIN && (hi === 0 || hi === 2 || hi === 6))
      shape.x = o.x + o.width - MIN;
    if (shape.height === MIN && (hi === 0 || hi === 1 || hi === 2))
      shape.y = o.y + o.height - MIN;
  } else if (shape.type === "circle" || shape.type === "ellipse") {
    _resizeRoundShape(origShape, shape, hi, dx, dy, shiftKey);
  } else if (shape.type === "path") {
    let ox1 = Infinity,
      oy1 = Infinity,
      ox2 = -Infinity,
      oy2 = -Infinity;
    for (const poly of origShape.contours)
      for (const ring of poly)
        for (const [x, y] of ring) {
          if (x < ox1) ox1 = x;
          if (y < oy1) oy1 = y;
          if (x > ox2) ox2 = x;
          if (y > oy2) oy2 = y;
        }
    let nx1 = ox1,
      ny1 = oy1,
      nx2 = ox2,
      ny2 = oy2;
    if (hi === 0) {
      nx1 += dx;
      ny1 += dy;
    }
    if (hi === 1) {
      ny1 += dy;
    }
    if (hi === 2) {
      nx2 += dx;
      ny1 += dy;
    }
    if (hi === 3) {
      nx2 += dx;
    }
    if (hi === 4) {
      nx2 += dx;
      ny2 += dy;
    }
    if (hi === 5) {
      ny2 += dy;
    }
    if (hi === 6) {
      nx1 += dx;
      ny2 += dy;
    }
    if (hi === 7) {
      nx1 += dx;
    }
    if (shiftKey) {
      const ow = ox2 - ox1 || 1,
        oh = oy2 - oy1 || 1;
      const nw = nx2 - nx1,
        nh = ny2 - ny1;
      if (hi === 3 || hi === 7) {
        const w2 = nw;
        nx2 = nx1 + w2;
        ny2 = ny1 + (w2 / ow) * oh;
      } else if (hi === 1 || hi === 5) {
        const h2 = nh;
        ny2 = ny1 + h2;
        nx2 = nx1 + (h2 / oh) * ow;
      } else {
        if (Math.abs(nw / ow) >= Math.abs(nh / oh)) {
          const s = nw / ow;
          ny1 = oy1 + (hi === 0 || hi === 2 ? -(s - 1) * oh : 0);
          ny2 = ny1 + oh * s;
        } else {
          const s = nh / oh;
          nx1 = ox1 + (hi === 0 || hi === 6 ? -(s - 1) * ow : 0);
          nx2 = nx1 + ow * s;
        }
      }
    }
    nx2 = Math.max(nx1 + MIN, nx2);
    ny2 = Math.max(ny1 + MIN, ny2);
    nx1 = Math.min(nx1, nx2 - MIN);
    ny1 = Math.min(ny1, ny2 - MIN);
    const sw = (nx2 - nx1) / (ox2 - ox1 || 1),
      sh = (ny2 - ny1) / (oy2 - oy1 || 1);
    shape.contours = origShape.contours.map((poly) =>
      poly.map((ring) =>
        ring.map(([x, y]) => [nx1 + (x - ox1) * sw, ny1 + (y - oy1) * sh]),
      ),
    );
  } else if (shape.type === "bezier") {
    // Scale every node (and its control handles) by the bbox transform — same
    // model as path, just over nodes[] instead of contours[].
    let ox1 = Infinity,
      oy1 = Infinity,
      ox2 = -Infinity,
      oy2 = -Infinity;
    const acc = (x, y) => {
      if (x < ox1) ox1 = x;
      if (y < oy1) oy1 = y;
      if (x > ox2) ox2 = x;
      if (y > oy2) oy2 = y;
    };
    for (const n of origShape.nodes) {
      if (n.break) continue;
      acc(n.x, n.y);
      if (n.h1) acc(n.h1.x, n.h1.y);
      if (n.h2) acc(n.h2.x, n.h2.y);
    }
    let nx1 = ox1,
      ny1 = oy1,
      nx2 = ox2,
      ny2 = oy2;
    if (hi === 0) ((nx1 += dx), (ny1 += dy));
    if (hi === 1) ny1 += dy;
    if (hi === 2) ((nx2 += dx), (ny1 += dy));
    if (hi === 3) nx2 += dx;
    if (hi === 4) ((nx2 += dx), (ny2 += dy));
    if (hi === 5) ny2 += dy;
    if (hi === 6) ((nx1 += dx), (ny2 += dy));
    if (hi === 7) nx1 += dx;
    if (shiftKey) {
      const ow = ox2 - ox1 || 1,
        oh = oy2 - oy1 || 1;
      const nw = nx2 - nx1,
        nh = ny2 - ny1;
      if (hi === 3 || hi === 7) {
        ny2 = ny1 + (nw / ow) * oh;
      } else if (hi === 1 || hi === 5) {
        nx2 = nx1 + (nh / oh) * ow;
      } else if (Math.abs(nw / ow) >= Math.abs(nh / oh)) {
        const s = nw / ow;
        ny1 = oy1 + (hi === 0 || hi === 2 ? -(s - 1) * oh : 0);
        ny2 = ny1 + oh * s;
      } else {
        const s = nh / oh;
        nx1 = ox1 + (hi === 0 || hi === 6 ? -(s - 1) * ow : 0);
        nx2 = nx1 + ow * s;
      }
    }
    nx2 = Math.max(nx1 + MIN, nx2);
    ny2 = Math.max(ny1 + MIN, ny2);
    nx1 = Math.min(nx1, nx2 - MIN);
    ny1 = Math.min(ny1, ny2 - MIN);
    const sx = (nx2 - nx1) / (ox2 - ox1 || 1),
      sy = (ny2 - ny1) / (oy2 - oy1 || 1);
    const mapPt = (p) =>
      p ? { x: nx1 + (p.x - ox1) * sx, y: ny1 + (p.y - oy1) * sy } : null;
    shape.nodes = origShape.nodes.map((n) =>
      n.break
        ? { ...n }
        : {
            ...n,
            x: nx1 + (n.x - ox1) * sx,
            y: ny1 + (n.y - oy1) * sy,
            h1: mapPt(n.h1),
            h2: mapPt(n.h2),
          },
    );
  } else if (shape.type === "dimension") {
    const o = origShape;
    const isH = shape.dimensionType === "horizontal";
    if (isH) {
      // horizontal: hi=3(右端)→to.x, hi=7(左端)→from.x, hi=1/5(上下)→offset, corners→両端
      if (hi === 3 || hi === 2 || hi === 4) {
        shape.to.x = o.to.x + dx;
      } else if (hi === 7 || hi === 0 || hi === 6) {
        shape.from.x = o.from.x + dx;
      } else if (hi === 1) {
        shape.offset = (o.offset ?? -80) - dy;
      } else if (hi === 5) {
        shape.offset = (o.offset ?? -80) + dy;
      }
    } else {
      // vertical: hi=5(下端)→to.y, hi=1(上端)→from.y, hi=3/7(左右)→offset, corners→両端
      if (hi === 5 || hi === 4 || hi === 6) {
        shape.to.y = o.to.y + dy;
      } else if (hi === 1 || hi === 0 || hi === 2) {
        shape.from.y = o.from.y + dy;
      } else if (hi === 3) {
        shape.offset = (o.offset ?? -80) + dx;
      } else if (hi === 7) {
        shape.offset = (o.offset ?? -80) - dx;
      }
    }
    // 表示値は from/to から自動導出（value 上書きは mm）
    delete shape.value;
  } else if (shape.type === "text") {
    const o = origShape;
    const MIN_FONT = 1;
    const MIN_W = 20;
    const { scale } = getCurrentPage();
    if (hi === 3) {
      // 右端: 幅のみ
      shape.width = Math.max(MIN_W, o.width + dx);
    } else if (hi === 7) {
      // 左端: 幅のみ
      const newW = Math.max(MIN_W, o.width - dx);
      shape.x = o.x + (o.width - newW);
      shape.width = newW;
    } else if (hi === 4) {
      // 右下コーナー: 幅(dx) + フォントサイズ(dy)
      shape.width = Math.max(MIN_W, o.width + dx);
      const deltaFont = (dy * scale.numerator) / scale.denominator;
      shape.fontSize = Math.max(MIN_FONT, (o.fontSize ?? 3.5) + deltaFont);
    } else if (hi === 6) {
      // 左下コーナー: 幅(-dx) + フォントサイズ(dy)
      const newW = Math.max(MIN_W, o.width - dx);
      shape.x = o.x + (o.width - newW);
      shape.width = newW;
      const deltaFont = (dy * scale.numerator) / scale.denominator;
      shape.fontSize = Math.max(MIN_FONT, (o.fontSize ?? 3.5) + deltaFont);
    } else {
      // 上下・残りコーナー: フォントサイズのみ
      const delta =
        hi === 1
          ? -dy
          : hi === 5
            ? dy
            : hi === 0
              ? (-dx - dy) / 2
              : (dx - dy) / 2; // hi===2
      const deltaFont = (delta * scale.numerator) / scale.denominator;
      shape.fontSize = Math.max(MIN_FONT, (o.fontSize ?? 3.5) + deltaFont);
    }
  }

  // 回転・反転中はピボット（bbox中心）がリサイズで動くため、アンカー
  // （ドラッグ反対側）が世界座標で固定されるよう t = M(Δc) − Δc だけ平行移動する
  if (_xf && _ds.origPivot) {
    const c0 = _ds.origPivot;
    const c1 = getShapePivotReal(shape);
    const ddx = c1.x - c0.x,
      ddy = c1.y - c0.y;
    if (ddx || ddy) {
      const rad = ((origShape.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(rad),
        sin = Math.sin(rad);
      let mx = ddx * cos - ddy * sin;
      let my = ddx * sin + ddy * cos;
      if (origShape.flipH) mx = -mx;
      if (origShape.flipV) my = -my;
      shiftShape(shape, mx - ddx, my - ddy);
    }
  }

  liveUpdateShapes([shapeId]);
  _updatePathSizeDisplay(shape);
}

function _updatePathSizeDisplay(shape) {
  if (!shape) return;
  if (shape.type === "path") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const poly of shape.contours)
      for (const ring of poly)
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
    const wEl = document.querySelector('[data-key="path-w"]'),
      hEl = document.querySelector('[data-key="path-h"]');
    // Panel fields are in mm; convert from real units to match the initial render.
    if (wEl) wEl.value = fmtNum(realToMM(maxX - minX));
    if (hEl) hEl.value = fmtNum(realToMM(maxY - minY));
  } else if (shape.type === "rect") {
    const wEl = document.querySelector('[data-key="width"]'),
      hEl = document.querySelector('[data-key="height"]');
    if (wEl) wEl.value = fmtNum(realToMM(shape.width));
    if (hEl) hEl.value = fmtNum(realToMM(shape.height));
  }
}
function handleSelMove(pp, shiftKey) {
  if (!_ds || _ds.action !== "move" || !_selOrig) return;
  const state = getState(),
    page = getCurrentPage(),
    scale = page.scale;
  let dxR = paperToRealDist(pp.x - _ds.startPP.x, scale);
  let dyR = paperToRealDist(pp.y - _ds.startPP.y, scale);
  if (shiftKey) {
    if (Math.abs(dxR) >= Math.abs(dyR)) dyR = 0;
    else dxR = 0;
  }
  // キーポイントスナップ: 選択図形の端点・中心を他図形のスナップ点へ吸着
  const kp = _moveKeypointSnap(dxR, dyR, state, page, scale, shiftKey);
  if (kp) {
    dxR = kp.dxR;
    dyR = kp.dyR;
  }
  // mouseup で複製オフセットとして記録するため保持
  _ds.lastDxR = dxR;
  _ds.lastDyR = dyR;

  // 子が多いグループは毎フレームの座標書き換え＋サブツリー DOM 再生成が重い。
  // 単一グループのドラッグは「既存ノードに translate を被せるだけ」で動かし、
  // 実座標への反映は mouseup で一度だけ行う（liveDragByTransform / fastActive）。
  const fast =
    !_ds.duplicated &&
    typeof liveDragByTransform === "function" &&
    state.selectedShapeIds.length === 1 &&
    findShapeById(state.selectedShapeIds[0])?.shape.type === "group";
  if (fast) {
    const dxP = realToPaperDist(dxR, scale);
    const dyP = realToPaperDist(dyR, scale);
    if (liveDragByTransform(state.selectedShapeIds, dxP, dyP)) {
      _ds.fastActive = true;
      if (kp) renderSnapIndicator(kp.x, kp.y, state.zoom, kp.snapType);
      return;
    }
  }
  _ds.fastActive = false;

  for (const id of state.selectedShapeIds) {
    const orig = _selOrig[id];
    if (!orig) continue;
    const res = findShapeById(id);
    if (!res) continue;
    const shape = res.shape;
    if (shape.type === "line") {
      shape.x1 = orig.x1 + dxR;
      shape.y1 = orig.y1 + dyR;
      shape.x2 = orig.x2 + dxR;
      shape.y2 = orig.y2 + dyR;
    } else if (shape.type === "rect" || shape.type === "image") {
      shape.x = orig.x + dxR;
      shape.y = orig.y + dyR;
    } else if (shape.type === "circle") {
      shape.cx = orig.cx + dxR;
      shape.cy = orig.cy + dyR;
    } else if (shape.type === "ellipse") {
      shape.cx = orig.cx + dxR;
      shape.cy = orig.cy + dyR;
    } else if (shape.type === "text" || shape.type === "rawpath") {
      shape.x = orig.x + dxR;
      shape.y = orig.y + dyR;
      if (shape.type === "rawpath") {
        shape.bx = orig.bx + dxR;
        shape.by = orig.by + dyR;
      }
    } else if (shape.type === "dimension") {
      shape.from = { x: orig.from.x + dxR, y: orig.from.y + dyR };
      shape.to = { x: orig.to.x + dxR, y: orig.to.y + dyR };
      // textOffset is relative to dim line center, so no adjustment needed
    } else if (shape.type === "path") {
      shape.contours = orig.contours.map((poly) =>
        poly.map((ring) => ring.map(([x, y]) => [x + dxR, y + dyR])),
      );
    } else if (shape.type === "bezier") {
      shape.nodes = orig.nodes.map((n) => ({
        x: n.x + dxR,
        y: n.y + dyR,
        h1: n.h1 ? { x: n.h1.x + dxR, y: n.h1.y + dyR } : null,
        h2: n.h2 ? { x: n.h2.x + dxR, y: n.h2.y + dyR } : null,
      }));
    } else if (shape.type === "group") {
      // 毎フレームでサブツリー全体を JSON deep clone してから絶対変位を当てると、
      // 子が多い / path 点列が多いグループでドラッグが急に重くなる。
      // 代わりに前フレームからの「増分」だけシフトする（clone 不要）。
      const prev = (_ds.groupPrev ||= {});
      const p = prev[id] || { x: 0, y: 0 };
      shiftShape(shape, dxR - p.x, dyR - p.y);
      prev[id] = { x: dxR, y: dyR };
    }
  }
  liveUpdateShapes(state.selectedShapeIds);
  // ドラッグ中はオーバーレイが作り直されるため、インジケーターは後から描く
  if (kp) renderSnapIndicator(kp.x, kp.y, state.zoom, kp.snapType);
  if (state.selectedShapeIds.length === 1) {
    const r = findShapeById(state.selectedShapeIds[0]);
    if (r) _updatePathSizeDisplay(r.shape);
  }
}

// 移動ドラッグ中、_selOrig（ドラッグ開始時の図形）のキーポイントを
// dxR/dyR だけ動かした位置で他図形のスナップ点と比較し、吸着すれば
// 補正後の移動量を返す。戻り値: { dxR, dyR, x, y, snapType } | null
// 多頂点 path 等でドラッグ側の点が多すぎる場合は性能優先でスキップ
const _KEYPOINT_SNAP_MAX_POINTS = 400;

function _moveKeypointSnap(dxR, dyR, state, page, scale, shiftKey) {
  if (!state.snapEnabled) return null;
  const ids = state.selectedShapeIds;
  if (!ids.length || !_selOrig) return null;
  const origShapes = [];
  for (const id of ids) {
    if (_selOrig[id]) origShapes.push(_selOrig[id]);
  }
  if (!origShapes.length) return null;
  const pts = collectSnapPoints(origShapes, scale);
  if (!pts.length || pts.length > _KEYPOINT_SNAP_MAX_POINTS) return null;
  const dxP = realToPaperDist(dxR, scale);
  const dyP = realToPaperDist(dyR, scale);
  for (const p of pts) {
    p.x += dxP;
    p.y += dyP;
  }
  const threshold = SNAP_SCREEN_PX / (state.zoom || 1);
  const best = snapDragPoints(pts, getAllShapesOnPage(page), scale, threshold, {
    excludeIds: new Set(ids),
  });
  if (!best) return null;
  let adxR = paperToRealDist(best.dx, scale);
  let adyR = paperToRealDist(best.dy, scale);
  if (shiftKey) {
    // 軸拘束中は拘束されていない軸の補正のみ許可
    if (dyR === 0) adyR = 0;
    else adxR = 0;
    if (adxR === 0 && adyR === 0) return null;
  }
  return {
    dxR: dxR + adxR,
    dyR: dyR + adyR,
    x: best.x,
    y: best.y,
    snapType: best.snapType,
  };
}

function handleVertexDrag(rp) {
  if (!_ds || _ds.action !== "vertex") return;
  const { shapeId, pi, ri, vi, startRP, origContours } = _ds;
  let shape = null;
  for (const layer of getCurrentPage().layers) {
    shape = layer.shapes.find((s) => s.id === shapeId);
    if (shape) break;
  }
  if (!shape) return;
  const dx = rp.x - startRP.x,
    dy = rp.y - startRP.y;
  const [ox, oy] = origContours[pi][ri][vi];
  shape.contours[pi][ri][vi] = [ox + dx, oy + dy];
  render();
  _updatePathSizeDisplay(shape);
}

// ── Text ──────────────────────────────────────────────────────
function _textShapeUpdates(shape, text) {
  if (!text || !/\S/.test(text)) return null;
  const draft = { ...shape, text };
  return { text, width: computeTextRealWidth(draft) };
}

function _textEditStrokeValue(shapeOrStroke) {
  const shape =
    shapeOrStroke && typeof shapeOrStroke === "object" ? shapeOrStroke : null;
  const raw = shape
    ? typeof textShapeInkColor === "function"
      ? textShapeInkColor(shape)
      : shape.stroke || shape.fill || "#1a1a2e"
    : shapeOrStroke || "#1a1a2e";
  if (typeof colorForInput === "function") return colorForInput(raw, "#1a1a2e");
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return "#1a1a2e";
}

function _textEditFontOptions(currentValue) {
  const current = normalizeTextFontFamily(currentValue);
  const fonts =
    typeof getFontFamilyOptions === "function"
      ? getFontFamilyOptions()
      : BUILTIN_FONT_FAMILIES;
  const hasCurrent = fonts.some((f) => f === current);
  let html = fonts
    .map((f) => {
      const sel = f === current ? " selected" : "";
      return `<option value="${f}"${sel}>${f}</option>`;
    })
    .join("");
  if (!hasCurrent && current) {
    html = `<option value="${current}" selected>${current}</option>` + html;
  }
  return html;
}

function _readTextEditModalValues(overlay) {
  const fontSize = parseFloat(
    overlay.querySelector("#text-edit-fontSize")?.value,
  );
  const lineHeight = parseFloat(
    overlay.querySelector("#text-edit-lineHeight")?.value,
  );
  return {
    text: overlay.querySelector("#text-edit-input")?.value ?? "",
    fontSize: Number.isFinite(fontSize) ? Math.max(0.5, fontSize) : 3.5,
    lineHeight: Number.isFinite(lineHeight)
      ? Math.max(0.5, Math.min(4, lineHeight))
      : 1,
    fontFamily:
      overlay.querySelector("#text-edit-fontFamily")?.value ||
      DEFAULT_TEXT_FONT_FAMILY,
    fontWeight:
      overlay.querySelector("#text-edit-fontWeight")?.value || "normal",
    textAlign: overlay.querySelector("#text-edit-textAlign")?.value || "left",
    stroke: overlay.querySelector("#text-edit-stroke")?.value || "#1a1a2e",
  };
}

function _applyTextEditPreview(textarea, values) {
  textarea.style.fontFamily =
    normalizeTextFontFamily(values.fontFamily) || DEFAULT_TEXT_FONT_FAMILY;
  textarea.style.fontWeight = values.fontWeight === "bold" ? "700" : "400";
  textarea.style.textAlign = values.textAlign || "left";
  // サイズ・色は #text-edit-input の CSS 固定（プレビュー用に上書きしない）
  textarea.style.fontSize = "";
  textarea.style.lineHeight = "";
  textarea.style.color = "";
}

function _mergeTextEditResult(shape, result) {
  const merged = { ...shape, ...result };
  const updates = _textShapeUpdates(merged, result.text);
  if (!updates) return null;
  return {
    ...updates,
    fontSize: result.fontSize,
    lineHeight: result.lineHeight,
    fontFamily: normalizeTextFontFamily(result.fontFamily),
    fontWeight: result.fontWeight,
    textAlign: result.textAlign,
    stroke: result.stroke,
    fill: "none",
  };
}

function _resetTextClickState() {
  _textClickState = null;
}

function _isTextShapeDblClick(shape, e) {
  if (!shape?.id || shape.type !== "text") return false;
  const now = Date.now();
  const prev = _textClickState;
  const isDbl =
    prev &&
    prev.id === shape.id &&
    now - prev.time <= 500 &&
    Math.abs(e.clientX - prev.x) <= 15 &&
    Math.abs(e.clientY - prev.y) <= 15;
  _textClickState = { id: shape.id, time: now, x: e.clientX, y: e.clientY };
  return isDbl;
}

function _beginTextShapeEdit(shape) {
  _resetTextClickState();
  _ds = null;
  _selOrig = null;
  editTextShape(shape);
}

function realPointInPaperBBox(rp, bb, scale) {
  const px = realToPaperDist(rp.x, scale);
  const py = realToPaperDist(rp.y, scale);
  return px >= bb.x && px <= bb.x + bb.w && py >= bb.y && py <= bb.y + bb.h;
}

// ── Geometry-aware hit testing ────────────────────────────────
// bbox だけだと「丸の四隅」「中身が空の矩形の内側」「回転図形」「重なり」で
// 誤選択になる。実形状（塗り内 or 輪郭近傍）で当たり判定する。
const _PICK_TOL_PX = 6; // クリック許容（画面 px）

function _pickTolReal(scale) {
  const zoom = getState().zoom || 1;
  return paperToRealDist(_PICK_TOL_PX / zoom, scale);
}

function _distPointToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function _pointInRings(px, py, rings) {
  // even-odd: 複数リング（穴あき path 等）をまとめて判定
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0],
        yi = ring[i][1];
      const xj = ring[j][0],
        yj = ring[j][1];
      if (
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function _nearAnyRing(px, py, rings, tol, closed) {
  for (const ring of rings) {
    const n = ring.length;
    const edges = closed ? n : n - 1;
    for (let i = 0; i < edges; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      if (_distPointToSeg(px, py, a[0], a[1], b[0], b[1]) <= tol) return true;
    }
  }
  return false;
}

function _flattenBezierReal(shape) {
  const nodes = shape.nodes || [];
  if (nodes.length < 2) return nodes.map((n) => [n.x, n.y]);
  const pts = [];
  const STEPS = 12;
  const seg = (p0, p1, p2, p3) => {
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS,
        mt = 1 - t;
      const a = mt * mt * mt,
        b = 3 * mt * mt * t,
        c = 3 * mt * t * t,
        d = t * t * t;
      pts.push([
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      ]);
    }
  };
  const count = shape.closed ? nodes.length : nodes.length - 1;
  for (let i = 0; i < count; i++) {
    const n0 = nodes[i],
      n1 = nodes[(i + 1) % nodes.length];
    const p0 = [n0.x, n0.y];
    const p1 = n0.h2 ? [n0.h2.x, n0.h2.y] : p0;
    const p3 = [n1.x, n1.y];
    const p2 = n1.h1 ? [n1.h1.x, n1.h1.y] : p3;
    seg(p0, p1, p2, p3);
  }
  return pts;
}

function _shapeLocalRings(shape) {
  switch (shape.type) {
    case "line":
      return {
        rings: [
          [
            [shape.x1, shape.y1],
            [shape.x2, shape.y2],
          ],
        ],
        closed: false,
      };
    case "rect":
    case "image":
    case "text": {
      const corners = sampleShapePointsReal(shape);
      return corners.length ? { rings: [corners], closed: true } : null;
    }
    case "circle": {
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (2 * Math.PI * i) / 48;
        pts.push([
          shape.cx + shape.r * Math.cos(a),
          shape.cy + shape.r * Math.sin(a),
        ]);
      }
      return { rings: [pts], closed: true };
    }
    case "ellipse": {
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = (2 * Math.PI * i) / 48;
        pts.push([
          shape.cx + shape.rx * Math.cos(a),
          shape.cy + shape.ry * Math.sin(a),
        ]);
      }
      return { rings: [pts], closed: true };
    }
    case "bezier": {
      const pts = _flattenBezierReal(shape);
      return pts.length ? { rings: [pts], closed: !!shape.closed } : null;
    }
    case "path": {
      const rings = [];
      for (const poly of shape.contours || []) {
        for (const ring of poly) rings.push(ring.map(([x, y]) => [x, y]));
      }
      return rings.length ? { rings, closed: true } : null;
    }
    default:
      return null;
  }
}

function _worldOutlineForShape(shape, ancestorGroups) {
  const local = _shapeLocalRings(shape);
  if (!local) return null;
  const rings = local.rings.map((r) =>
    r.map(([x, y]) => applyWorldTransformReal(x, y, shape, ancestorGroups)),
  );
  return { rings, closed: local.closed };
}

function realPointInShapeGeometry(rp, shape, scale, ancestorGroups = []) {
  if (shape.type === "group") {
    const bb = getShapeBBox(shape, scale, ancestorGroups);
    if (!bb || !realPointInPaperBBox(rp, bb, scale)) return false;
    // グループは1オブジェクトとして扱う: 子図形の隙間や塗りなし図形の
    // 内側をつかんでも選択・移動できるよう bbox にフォールバックする
    return true;
  }
  const outline = _worldOutlineForShape(shape, ancestorGroups);
  if (!outline) {
    const bb = getShapeBBox(shape, scale);
    return Boolean(bb && realPointInPaperBBox(rp, bb, scale));
  }
  const areaType =
    shape.type === "text" ||
    shape.type === "image" ||
    (shape.fill && shape.fill !== "none");
  if (outline.closed && areaType && _pointInRings(rp.x, rp.y, outline.rings))
    return true;
  const tol = _pickTolReal(scale);
  return _nearAnyRing(rp.x, rp.y, outline.rings, tol, outline.closed);
}

function findTopShapeAtRealPoint(rp) {
  const page = getCurrentPage();
  const scale = page.scale;

  for (let li = page.layers.length - 1; li >= 0; li--) {
    const layer = page.layers[li];
    if (!layer.visible || layer.locked) continue;
    for (let si = layer.shapes.length - 1; si >= 0; si--) {
      const s = layer.shapes[si];
      if (s.locked) continue;
      if (realPointInShapeGeometry(rp, s, scale)) return s;
    }
  }

  for (const dim of page.dimensions || []) {
    const bb = getShapeBBox(dim, scale);
    if (bb && realPointInPaperBBox(rp, bb, scale)) return dim;
  }

  return null;
}

function findTextShapeAtRealPoint(rp) {
  const picked = findTopShapeAtRealPoint(rp);
  return picked?.type === "text" ? picked : null;
}

function findTextShapeForEdit(e, rp) {
  const handleEl = e.target.closest?.("[data-handle][data-sid]");
  if (handleEl) {
    const res = findShapeById(handleEl.getAttribute("data-sid"));
    if (res?.shape.type === "text") return res.shape;
  }
  const hit = svgClosest(e.target, "[data-id]");
  if (hit) {
    const res = findShapeById(hit.getAttribute("data-id"));
    if (res?.shape.type === "text") return res.shape;
  }
  return findTextShapeAtRealPoint(rp);
}

function _tryBeginTextShapeDblClick(e, rp) {
  const textShape = findTextShapeForEdit(e, rp);
  if (!textShape || !_isTextShapeDblClick(textShape, e)) return false;
  _beginTextShapeEdit(textShape);
  return true;
}

function editTextShape(shape) {
  if (_textEditorActive || !shape?.id) return;
  getState().selectedShapeIds = [shape.id];
  openTextEditModal(shape, (result) => {
    if (result.cancelled) return;
    const updates = _mergeTextEditResult(shape, result);
    if (!updates) deleteShape(shape.id);
    else updateShape(shape.id, updates);
    render();
    uiUpdate();
  });
}

function handleTextToolDown(e, rp) {
  if (_tryBeginTextShapeDblClick(e, rp)) return;
  const textShape = findTextShapeForEdit(e, rp);
  if (textShape) {
    editTextShape(textShape);
    return;
  }
  _resetTextClickState();
  handleText(rp);
}

function handleTextShapeDblClick(e, svgEl) {
  const tool = getState().activeTool;
  if (!["select", "text"].includes(tool)) return false;

  const sv = screenToSVG(e, svgEl);
  const { pt: pp } = getSnapped(sv.x, sv.y);
  const rp = paperToReal(pp.x, pp.y);

  if (_textEditorActive) return true;
  if (_tryBeginTextShapeDblClick(e, rp)) {
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
  const textShape = findTextShapeForEdit(e, rp);
  if (textShape) {
    _beginTextShapeEdit(textShape);
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
  return false;
}

function handleText(rp) {
  const style = _drawStyle();
  const draft = {
    x: rp.x,
    y: rp.y,
    text: "",
    fontSize: 3.5,
    lineHeight: 1,
    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    fontWeight: "normal",
    textAlign: "left",
    stroke: style.stroke,
  };
  openTextEditModal(draft, (result) => {
    if (result.cancelled) return;
    const updates = _mergeTextEditResult(draft, result);
    if (!updates) return;
    const id = genId("text");
    addShape({
      id,
      type: "text",
      ...draft,
      ...updates,
      strokeWidth: "thin",
      fill: "none",
    });
    const state = getState();
    state.activeTool = "select";
    state.selectedShapeIds = [id];
    updateToolbar();
    render();
    uiUpdate();
  });
}

let _textEditorActive = false;
let _textEditModalEl = null;

function openTextEditModal(shape, onCommit) {
  if (_textEditorActive) return;
  _textEditorActive = true;

  const isNew = !shape.id;
  const fs = shape.fontSize ?? 3.5;
  const lh = textShapeLineHeight(shape);
  const strokeVal = _textEditStrokeValue(shape);

  const overlay = document.createElement("div");
  overlay.id = "text-edit-overlay";
  overlay.innerHTML =
    '<div id="text-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="text-edit-title">' +
    `<h2 id="text-edit-title">${isNew ? t("textEdit.addTitle") : t("textEdit.editTitle")}</h2>` +
    '<div class="text-edit-toolbar">' +
    `<div class="text-edit-row"><label for="text-edit-fontSize">${t("textEdit.size")}</label>` +
    `<input type="number" id="text-edit-fontSize" min="0.5" step="0.5" value="${fs}"></div>` +
    `<div class="text-edit-row"><label for="text-edit-lineHeight">${t("textEdit.lineHeight")}</label>` +
    `<input type="number" id="text-edit-lineHeight" min="0.5" max="4" step="0.05" value="${lh}"></div>` +
    `<div class="text-edit-row"><label for="text-edit-stroke">${t("textEdit.color")}</label>` +
    `<input type="color" id="text-edit-stroke" value="${strokeVal}"></div>` +
    `<div class="text-edit-row text-edit-row-wide"><label for="text-edit-fontFamily">${t("textEdit.font")}</label>` +
    `<select id="text-edit-fontFamily" class="font-family-select">${_textEditFontOptions(shape.fontFamily)}</select></div>` +
    `<div class="text-edit-row"><label for="text-edit-fontWeight">${t("textEdit.weight")}</label>` +
    `<select id="text-edit-fontWeight">` +
    `<option value="normal"${(shape.fontWeight || "normal") === "normal" ? " selected" : ""}>Regular</option>` +
    `<option value="bold"${shape.fontWeight === "bold" ? " selected" : ""}>Bold</option>` +
    "</select></div>" +
    `<div class="text-edit-row"><label for="text-edit-textAlign">${t("textEdit.align")}</label>` +
    `<select id="text-edit-textAlign">` +
    `<option value="left"${(shape.textAlign || "left") === "left" ? " selected" : ""}>${t("textEdit.align.left")}</option>` +
    `<option value="center"${shape.textAlign === "center" ? " selected" : ""}>${t("textEdit.align.center")}</option>` +
    `<option value="right"${shape.textAlign === "right" ? " selected" : ""}>${t("textEdit.align.right")}</option>` +
    "</select></div>" +
    "</div>" +
    '<textarea id="text-edit-input" spellcheck="false" rows="5"></textarea>' +
    '<div class="text-edit-actions">' +
    `<button type="button" id="text-edit-cancel">${t("textEdit.cancel")}</button>` +
    `<button type="button" id="text-edit-ok" class="text-edit-ok">${t("textEdit.ok")}</button>` +
    "</div></div>";
  document.body.appendChild(overlay);
  _textEditModalEl = overlay;

  const textarea = overlay.querySelector("#text-edit-input");
  const btnOk = overlay.querySelector("#text-edit-ok");
  const btnCancel = overlay.querySelector("#text-edit-cancel");
  const previewInputs = overlay.querySelectorAll(
    "#text-edit-fontFamily, #text-edit-fontWeight, #text-edit-textAlign",
  );

  textarea.value = shape.text || "";
  _applyTextEditPreview(textarea, {
    fontFamily: shape.fontFamily,
    fontWeight: shape.fontWeight,
    textAlign: shape.textAlign,
  });

  function syncPreview() {
    _applyTextEditPreview(textarea, _readTextEditModalValues(overlay));
  }

  previewInputs.forEach((el) => {
    el.addEventListener("input", syncPreview);
    el.addEventListener("change", syncPreview);
  });

  let closed = false;
  function close(commit) {
    if (closed) return;
    closed = true;
    _textEditorActive = false;
    document.removeEventListener("keydown", onModalKeyDown, true);
    overlay.remove();
    _textEditModalEl = null;
    if (commit) onCommit(_readTextEditModalValues(overlay));
    else onCommit({ cancelled: true });
  }

  function onModalKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(false);
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    e.stopPropagation();
  }

  btnOk.addEventListener("click", () => close(true));
  btnCancel.addEventListener("click", () => close(false));
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close(false);
  });
  document.addEventListener("keydown", onModalKeyDown, true);

  requestAnimationFrame(() => {
    if (closed) return;
    textarea.focus();
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
  });
}

// ── Dimension (3-click) ───────────────────────────────────────
function handleDimDown(pp, rp) {
  if (!_dimState) {
    _dimState = { step: 1, fr: rp, fp: pp };
  } else if (_dimState.step === 1) {
    const dx = Math.abs(rp.x - _dimState.fr.x),
      dy = Math.abs(rp.y - _dimState.fr.y);
    _dimState.step = 2;
    _dimState.to = rp;
    _dimState.isH = dx >= dy;
  } else if (_dimState.step === 2) {
    const ds = _dimState;
    const offset = ds.isH ? rp.y - ds.fr.y : rp.x - ds.fr.x;
    addShape({
      id: genId("dim"),
      type: "dimension",
      dimensionType: ds.isH ? "horizontal" : "vertical",
      from: { ...ds.fr },
      to: { ...ds.to },
      offset,
      stroke: "#1a1a2e",
      strokeWidth: "thin",
    });
    cancelDim();
    getState().activeTool = "select";
    render();
    uiUpdate();
  }
}

function applyAngleSnap(sr, er) {
  const dx = er.x - sr.x,
    dy = er.y - sr.y;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 12; // 15° increments
  const snapped = Math.round(angle / step) * step;
  return {
    x: sr.x + len * Math.cos(snapped),
    y: sr.y + len * Math.sin(snapped),
  };
}

function buildPreview(tool, sr, er, shiftKey) {
  if (tool === "line") {
    const ep = shiftKey ? applyAngleSnap(sr, er) : er;
    return {
      id: "__p__",
      type: "line",
      x1: sr.x,
      y1: sr.y,
      x2: ep.x,
      y2: ep.y,
      strokeWidth: "medium",
    };
  }
  if (tool === "rect") {
    let w = Math.abs(er.x - sr.x),
      h = Math.abs(er.y - sr.y);
    if (shiftKey) {
      const s = Math.max(w, h);
      w = s;
      h = s;
    }
    return {
      id: "__p__",
      type: "rect",
      x: Math.min(sr.x, sr.x + (er.x - sr.x > 0 ? w : -w)),
      y: Math.min(sr.y, sr.y + (er.y - sr.y > 0 ? h : -h)),
      width: w,
      height: h,
      strokeWidth: "medium",
    };
  }
  if (tool === "circle") {
    if (shiftKey) {
      return {
        id: "__p__",
        type: "circle",
        cx: sr.x,
        cy: sr.y,
        r: Math.hypot(er.x - sr.x, er.y - sr.y),
        strokeWidth: "medium",
      };
    }
    const rx = Math.abs(er.x - sr.x) / 2;
    const ry = Math.abs(er.y - sr.y) / 2;
    return {
      id: "__p__",
      type: "ellipse",
      cx: (sr.x + er.x) / 2,
      cy: (sr.y + er.y) / 2,
      rx,
      ry,
      strokeWidth: "medium",
    };
  }
  return null;
}
function commitShape(tool, sr, er, shiftKey) {
  const MIN = 0.5;
  const style = _drawStyle();
  let newId = null;
  if (tool === "line") {
    const ep = shiftKey ? applyAngleSnap(sr, er) : er;
    if (Math.hypot(ep.x - sr.x, ep.y - sr.y) < MIN) return;
    newId = genId("line");
    addShape({
      id: newId,
      type: "line",
      x1: sr.x,
      y1: sr.y,
      x2: ep.x,
      y2: ep.y,
      stroke: style.stroke,
      strokeWidth: "medium",
      strokeLinecap: "butt",
    });
  } else if (tool === "rect") {
    let w = Math.abs(er.x - sr.x),
      h = Math.abs(er.y - sr.y);
    if (shiftKey) {
      const sq = Math.max(w, h);
      w = sq;
      h = sq;
    }
    if (w < MIN || h < MIN) return;
    const rx = er.x >= sr.x ? sr.x : sr.x - w;
    const ry = er.y >= sr.y ? sr.y : sr.y - h;
    newId = genId("rect");
    addShape({
      id: newId,
      type: "rect",
      x: rx,
      y: ry,
      width: w,
      height: h,
      stroke: style.stroke,
      fill: style.fill,
      strokeWidth: "medium",
    });
  } else if (tool === "circle") {
    if (shiftKey) {
      const r = Math.hypot(er.x - sr.x, er.y - sr.y);
      if (r < MIN) return;
      newId = genId("circle");
      addShape({
        id: newId,
        type: "circle",
        cx: sr.x,
        cy: sr.y,
        r,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: "medium",
      });
    } else {
      const rx = Math.abs(er.x - sr.x) / 2;
      const ry = Math.abs(er.y - sr.y) / 2;
      if (rx < MIN || ry < MIN) return;
      newId = genId("ellipse");
      addShape({
        id: newId,
        type: "ellipse",
        cx: (sr.x + er.x) / 2,
        cy: (sr.y + er.y) / 2,
        rx,
        ry,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: "medium",
      });
    }
  }
  if (newId) {
    const state = getState();
    state.activeTool = "select";
    state.selectedShapeIds = [newId];
    updateToolbar();
  }
  render();
  uiUpdate();
}
// ── Size Popover (double-click to place shape by dimensions) ──
function showSizePopover(tool, rp, clientX, clientY) {
  const existing = document.getElementById("mr-size-popover");
  if (existing) existing.remove();

  const pop = document.createElement("div");
  pop.id = "mr-size-popover";
  pop.style.cssText = `
    position: fixed; z-index: 9999;
    background: #fff; border: 1px solid #ccc; border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
    padding: 16px; min-width: 220px;
    font-family: "Gen Interface JP", system-ui, sans-serif; font-size: 13px; color: #222;
  `;

  let fields = "";
  const titleKey = {
    rect: "sizePopover.title.rect",
    circle: "sizePopover.title.circle",
    line: "sizePopover.title.line",
  }[tool];

  if (tool === "rect") {
    fields = `
      <label style="display:block;margin-bottom:8px">
        ${t("sizePopover.width")}<br>
        <input id="mr-sp-w" type="number" value="100" min="0.1" step="0.1"
          style="width:100%;box-sizing:border-box;padding:4px 6px;margin-top:3px;border:1px solid #bbb;border-radius:4px;outline:none;transition:border-color 0.15s"
          onfocus="this.style.borderColor='#4a6cf7'" onblur="this.style.borderColor='#bbb'">
      </label>
      <label style="display:block;margin-bottom:12px">
        ${t("sizePopover.height")}<br>
        <input id="mr-sp-h" type="number" value="60" min="0.1" step="0.1"
          style="width:100%;box-sizing:border-box;padding:4px 6px;margin-top:3px;border:1px solid #bbb;border-radius:4px;outline:none;transition:border-color 0.15s"
          onfocus="this.style.borderColor='#4a6cf7'" onblur="this.style.borderColor='#bbb'">
      </label>`;
  } else if (tool === "circle") {
    fields = `
      <label style="display:block;margin-bottom:12px">
        ${t("sizePopover.radius")}<br>
        <input id="mr-sp-r" type="number" value="50" min="0.1" step="0.1"
          style="width:100%;box-sizing:border-box;padding:4px 6px;margin-top:3px;border:1px solid #bbb;border-radius:4px;outline:none;transition:border-color 0.15s"
          onfocus="this.style.borderColor='#4a6cf7'" onblur="this.style.borderColor='#bbb'">
      </label>`;
  } else if (tool === "line") {
    fields = `
      <label style="display:block;margin-bottom:8px">
        ${t("sizePopover.length")}<br>
        <input id="mr-sp-len" type="number" value="100" min="0.1" step="0.1"
          style="width:100%;box-sizing:border-box;padding:4px 6px;margin-top:3px;border:1px solid #bbb;border-radius:4px;outline:none;transition:border-color 0.15s"
          onfocus="this.style.borderColor='#4a6cf7'" onblur="this.style.borderColor='#bbb'">
      </label>
      <label style="display:block;margin-bottom:12px">
        ${t("sizePopover.angle")}<br>
        <input id="mr-sp-ang" type="number" value="0" step="1"
          style="width:100%;box-sizing:border-box;padding:4px 6px;margin-top:3px;border:1px solid #bbb;border-radius:4px;outline:none;transition:border-color 0.15s"
          onfocus="this.style.borderColor='#4a6cf7'" onblur="this.style.borderColor='#bbb'">
      </label>`;
  } else {
    return;
  }

  pop.innerHTML = `
    <div style="font-weight:600;margin-bottom:12px;color:#444">${t(titleKey)}</div>
    ${fields}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="mr-sp-cancel"
        style="padding:5px 14px;border:1px solid #bbb;border-radius:4px;background:#f5f5f5;cursor:pointer">
        ${t("sizePopover.cancel")}
      </button>
      <button id="mr-sp-ok"
        style="padding:5px 14px;border:none;border-radius:4px;background:#4a6cf7;color:#fff;cursor:pointer;font-weight:600">
        ${t("sizePopover.create")}
      </button>
    </div>`;

  // Position near click, keeping inside viewport
  document.body.appendChild(pop);
  const pw = pop.offsetWidth,
    ph = pop.offsetHeight;
  const vw = window.innerWidth,
    vh = window.innerHeight;
  pop.style.left = Math.min(clientX + 12, vw - pw - 8) + "px";
  pop.style.top = Math.min(clientY + 12, vh - ph - 8) + "px";

  const firstInput = pop.querySelector("input");
  if (firstInput) {
    firstInput.focus();
    firstInput.select();
  }

  function dismiss() {
    pop.remove();
    document.removeEventListener("mousedown", outsideClick);
  }
  function outsideClick(ev) {
    if (!pop.contains(ev.target)) dismiss();
  }
  setTimeout(() => document.addEventListener("mousedown", outsideClick), 0);

  document.getElementById("mr-sp-cancel").addEventListener("click", dismiss);

  function commit() {
    const MM = 10; // 1mm = 10 real units
    const style = _drawStyle();
    let newId = null;

    if (tool === "rect") {
      const w = parseFloat(document.getElementById("mr-sp-w").value) * MM;
      const h = parseFloat(document.getElementById("mr-sp-h").value) * MM;
      if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return;
      newId = genId("rect");
      addShape({
        id: newId,
        type: "rect",
        x: rp.x,
        y: rp.y,
        width: w,
        height: h,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: "medium",
      });
    } else if (tool === "circle") {
      const r = parseFloat(document.getElementById("mr-sp-r").value) * MM;
      if (!isFinite(r) || r <= 0) return;
      newId = genId("circle");
      addShape({
        id: newId,
        type: "circle",
        cx: rp.x + r,
        cy: rp.y + r,
        r,
        stroke: style.stroke,
        fill: style.fill,
        strokeWidth: "medium",
      });
    } else if (tool === "line") {
      const len = parseFloat(document.getElementById("mr-sp-len").value) * MM;
      const ang =
        (parseFloat(document.getElementById("mr-sp-ang").value) * Math.PI) /
        180;
      if (!isFinite(len) || len <= 0) return;
      newId = genId("line");
      addShape({
        id: newId,
        type: "line",
        x1: rp.x,
        y1: rp.y,
        x2: rp.x + len * Math.cos(ang),
        y2: rp.y + len * Math.sin(ang),
        stroke: style.stroke,
        strokeWidth: "medium",
        strokeLinecap: "butt",
      });
    }

    if (newId) {
      const state = getState();
      state.activeTool = "select";
      state.selectedShapeIds = [newId];
      updateToolbar();
      pushHistory();
      render();
      uiUpdate();
    }
    dismiss();
  }

  document.getElementById("mr-sp-ok").addEventListener("click", commit);
  pop.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") commit();
    if (ev.key === "Escape") dismiss();
  });
}

function beginAltDuplicate() {
  const state = getState();
  if (!_ds || _ds.action !== "move" || _ds.duplicated) return;
  _beginDuplicate([...state.selectedShapeIds]);
}

function _beginDuplicate(origIds) {
  // ライブドラッグ（transform のみ）から複製へ移る場合、元ノードに被せた
  // translate を素に戻してから複製する（以降は従来パスで座標を動かす）。
  if (typeof clearLiveDragTransforms === "function") clearLiveDragTransforms();
  if (_ds) _ds.fastActive = false;
  const page = getCurrentPage();
  // Restore originals to pre-drag positions (in _selOrig) before cloning
  for (const id of origIds) {
    const orig = _selOrig[id];
    if (!orig) continue;
    const res = findShapeById(id);
    if (res) Object.assign(res.shape, structuredClone(orig));
  }
  const newIds = cloneSelectedShapes(0, 0);
  if (!newIds.length) return;
  // Add clone entries to _selOrig using original pre-drag positions
  // Do NOT clear existing origId entries — they stay as the reliable baseline
  for (let i = 0; i < origIds.length; i++) {
    if (_selOrig[origIds[i]]) {
      _selOrig[newIds[i]] = structuredClone(_selOrig[origIds[i]]);
    }
  }
  getState().selectedShapeIds = newIds;
  _ds.origIds = origIds;
  _ds.duplicated = true;
  if (_lastPP) handleSelMove(_lastPP);
  else render();
}

function cancelAltDuplicate() {
  const state = getState();
  if (!_ds || _ds.action !== "move" || !_ds.duplicated) return;
  const page = getCurrentPage();
  const cloneIds = [...state.selectedShapeIds];
  const origIds = _ds.origIds || [];
  // Remove clones from layer (or dimensions if dimension type)
  for (const id of cloneIds) {
    let removed = false;
    for (const layer of page.layers) {
      const idx = layer.shapes.findIndex((s) => s.id === id);
      if (idx !== -1) {
        layer.shapes.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      const dims = page.dimensions || [];
      const idx = dims.findIndex((d) => d.id === id);
      if (idx !== -1) dims.splice(idx, 1);
    }
  }
  // Remove clone entries from _selOrig — orig entries remain untouched
  for (const id of cloneIds) delete _selOrig[id];
  state.selectedShapeIds = origIds;
  _ds.duplicated = false;
  delete _ds.origIds;
  if (_lastPP) handleSelMove(_lastPP);
  else render();
}

function updateStatusCoords(rp) {
  const el = document.getElementById("status-coords");
  if (el)
    el.textContent = `x: ${fmtNum(realToMM(rp.x))}  y: ${fmtNum(realToMM(rp.y))} mm`;
}
function uiUpdate() {
  window.dispatchEvent(new CustomEvent("millrect:uiupdate"));
}

// ── Context menu (Figma-style) ───────────────────────────────
let _contextMenuEl = null;

function dismissContextMenu() {
  if (!_contextMenuEl) return false;
  _contextMenuEl.remove();
  _contextMenuEl = null;
  document.removeEventListener("mousedown", _contextMenuOutside, true);
  document.removeEventListener("keydown", _contextMenuKey, true);
  document.removeEventListener("scroll", dismissContextMenu, true);
  return true;
}

function _contextMenuOutside(e) {
  if (_contextMenuEl?.contains(e.target)) return;
  dismissContextMenu();
}

function _contextMenuKey(e) {
  if (e.key === "Escape") dismissContextMenu();
}

function _ctxMod() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl";
}

function _ctxLocked(ids) {
  return ids.some((id) => {
    const r = findShapeById(id);
    return r && !r.isDimension && r.layer?.locked;
  });
}

function _ctxHasDim(ids) {
  return ids.some((id) => findShapeById(id)?.isDimension);
}

function _ctxRun(action) {
  dismissContextMenu();
  action();
  render();
  uiUpdate();
}

function enterVertexEditMode(sid) {
  const r = findShapeById(sid);
  if (!r) return;
  const sh = r.shape;
  if (sh.type === "rect") {
    const { x, y, width: w, height: h } = sh;
    let ring;
    if (sh.rxMode === "individual") {
      const tl = sh.rxTL ?? 0,
        tr = sh.rxTR ?? 0,
        br = sh.rxBR ?? 0,
        bl = sh.rxBL ?? 0;
      ring =
        tl || tr || br || bl
          ? roundedRectToRing(x, y, w, h, tl, tr, br, bl)
          : [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ];
    } else if (sh.rx) {
      ring = roundedRectToRing(x, y, w, h, sh.rx, sh.rx, sh.rx, sh.rx);
    } else {
      ring = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
    }
    const newShape = {
      id: sh.id,
      type: "path",
      contours: [[ring]],
      stroke: sh.stroke,
      fill: sh.fill,
      strokeWidth: sh.strokeWidth,
      strokeStyle: sh.strokeStyle,
    };
    r.layer.shapes.splice(r.layer.shapes.indexOf(sh), 1, newShape);
    pushHistory();
  }
  if (sh.type === "rect" || sh.type === "path") {
    _vertexEditId = sid;
    render();
    uiUpdate();
  }
}

function _buildCanvasContextItems() {
  const mod = _ctxMod();
  return [
    {
      label: t("context.paste"),
      shortcut: `${mod}V`,
      disabled: !hasClipboard() || getCurrentLayer().locked,
      action: () => pasteShapes(),
    },
    { type: "sep" },
    {
      label: t("context.selectAll"),
      shortcut: `${mod}A`,
      action: () => {
        const page = getCurrentPage();
        getState().selectedShapeIds = [
          ...getAllShapesOnPage(page)
            .filter((s) => !s.locked)
            .map((s) => s.id),
          ...getAllDimensionsOnPage(page).map((d) => d.id),
        ];
      },
    },
  ];
}

function _buildShapeContextItems(ids) {
  const mod = _ctxMod();
  const locked = _ctxLocked(ids);
  const hasDim = _ctxHasDim(ids);
  const layerShapes = !hasDim;
  const single = ids.length === 1 ? findShapeById(ids[0]) : null;
  const shape = single?.shape;
  const isGroup = shape?.type === "group";

  const items = [
    {
      label: t("context.copy"),
      shortcut: `${mod}C`,
      disabled: locked,
      action: () => copyShapes(),
    },
    {
      label: t("context.cut"),
      shortcut: `${mod}X`,
      disabled: locked,
      action: () => cutShapes(),
    },
    {
      label: t("context.paste"),
      shortcut: `${mod}V`,
      disabled: !hasClipboard() || getCurrentLayer().locked,
      action: () => pasteShapes(),
    },
    {
      label: t("context.duplicate"),
      shortcut: `${mod}D`,
      disabled: locked,
      action: () => duplicateShapes(),
    },
    { type: "sep" },
    {
      label: t("context.delete"),
      shortcut: "⌫",
      danger: true,
      disabled: locked,
      action: () => deleteSelectedShapes(),
    },
  ];

  if (layerShapes) {
    items.push(
      { type: "sep" },
      {
        label: t("context.zOrder"),
        submenu: [
          {
            label: t("context.zOrder.front"),
            disabled: locked,
            action: () => reorderSelectionZ(ids, "front"),
          },
          {
            label: t("context.zOrder.forward"),
            disabled: locked,
            action: () => reorderSelectionZ(ids, "up"),
          },
          {
            label: t("context.zOrder.backward"),
            disabled: locked,
            action: () => reorderSelectionZ(ids, "down"),
          },
          {
            label: t("context.zOrder.back"),
            disabled: locked,
            action: () => reorderSelectionZ(ids, "back"),
          },
        ],
      },
    );
  }

  items.push({
    label: t("context.align"),
    disabled: ids.length < 2 || locked,
    submenu: [
      { label: t("context.align.left"), action: () => alignShapes("left") },
      {
        label: t("context.align.centerH"),
        action: () => alignShapes("centerH"),
      },
      { label: t("context.align.right"), action: () => alignShapes("right") },
      { type: "sep" },
      { label: t("context.align.top"), action: () => alignShapes("top") },
      {
        label: t("context.align.centerV"),
        action: () => alignShapes("centerV"),
      },
      { label: t("context.align.bottom"), action: () => alignShapes("bottom") },
      { type: "sep" },
      {
        label: t("context.distribute.h"),
        disabled: ids.length < 3,
        action: () => distributeShapes("h"),
      },
      {
        label: t("context.distribute.v"),
        disabled: ids.length < 3,
        action: () => distributeShapes("v"),
      },
    ],
  });

  if (ids.length >= 2 && !hasDim && !locked) {
    items.push({
      label: t("context.group"),
      shortcut: `${mod}G`,
      action: () => groupSelectedShapes(),
    });
  }
  if (isGroup && !locked) {
    items.push({
      label: t("context.ungroup"),
      shortcut: `${mod}⇧G`,
      action: () => ungroupSelectedShapes(),
    });
  }

  if (ids.length === 1 && shape && !locked) {
    items.push({ type: "sep" });
    if (shape.type === "text") {
      items.push(
        {
          label: t("context.editText"),
          action: () => {
            dismissContextMenu();
            editTextShape(shape);
          },
        },
        {
          label: t("context.outlineText"),
          disabled: !isTextOutlineAvailable(),
          action: () => {
            void outlineTextShape(shape.id);
          },
        },
      );
    } else if (shape.type === "bezier") {
      items.push({
        label: t("context.editPath"),
        action: () => {
          _bezierEditId = shape.id;
        },
      });
    } else if (shape.type === "rect" || shape.type === "path") {
      items.push({
        label: t("context.editPath"),
        action: () => enterVertexEditMode(shape.id),
      });
    } else if (shape.type === "dimension") {
      items.push(
        {
          label: t("context.dimResetValue"),
          action: () => {
            delete shape.value;
            pushHistory();
          },
        },
        {
          label: t("context.dimResetLabel"),
          action: () => {
            delete shape.textOffsetX;
            delete shape.textOffsetY;
            delete shape.textRotation;
            pushHistory();
          },
        },
      );
    }
    if (
      shape.type !== "text" &&
      shape.type !== "dimension" &&
      shape.type !== "line"
    ) {
      items.push(
        {
          label: t("context.flipH"),
          action: () => flipShapes("h"),
        },
        {
          label: t("context.flipV"),
          action: () => flipShapes("v"),
        },
      );
    }
  }

  if (layerShapes && !locked) {
    items.push(
      { type: "sep" },
      {
        label: t("context.boolean"),
        submenu: [
          {
            label: t("context.boolean.union"),
            shortcut: "⌥⇧U",
            disabled: ids.length < 2,
            action: () => mergeSelectedShapes(),
          },
          {
            label: t("context.boolean.subtract"),
            shortcut: "⌥⇧S",
            disabled: ids.length < 2,
            action: () => subtractSelectedShapes(),
          },
          {
            label: t("context.boolean.intersect"),
            shortcut: "⌥⇧I",
            disabled: ids.length < 2,
            action: () => intersectSelectedShapes(),
          },
          {
            label: t("context.boolean.exclude"),
            shortcut: "⌥⇧E",
            disabled: ids.length < 2,
            action: () => excludeSelectedShapes(),
          },
          {
            label: t("context.boolean.flatten"),
            shortcut: "⌥⇧F",
            action: () => flattenSelectedShapes(),
          },
        ],
      },
    );
  }

  return items;
}

function _renderContextMenuItems(container, items, run) {
  for (const item of items) {
    if (item.type === "sep") {
      const sep = document.createElement("div");
      sep.className = "ctx-sep";
      container.appendChild(sep);
      continue;
    }
    if (item.submenu) {
      const row = document.createElement("div");
      row.className = "ctx-item ctx-has-submenu";
      if (item.disabled) row.classList.add("ctx-disabled");
      row.innerHTML = `<span class="ctx-label">${item.label}</span><span class="ctx-chevron">›</span>`;
      const sub = document.createElement("div");
      sub.className = "ctx-menu ctx-submenu";
      _renderContextMenuItems(sub, item.submenu, run);
      row.appendChild(sub);
      if (!item.disabled) {
        row.addEventListener("mouseenter", () => {
          sub.hidden = false;
          const rect = sub.getBoundingClientRect();
          if (rect.right > window.innerWidth - 8)
            sub.classList.add("ctx-submenu-left");
          else sub.classList.remove("ctx-submenu-left");
          if (rect.bottom > window.innerHeight - 8) {
            sub.style.top = `${Math.max(8, window.innerHeight - rect.height - 8) - row.getBoundingClientRect().top}px`;
          } else {
            sub.style.top = "";
          }
        });
        row.addEventListener("mouseleave", (e) => {
          if (sub.contains(e.relatedTarget)) return;
          sub.hidden = true;
        });
        sub.addEventListener("mouseleave", (e) => {
          if (row.contains(e.relatedTarget)) return;
          sub.hidden = true;
        });
      }
      container.appendChild(row);
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item" + (item.danger ? " ctx-danger" : "");
    if (item.disabled) {
      btn.classList.add("ctx-disabled");
      btn.disabled = true;
    }
    btn.innerHTML = `<span class="ctx-label">${item.label}</span>${
      item.shortcut ? `<kbd class="ctx-shortcut">${item.shortcut}</kbd>` : ""
    }`;
    if (!item.disabled && item.action) {
      btn.addEventListener("click", () => run(item.action));
    }
    container.appendChild(btn);
  }
}

function showContextMenu(clientX, clientY, items) {
  dismissContextMenu();
  const menu = document.createElement("div");
  menu.id = "ctx-menu";
  menu.className = "ctx-menu";
  _renderContextMenuItems(menu, items, (action) => _ctxRun(action));
  document.body.appendChild(menu);
  _contextMenuEl = menu;

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  menu.style.left = Math.min(clientX, vw - mw - 8) + "px";
  menu.style.top = Math.min(clientY, vh - mh - 8) + "px";

  menu.querySelectorAll(".ctx-submenu").forEach((sub) => {
    sub.hidden = true;
  });

  setTimeout(() => {
    document.addEventListener("mousedown", _contextMenuOutside, true);
    document.addEventListener("keydown", _contextMenuKey, true);
    document.addEventListener("scroll", dismissContextMenu, true);
  }, 0);
}

function handleCanvasContextMenu(e, svgEl) {
  e.preventDefault();
  dismissContextMenu();

  const state = getState();
  const dimLabelEl = e.target.closest?.("[data-dim-label]");
  const hitEl = dimLabelEl || svgClosest(e.target, "[data-id]");
  const hitId = hitEl
    ? dimLabelEl
      ? dimLabelEl.getAttribute("data-dim-label")
      : resolveToTopLevelId(hitEl.getAttribute("data-id"))
    : null;

  if (hitId) {
    if (e.shiftKey) {
      const idx = state.selectedShapeIds.indexOf(hitId);
      if (idx === -1) state.selectedShapeIds.push(hitId);
      else state.selectedShapeIds.splice(idx, 1);
    } else if (!state.selectedShapeIds.includes(hitId)) {
      state.selectedShapeIds = [hitId];
    }
    render();
    uiUpdate();
  }

  const ids = [...state.selectedShapeIds];
  const items = ids.length
    ? _buildShapeContextItems(ids)
    : _buildCanvasContextItems();
  showContextMenu(e.clientX, e.clientY, items);
}
