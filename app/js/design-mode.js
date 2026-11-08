"use strict";

// ── Design Mode ─────────────────────────────────────────────
// Illustrator 風の操作感を持つ「別 UI」。描画・編集エンジンは 2D モードと完全に共有する:
//   - ドキュメントは同じ _state.pages（Undo/Redo・autosave・エクスポートもそのまま）
//   - 描画は同じ render()、ヒットテストは同じ findTopShapeAtRealPoint()
//   - 作図は同じ activeTool（select / bezier / rect …）を setActiveTool() で切り替えるだけ
//   - 色・線幅・整列・パスファインダー・重ね順は既存コマンド（alignShapes /
//     runBooleanShortcut / reorderSelectionZ …）を呼ぶ
// このファイルが持つのは「ツールボックス」「コントロールバー」「塗り/線ウィジェット」
// と、Illustrator 固有の小さなサブツール（ダイレクト選択・スポイト・ズーム）の
// 入力の振り分けだけ。独自の描画エンジンや図形モデルは持たない。
(function () {
  // id: Design Mode 上のツール名 / engine: 共有エンジンの activeTool
  const TOOLS = [
    { id: "select", engine: "select", key: "v", icon: "mouse-pointer-2" },
    { id: "direct", engine: "select", key: "a", icon: "mouse-pointer", label: "DIRECT" },
    { sep: true },
    { id: "pen", engine: "bezier", key: "p", icon: "pen-tool" },
    { id: "pencil", engine: "pencil", key: "n", icon: "pencil" },
    { id: "line", engine: "line", key: "\\", keyLabel: "\\", icon: "slash" },
    { id: "rect", engine: "rect", key: "m", icon: "square" },
    { id: "ellipse", engine: "circle", key: "l", icon: "circle" },
    { id: "text", engine: "text", key: "t", icon: "type" },
    { sep: true },
    { id: "eyedropper", engine: "select", key: "i", icon: "pipette", label: "EYEDROPPER" },
    { id: "hand", engine: "hand", key: "h", icon: "hand" },
    { id: "zoom", engine: "hand", key: "z", icon: "zoom-in", label: "ZOOM" },
  ];
  const TOOL_BY_ID = Object.fromEntries(
    TOOLS.filter((t) => !t.sep).map((t) => [t.id, t]),
  );
  const TOOL_BY_KEY = Object.fromEntries(
    TOOLS.filter((t) => !t.sep).map((t) => [t.key, t]),
  );
  // 2D モードのツールショートカット（ui.js bindKeyShortcuts）。Design Mode では
  // 寸法・計測などの CAD ツールに化けないよう、ここで握りつぶす。
  const CAD_TOOL_KEYS = new Set(["v", "l", "r", "c", "t", "d", "h", "p", "b", "m"]);

  // Illustrator の「初期設定の塗りと線」(D)
  const DEFAULT_PAINT = { fill: "#ffffff", stroke: "#000000" };
  const ZOOM_STEP = 1.5;
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 50;

  let designTool = "select";
  let paintFocus = "fill"; // ツールボックスで前面にある方（X で切替）
  let savedShowViewGuides = null;
  let built = false;
  let livePaintPending = false;

  const tr = (key, params) => (typeof t === "function" ? t(key, params) : key);

  function isActive() {
    return document.getElementById("app")?.classList.contains("mode-design");
  }

  // ── 選択・塗りの読み取り ────────────────────────────────
  function selectedEntries({ editableOnly = false } = {}) {
    const state = getState();
    const out = [];
    for (const id of state.selectedShapeIds) {
      const res = findShapeById(id);
      if (!res || res.isDimension) continue;
      if (editableOnly && (res.layer?.locked || res.shape.locked)) continue;
      out.push(res);
    }
    return out;
  }

  function supportsFill(type) {
    return typeof shapeSupportsFill === "function"
      ? shapeSupportsFill(type)
      : ["rect", "circle", "ellipse", "path", "bezier"].includes(type);
  }

  function strokeOf(shape) {
    if (shape.type === "text" && typeof textShapeInkColor === "function") {
      return textShapeInkColor(shape);
    }
    return shape.stroke || "#1a1a2e";
  }

  function strokeWidthMm(v) {
    return typeof resolveStrokeWidthMm === "function"
      ? resolveStrokeWidthMm(v)
      : Number(v) || 0.5;
  }

  const MIXED = "__mixed__";
  function pick(values) {
    const uniq = [...new Set(values)];
    if (!uniq.length) return null;
    return uniq.length === 1 ? uniq[0] : MIXED;
  }

  // 現在の塗り/線。選択があればその図形の値、無ければ新規作図の既定値。
  function currentPaint() {
    const state = getState();
    const entries = selectedEntries();
    if (!entries.length) {
      return {
        hasSelection: false,
        fill: state.drawFill ?? "none",
        stroke: state.drawStroke || "#1a1a2e",
        strokeWidth:
          typeof state.drawStrokeWidth === "number"
            ? state.drawStrokeWidth
            : strokeWidthMm("medium"),
        opacity: null,
      };
    }
    const shapes = entries.map((r) => r.shape);
    const fillable = shapes.filter((s) => supportsFill(s.type));
    return {
      hasSelection: true,
      fill: fillable.length ? pick(fillable.map((s) => s.fill || "none")) : null,
      stroke: pick(shapes.map(strokeOf)),
      strokeWidth: pick(
        shapes
          .filter((s) => s.type !== "image")
          .map((s) => strokeWidthMm(s.strokeWidth)),
      ),
      opacity: pick(shapes.map((s) => (s.opacity == null ? 1 : Number(s.opacity)))),
    };
  }

  // ── 塗りの適用（既存の図形データにそのまま書く）────────────
  function applyPaint(updates, { commit = true } = {}) {
    const state = getState();
    const entries = selectedEntries({ editableOnly: true });
    if (!state.selectedShapeIds.length) {
      if (updates.fill !== undefined) state.drawFill = updates.fill;
      if (updates.stroke !== undefined) state.drawStroke = updates.stroke;
      if (updates.strokeWidth !== undefined) {
        state.drawStrokeWidth = updates.strokeWidth;
      }
      refresh();
      return;
    }
    let changed = false;
    for (const res of entries) {
      const s = res.shape;
      if (updates.fill !== undefined && supportsFill(s.type)) {
        s.fill = updates.fill;
        changed = true;
      }
      if (updates.stroke !== undefined && s.type !== "image") {
        if (s.type === "text") {
          if (updates.stroke === "none") continue; // 文字色なしは作らない
          s.stroke = updates.stroke;
          s.fill = "none";
        } else {
          s.stroke = updates.stroke;
        }
        changed = true;
      }
      if (updates.strokeWidth !== undefined && s.type !== "image") {
        s.strokeWidth = updates.strokeWidth;
        changed = true;
      }
      if (updates.opacity !== undefined) {
        if (updates.opacity >= 1) delete s.opacity;
        else s.opacity = updates.opacity;
        changed = true;
      }
      if (typeof markShapeDirty === "function") markShapeDirty(s.id);
    }
    if (!changed) return;
    // 選択に適用した色は次に描く図形の既定にもなる（Illustrator と同じ）
    if (updates.fill !== undefined && updates.fill !== MIXED) {
      state.drawFill = updates.fill;
    }
    if (updates.stroke !== undefined) state.drawStroke = updates.stroke;
    if (updates.strokeWidth !== undefined) {
      state.drawStrokeWidth = updates.strokeWidth;
    }
    if (commit) {
      livePaintPending = false;
      pushHistory();
    } else {
      livePaintPending = true;
    }
    render();
    if (typeof uiUpdate === "function") uiUpdate();
    refresh();
  }

  function swapFillStroke() {
    const state = getState();
    if (!state.selectedShapeIds.length) {
      const f = state.drawFill ?? "none";
      state.drawFill = state.drawStroke || "none";
      state.drawStroke = f;
      refresh();
      return;
    }
    let changed = false;
    for (const res of selectedEntries({ editableOnly: true })) {
      const s = res.shape;
      if (!supportsFill(s.type)) continue;
      const f = s.fill || "none";
      s.fill = s.stroke || "none";
      s.stroke = f;
      if (typeof markShapeDirty === "function") markShapeDirty(s.id);
      changed = true;
    }
    if (!changed) return;
    pushHistory();
    render();
    if (typeof uiUpdate === "function") uiUpdate();
    refresh();
  }

  function resetDefaultPaint() {
    applyPaint({ fill: DEFAULT_PAINT.fill, stroke: DEFAULT_PAINT.stroke });
  }

  function setFocusNone() {
    applyPaint({ [paintFocus]: "none" });
  }

  function setPaintFocus(which) {
    paintFocus = which === "stroke" ? "stroke" : "fill";
    refresh();
  }

  // ── ツール切替 ──────────────────────────────────────────
  function selectDesignTool(id) {
    const tool = TOOL_BY_ID[id];
    if (!tool) return;
    designTool = id;
    if (id !== "direct") leaveEditModes();
    if (typeof setActiveTool === "function") {
      setActiveTool(tool.engine, { label: tool.label });
    } else {
      getState().activeTool = tool.engine;
    }
    refresh();
  }

  // 2D 側のコード（図形確定後のツール戻し等）で activeTool が変わったら追従する
  function onEngineToolChange(e) {
    const engineTool = e.detail?.tool;
    const cur = TOOL_BY_ID[designTool];
    if (cur && cur.engine === engineTool) {
      refresh();
      return;
    }
    const match = TOOLS.find((t) => !t.sep && t.engine === engineTool);
    designTool = match ? match.id : null;
    refresh();
  }

  function leaveEditModes() {
    let changed = false;
    if (typeof _bezierEditId !== "undefined" && _bezierEditId) {
      exitBezierEditMode();
      changed = true;
    }
    if (typeof _vertexEditId !== "undefined" && _vertexEditId) {
      _vertexEditId = null;
      changed = true;
    }
    if (changed) render();
    return changed;
  }

  // ── キャンバス入力（サブツール）──────────────────────────
  function realPointFromEvent(e, svgEl) {
    const sv = screenToSVG(e, svgEl);
    const pp = svgToPaper(sv.x, sv.y);
    return paperToReal(pp.x, pp.y);
  }

  function consume(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function zoomAtClient(clientX, clientY, factor) {
    const state = getState();
    const svgEl = document.getElementById("main-svg");
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.zoom * factor));
    state.panX = mx - (mx - state.panX) * (nz / state.zoom);
    state.panY = my - (my - state.panY) * (nz / state.zoom);
    state.zoom = nz;
    render();
    const el = document.getElementById("status-zoom");
    if (el) el.textContent = `${(nz * 100).toFixed(0)}%`;
  }

  function zoomAtCenter(factor) {
    const svgEl = document.getElementById("main-svg");
    if (!svgEl) return;
    const r = svgEl.getBoundingClientRect();
    zoomAtClient(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  // スポイト: クリックした図形の塗り・線・線幅・不透明度を選択（無ければ既定値）へ写す
  function sampleAt(rp) {
    const picked =
      typeof findTopShapeAtRealPoint === "function"
        ? findTopShapeAtRealPoint(rp)
        : null;
    const src = picked ? findShapeById(picked.id)?.shape : null;
    if (!src || src.type === "image") return;
    const state = getState();
    const selection = state.selectedShapeIds.filter((id) => id !== src.id);
    const updates = {
      stroke: strokeOf(src),
      strokeWidth: strokeWidthMm(src.strokeWidth),
    };
    if (supportsFill(src.type)) updates.fill = src.fill || "none";
    if (!selection.length) {
      if (updates.fill !== undefined) state.drawFill = updates.fill;
      state.drawStroke = updates.stroke;
      state.drawStrokeWidth = updates.strokeWidth;
      refresh();
      return;
    }
    const prev = state.selectedShapeIds;
    state.selectedShapeIds = selection;
    applyPaint({ ...updates, opacity: src.opacity == null ? 1 : Number(src.opacity) });
    state.selectedShapeIds = prev;
  }

  // ダイレクト選択: クリックした図形を、そのままアンカー編集状態にする。
  // アンカー/ハンドル自体のドラッグは既存の編集オーバーレイ（path-editor /
  // interaction の vertex 編集）に素通しする。
  function directSelectDown(e, svgEl) {
    if (
      e.target.closest?.("[data-vertex]") ||
      e.target.closest?.("[data-bezier-anchor]") ||
      e.target.closest?.("[data-bezier-handle]") ||
      e.target.closest?.("[data-handle]") ||
      e.target.closest?.("[data-rotate-handle]")
    ) {
      return;
    }
    const rp = realPointFromEvent(e, svgEl);
    const picked =
      typeof findTopShapeAtRealPoint === "function"
        ? findTopShapeAtRealPoint(rp)
        : null;
    const res = picked ? findShapeById(picked.id) : null;
    const shape = res?.shape;
    const editingId =
      (typeof _bezierEditId !== "undefined" && _bezierEditId) ||
      (typeof _vertexEditId !== "undefined" && _vertexEditId) ||
      null;
    if (!shape) {
      // 空クリック: 編集を抜けて通常のマーキー選択へ
      leaveEditModes();
      return;
    }
    if (shape.id === editingId) return;
    if (res.layer?.locked || shape.locked) return;
    const state = getState();
    if (shape.type === "bezier") {
      consume(e);
      leaveEditModes();
      state.selectedShapeIds = [shape.id];
      _bezierEditId = shape.id;
      render();
      if (typeof uiUpdate === "function") uiUpdate();
      return;
    }
    if (shape.type === "path" || shape.type === "rect") {
      consume(e);
      leaveEditModes();
      state.selectedShapeIds = [shape.id];
      enterVertexEditMode(shape.id);
      return;
    }
    // 円・直線・テキスト等はアンカー編集を持たないので通常選択に任せる
    leaveEditModes();
  }

  function onCanvasMouseDown(e) {
    if (!isActive() || e.button !== 0) return;
    const svgEl = e.currentTarget;
    if (designTool === "zoom") {
      consume(e);
      zoomAtClient(e.clientX, e.clientY, e.altKey ? 1 / ZOOM_STEP : ZOOM_STEP);
      return;
    }
    if (designTool === "eyedropper") {
      consume(e);
      sampleAt(realPointFromEvent(e, svgEl));
      return;
    }
    if (designTool === "direct") directSelectDown(e, svgEl);
  }

  // ── キーボード（Illustrator 互換）─────────────────────────
  function isTypingTarget(e) {
    const el = e.target;
    return (
      el?.tagName === "INPUT" ||
      el?.tagName === "TEXTAREA" ||
      el?.tagName === "SELECT" ||
      el?.isContentEditable ||
      (typeof _textEditorActive !== "undefined" && _textEditorActive)
    );
  }

  function arrange(mode) {
    const ids = getState().selectedShapeIds.slice();
    if (!ids.length || typeof reorderSelectionZ !== "function") return;
    if (reorderSelectionZ(ids, mode)) {
      render();
      if (typeof uiUpdate === "function") uiUpdate();
    }
  }

  function onKeyDown(e) {
    if (!isActive() || e.isComposing || isTypingTarget(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.code === "BracketRight" || e.code === "BracketLeft")) {
      consume(e);
      const up = e.code === "BracketRight";
      arrange(e.shiftKey ? (up ? "front" : "back") : up ? "up" : "down");
      return;
    }
    if (mod && !e.altKey && (e.key === "=" || e.key === "+" || e.key === ";")) {
      consume(e);
      zoomAtCenter(ZOOM_STEP);
      return;
    }
    if (mod && !e.altKey && e.key === "-") {
      consume(e);
      zoomAtCenter(1 / ZOOM_STEP);
      return;
    }
    if (mod && !e.altKey && e.key === "0") {
      consume(e);
      if (typeof fitPage === "function") fitPage();
      render();
      if (typeof updateAll === "function") updateAll();
      return;
    }
    if (mod || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "x") {
      consume(e);
      if (e.shiftKey) swapFillStroke();
      else setPaintFocus(paintFocus === "fill" ? "stroke" : "fill");
      return;
    }
    if (e.shiftKey) {
      // Shift+D（R 寸法）など CAD 側の Shift ショートカットも Design では無効
      if (key === "d") consume(e);
      return;
    }
    if (key === "d") {
      consume(e);
      resetDefaultPaint();
      return;
    }
    if (key === "/") {
      consume(e);
      setFocusNone();
      return;
    }
    const tool = TOOL_BY_KEY[key];
    if (tool) {
      consume(e);
      selectDesignTool(tool.id);
      return;
    }
    if (CAD_TOOL_KEYS.has(key)) consume(e);
  }

  // ── DOM ────────────────────────────────────────────────
  function toolTitle(tool) {
    const k = (tool.keyLabel || tool.key).toUpperCase();
    return `${tr(`design.tool.${tool.id}`)} (${k})`;
  }

  function icon(name) {
    return `<i data-lucide="${name}"></i>`;
  }

  function buildToolbox() {
    const el = document.createElement("div");
    el.id = "design-toolbox";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-orientation", "vertical");
    el.innerHTML =
      TOOLS.map((tool) =>
        tool.sep
          ? `<div class="dtb-sep" aria-hidden="true"></div>`
          : `<button type="button" class="design-tool-btn" data-design-tool="${tool.id}" aria-pressed="false">${icon(tool.icon)}</button>`,
      ).join("") +
      `<div class="dtb-sep" aria-hidden="true"></div>
      <div class="dtb-paint" data-focus="fill">
        <button type="button" class="dtb-paint-swatch dtb-paint-fill" data-paint-square="fill"></button>
        <button type="button" class="dtb-paint-swatch dtb-paint-stroke" data-paint-square="stroke"><span class="dtb-paint-stroke-hole"></span></button>
        <button type="button" class="dtb-paint-mini dtb-paint-swap" data-paint-action="swap">${icon("arrow-left-right")}</button>
        <button type="button" class="dtb-paint-mini dtb-paint-default" data-paint-action="default"><span></span><span></span></button>
      </div>
      <div class="dtb-paint-modes">
        <button type="button" class="dtb-paint-mode" data-paint-action="color"><span class="dtb-mode-color"></span></button>
        <button type="button" class="dtb-paint-mode" data-paint-action="none"><span class="dtb-mode-none"></span></button>
      </div>`;
    return el;
  }

  function alignBtn(dir, iconName) {
    return `<button type="button" class="dcb-icon-btn" data-dcb-align="${dir}">${icon(iconName)}</button>`;
  }

  function buildControlBar() {
    const el = document.createElement("div");
    el.id = "design-control-bar";
    el.innerHTML = `
      <span class="dcb-kind" data-dcb="kind"></span>
      <div class="dcb-group">
        <span class="dcb-label" data-i18n="design.fill">塗り</span>
        <button type="button" class="dcb-swatch" data-dcb-paint="fill"></button>
      </div>
      <div class="dcb-group">
        <span class="dcb-label" data-i18n="design.stroke">線</span>
        <button type="button" class="dcb-swatch dcb-swatch-stroke" data-dcb-paint="stroke"></button>
        <input type="number" class="dcb-num" data-dcb-field="strokeWidth" min="0" step="0.1">
        <span class="dcb-unit">mm</span>
      </div>
      <div class="dcb-group" data-dcb-section="opacity">
        <span class="dcb-label" data-i18n="design.opacity">不透明度</span>
        <input type="number" class="dcb-num" data-dcb-field="opacity" min="0" max="100" step="5">
        <span class="dcb-unit">%</span>
      </div>
      <div class="dcb-group" data-dcb-section="xform">
        <span class="dcb-label">X</span><input type="number" class="dcb-num dcb-num-wide" data-dcb-field="x" step="0.1">
        <span class="dcb-label">Y</span><input type="number" class="dcb-num dcb-num-wide" data-dcb-field="y" step="0.1">
        <span class="dcb-label">W</span><span class="dcb-ro" data-dcb="w"></span>
        <span class="dcb-label">H</span><span class="dcb-ro" data-dcb="h"></span>
        <span class="dcb-unit">mm</span>
      </div>
      <div class="dcb-group" data-dcb-section="align">
        ${alignBtn("left", "align-start-vertical")}
        ${alignBtn("centerH", "align-center-vertical")}
        ${alignBtn("right", "align-end-vertical")}
        ${alignBtn("top", "align-start-horizontal")}
        ${alignBtn("centerV", "align-center-horizontal")}
        ${alignBtn("bottom", "align-end-horizontal")}
        <span data-dcb-section="distribute" class="dcb-subgroup">
          <button type="button" class="dcb-icon-btn" data-dcb-distribute="h">${icon("align-horizontal-distribute-center")}</button>
          <button type="button" class="dcb-icon-btn" data-dcb-distribute="v">${icon("align-vertical-distribute-center")}</button>
        </span>
      </div>
      <div class="dcb-group" data-dcb-section="pathfinder">
        <button type="button" class="dcb-icon-btn" data-dcb-boolean="KeyU">${icon("squares-unite")}</button>
        <button type="button" class="dcb-icon-btn" data-dcb-boolean="KeyS">${icon("squares-subtract")}</button>
        <button type="button" class="dcb-icon-btn" data-dcb-boolean="KeyI">${icon("squares-intersect")}</button>
        <button type="button" class="dcb-icon-btn" data-dcb-boolean="KeyE">${icon("squares-exclude")}</button>
      </div>
      <div class="dcb-group" data-dcb-section="arrange">
        <button type="button" class="dcb-icon-btn" data-dcb-arrange="front">${icon("bring-to-front")}</button>
        <button type="button" class="dcb-icon-btn" data-dcb-arrange="back">${icon("send-to-back")}</button>
      </div>`;
    return el;
  }

  function buildSwatchPopover() {
    const el = document.createElement("div");
    el.id = "design-swatch-popover";
    el.hidden = true;
    const presets =
      typeof FILL_PRESETS !== "undefined" ? FILL_PRESETS : ["#000000"];
    const colors = ["none", "#ffffff", "#000000", ...presets.filter((c) => c !== "#1a1a2e"), "#1a1a2e"];
    el.innerHTML = `
      <div class="dsp-title" data-dsp="title"></div>
      <div class="dsp-grid">${colors
        .map(
          (c) =>
            `<button type="button" class="dsp-swatch${c === "none" ? " is-none" : ""}" data-dsp-color="${c}" title="${c === "none" ? "" : c}" style="${c === "none" ? "" : `background:${c}`}"></button>`,
        )
        .join("")}</div>
      <button type="button" class="dsp-more" data-dsp-more="1" data-i18n="design.moreColors">その他の色…</button>
      <input type="color" class="dsp-native" tabindex="-1" aria-hidden="true">`;
    return el;
  }

  function applyTitles() {
    for (const btn of document.querySelectorAll("[data-design-tool]")) {
      const tool = TOOL_BY_ID[btn.dataset.designTool];
      if (tool) btn.title = toolTitle(tool);
    }
    const set = (sel, key) => {
      const el = document.querySelector(sel);
      if (el) el.title = tr(key);
    };
    set('[data-paint-square="fill"]', "design.paint.fill");
    set('[data-paint-square="stroke"]', "design.paint.stroke");
    set('[data-paint-action="swap"]', "design.paint.swap");
    set('[data-paint-action="default"]', "design.paint.default");
    set('[data-paint-action="color"]', "design.paint.color");
    set('[data-paint-action="none"]', "design.paint.none");
    set('[data-dcb-paint="fill"]', "design.paint.fill");
    set('[data-dcb-paint="stroke"]', "design.paint.stroke");
    set('[data-dcb-field="strokeWidth"]', "design.strokeWidth");
    for (const dir of ["left", "centerH", "right", "top", "centerV", "bottom"]) {
      set(`[data-dcb-align="${dir}"]`, `design.align.${dir}`);
    }
    set('[data-dcb-distribute="h"]', "design.distribute.h");
    set('[data-dcb-distribute="v"]', "design.distribute.v");
    set('[data-dcb-boolean="KeyU"]', "design.pathfinder.unite");
    set('[data-dcb-boolean="KeyS"]', "design.pathfinder.minusFront");
    set('[data-dcb-boolean="KeyI"]', "design.pathfinder.intersect");
    set('[data-dcb-boolean="KeyE"]', "design.pathfinder.exclude");
    set('[data-dcb-arrange="front"]', "design.arrange.front");
    set('[data-dcb-arrange="back"]', "design.arrange.back");
    const root = document.getElementById("design-control-bar");
    if (root && typeof applyI18nToRoot === "function") applyI18nToRoot(root);
    const pop = document.getElementById("design-swatch-popover");
    if (pop && typeof applyI18nToRoot === "function") applyI18nToRoot(pop);
  }

  // ── スウォッチ（色の選択ポップオーバー）─────────────────────
  let popoverTarget = null;

  function openSwatchPopover(target, anchor) {
    const pop = document.getElementById("design-swatch-popover");
    if (!pop || !anchor) return;
    popoverTarget = target;
    const title = pop.querySelector('[data-dsp="title"]');
    if (title) {
      title.textContent = tr(target === "fill" ? "design.fill" : "design.stroke");
    }
    const paint = currentPaint();
    const cur = paint[target];
    for (const sw of pop.querySelectorAll("[data-dsp-color]")) {
      sw.classList.toggle(
        "selected",
        typeof cur === "string" &&
          sw.dataset.dspColor.toLowerCase() === cur.toLowerCase(),
      );
    }
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = r.left;
    let top = r.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    // ツールボックス（左端）から開いた時は右側へ出す
    if (anchor.closest("#design-toolbox")) {
      left = r.right + 8;
      top = Math.min(r.top, window.innerHeight - ph - 8);
    }
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${Math.max(8, top)}px`;
  }

  function closeSwatchPopover() {
    const pop = document.getElementById("design-swatch-popover");
    if (pop) pop.hidden = true;
    popoverTarget = null;
  }

  function openNativePicker(target) {
    const pop = document.getElementById("design-swatch-popover");
    const input = pop?.querySelector(".dsp-native");
    if (!input) return;
    const cur = currentPaint()[target];
    input.value = /^#[0-9a-f]{6}$/i.test(cur || "") ? cur : "#000000";
    input.dataset.target = target;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (err) {
      input.click();
    }
  }

  // ── 表示更新 ────────────────────────────────────────────
  function paintCss(color) {
    if (color === MIXED) return { cls: "is-mixed", bg: "" };
    if (!color || color === "none") return { cls: "is-none", bg: "" };
    return { cls: "", bg: color };
  }

  function paintSquare(el, color, kind) {
    if (!el) return;
    const { cls, bg } = paintCss(color);
    el.classList.toggle("is-none", cls === "is-none");
    el.classList.toggle("is-mixed", cls === "is-mixed");
    el.classList.toggle("is-na", color === null);
    if (kind === "stroke") el.style.borderColor = bg || "";
    else el.style.background = bg || "";
  }

  function fmt(n, digits = 2) {
    if (typeof fmtNum === "function") return fmtNum(n);
    return String(Math.round(n * 10 ** digits) / 10 ** digits);
  }

  function setField(root, field, value) {
    const inp = root.querySelector(`[data-dcb-field="${field}"]`);
    if (!inp || document.activeElement === inp) return;
    if (value === MIXED) {
      inp.value = "";
      inp.placeholder = tr("props.mixed");
    } else {
      inp.placeholder = "";
      inp.value = value == null ? "" : value;
    }
  }

  function selectionBBoxMM(entries) {
    const scale = getCurrentPage().scale;
    let box = null;
    for (const res of entries) {
      const bb = shapeBBoxMM(res.shape, scale);
      if (!bb) continue;
      if (!box) box = { x0: bb.x, y0: bb.y, x1: bb.x + bb.w, y1: bb.y + bb.h };
      else {
        box.x0 = Math.min(box.x0, bb.x);
        box.y0 = Math.min(box.y0, bb.y);
        box.x1 = Math.max(box.x1, bb.x + bb.w);
        box.y1 = Math.max(box.y1, bb.y + bb.h);
      }
    }
    return box && { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
  }

  function selectionKindLabel(entries, total) {
    if (!total) return tr("design.kind.none");
    if (total > 1) return tr("design.kind.multi", { count: total });
    const type = entries[0]?.shape?.type;
    if (!type) return tr("design.kind.dimension");
    const key = `design.kind.${type}`;
    const label = tr(key);
    return label === key ? type : label;
  }

  function refresh() {
    if (!built) return;
    const state = getState();
    // ツールボックス
    for (const btn of document.querySelectorAll("[data-design-tool]")) {
      const on = btn.dataset.designTool === designTool;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const svg = document.getElementById("main-svg");
    if (svg) {
      for (const id of ["zoom", "eyedropper", "direct"]) {
        svg.classList.toggle(`design-tool-${id}`, isActive() && designTool === id);
      }
    }
    const paint = currentPaint();
    const box = document.querySelector("#design-toolbox .dtb-paint");
    if (box) {
      box.dataset.focus = paintFocus;
      paintSquare(box.querySelector(".dtb-paint-fill"), paint.fill, "fill");
      paintSquare(box.querySelector(".dtb-paint-stroke"), paint.stroke, "stroke");
    }
    // コントロールバー
    const bar = document.getElementById("design-control-bar");
    if (!bar) return;
    const entries = selectedEntries();
    const total = state.selectedShapeIds.length;
    const kind = bar.querySelector('[data-dcb="kind"]');
    if (kind) kind.textContent = selectionKindLabel(entries, total);
    paintSquare(bar.querySelector('[data-dcb-paint="fill"]'), paint.fill, "fill");
    paintSquare(bar.querySelector('[data-dcb-paint="stroke"]'), paint.stroke, "stroke");
    setField(
      bar,
      "strokeWidth",
      paint.strokeWidth === MIXED || paint.strokeWidth == null
        ? paint.strokeWidth
        : fmt(paint.strokeWidth),
    );
    setField(
      bar,
      "opacity",
      paint.opacity === MIXED || paint.opacity == null
        ? paint.opacity
        : Math.round(paint.opacity * 100),
    );
    const show = (name, on) => {
      const el = bar.querySelector(`[data-dcb-section="${name}"]`);
      if (el) el.hidden = !on;
    };
    const bb = total ? selectionBBoxMM(entries) : null;
    show("opacity", entries.length > 0);
    show("xform", !!bb);
    show("align", total > 0);
    show("distribute", total >= 3);
    show("pathfinder", entries.length >= 2);
    show("arrange", entries.length > 0);
    if (bb) {
      setField(bar, "x", fmt(bb.x));
      setField(bar, "y", fmt(bb.y));
      const w = bar.querySelector('[data-dcb="w"]');
      const h = bar.querySelector('[data-dcb="h"]');
      if (w) w.textContent = fmt(bb.w);
      if (h) h.textContent = fmt(bb.h);
    }
  }

  // ── イベント配線 ────────────────────────────────────────
  function moveSelectionTo(axis, targetMm) {
    const entries = selectedEntries({ editableOnly: true });
    const bb = selectionBBoxMM(entries);
    if (!bb || !Number.isFinite(targetMm)) return;
    const q =
      typeof quantizeMmForUnitMode === "function"
        ? quantizeMmForUnitMode(targetMm)
        : targetMm;
    const delta = mmToReal(q - (axis === "x" ? bb.x : bb.y));
    if (!delta) return;
    for (const res of entries) {
      if (axis === "x") shiftShape(res.shape, delta, 0);
      else shiftShape(res.shape, 0, delta);
    }
    pushHistory();
    render();
    if (typeof uiUpdate === "function") uiUpdate();
    refresh();
  }

  function wireToolbox(box) {
    box.addEventListener("click", (e) => {
      const toolBtn = e.target.closest("[data-design-tool]");
      if (toolBtn) {
        selectDesignTool(toolBtn.dataset.designTool);
        return;
      }
      const square = e.target.closest("[data-paint-square]");
      if (square) {
        const which = square.dataset.paintSquare;
        if (paintFocus === which) openSwatchPopover(which, square);
        else setPaintFocus(which);
        return;
      }
      const action = e.target.closest("[data-paint-action]")?.dataset.paintAction;
      if (action === "swap") swapFillStroke();
      else if (action === "default") resetDefaultPaint();
      else if (action === "none") setFocusNone();
      else if (action === "color") {
        const square = box.querySelector(`[data-paint-square="${paintFocus}"]`);
        openSwatchPopover(paintFocus, square);
      }
    });
    box.addEventListener("dblclick", (e) => {
      const square = e.target.closest("[data-paint-square]");
      if (!square) return;
      closeSwatchPopover();
      setPaintFocus(square.dataset.paintSquare);
      openNativePicker(square.dataset.paintSquare);
    });
  }

  function wireControlBar(bar) {
    bar.addEventListener("click", (e) => {
      const paintBtn = e.target.closest("[data-dcb-paint]");
      if (paintBtn) {
        setPaintFocus(paintBtn.dataset.dcbPaint);
        openSwatchPopover(paintBtn.dataset.dcbPaint, paintBtn);
        return;
      }
      const alignDir = e.target.closest("[data-dcb-align]")?.dataset.dcbAlign;
      if (alignDir) {
        if (alignShapes(alignDir)) {
          render();
          if (typeof uiUpdate === "function") uiUpdate();
        }
        return;
      }
      const dist = e.target.closest("[data-dcb-distribute]")?.dataset.dcbDistribute;
      if (dist) {
        if (distributeShapes(dist)) {
          render();
          if (typeof uiUpdate === "function") uiUpdate();
        }
        return;
      }
      const boolCode = e.target.closest("[data-dcb-boolean]")?.dataset.dcbBoolean;
      if (boolCode) {
        if (typeof runBooleanShortcut === "function") runBooleanShortcut(boolCode);
        return;
      }
      const arr = e.target.closest("[data-dcb-arrange]")?.dataset.dcbArrange;
      if (arr) arrange(arr);
    });
    for (const inp of bar.querySelectorAll("[data-dcb-field]")) {
      // キャンバスのショートカット（Delete / 矢印 / ツールキー）に入力が食われないように
      inp.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") inp.blur();
        if (e.key === "Escape") {
          inp.blur();
          refresh();
        }
      });
      inp.addEventListener("change", () => {
        const v = parseFloat(inp.value);
        if (!Number.isFinite(v)) {
          refresh();
          return;
        }
        const field = inp.dataset.dcbField;
        if (field === "strokeWidth") applyPaint({ strokeWidth: Math.max(0, v) });
        else if (field === "opacity") {
          applyPaint({ opacity: Math.min(100, Math.max(0, v)) / 100 });
        } else if (field === "x" || field === "y") moveSelectionTo(field, v);
      });
    }
  }

  function wirePopover(pop) {
    pop.addEventListener("click", (e) => {
      const sw = e.target.closest("[data-dsp-color]");
      if (sw && popoverTarget) {
        applyPaint({ [popoverTarget]: sw.dataset.dspColor });
        closeSwatchPopover();
        return;
      }
      if (e.target.closest("[data-dsp-more]") && popoverTarget) {
        const target = popoverTarget;
        openNativePicker(target);
      }
    });
    const native = pop.querySelector(".dsp-native");
    native?.addEventListener("input", () => {
      const target = native.dataset.target;
      if (target) applyPaint({ [target]: native.value }, { commit: false });
    });
    native?.addEventListener("change", () => {
      const target = native.dataset.target;
      if (target) applyPaint({ [target]: native.value });
      closeSwatchPopover();
    });
    document.addEventListener(
      "mousedown",
      (e) => {
        if (pop.hidden) return;
        if (pop.contains(e.target)) return;
        if (e.target.closest?.("[data-dcb-paint], [data-paint-square], [data-paint-action]")) return;
        closeSwatchPopover();
      },
      true,
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pop.hidden) closeSwatchPopover();
    });
  }

  function build() {
    if (built) return;
    const workspace = document.getElementById("workspace");
    if (!workspace) return;
    const box = buildToolbox();
    const bar = buildControlBar();
    const pop = buildSwatchPopover();
    workspace.appendChild(box);
    workspace.appendChild(bar);
    document.body.appendChild(pop);
    if (window.lucide) {
      window.lucide.createIcons({ nameAttr: "data-lucide", nodes: [box, bar] });
    }
    wireToolbox(box);
    wireControlBar(bar);
    wirePopover(pop);
    built = true;
    applyTitles();
  }

  function onModeChange(e) {
    const active = !!e.detail?.active;
    const state = getState();
    if (active) {
      build();
      // ビューガイド（他ビュー輪郭の見通し線）は多ビュー CAD 用。Design では隠し、
      // 戻る時に元の設定へ戻す（ガイドスナップも showViewGuides に連動して止まる）
      savedShowViewGuides = state.showViewGuides;
      state.showViewGuides = false;
      const cur = TOOLS.find((t) => !t.sep && t.engine === state.activeTool);
      selectDesignTool(cur ? cur.id : "select");
    } else {
      closeSwatchPopover();
      if (savedShowViewGuides !== null) {
        state.showViewGuides = savedShowViewGuides;
        savedShowViewGuides = null;
      }
      // Design 専用のサブツール（ダイレクト選択・スポイト・ズーム）は 2D に持ち越さない
      if (["direct", "eyedropper", "zoom"].includes(designTool)) {
        leaveEditModes();
        if (typeof setActiveTool === "function") setActiveTool("select");
      }
      designTool = "select";
    }
    refresh();
    render();
    if (typeof updateAll === "function") updateAll();
  }

  function init() {
    const svg = document.getElementById("main-svg");
    svg?.addEventListener("mousedown", onCanvasMouseDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("millrect:designmodechange", onModeChange);
    window.addEventListener("millrect:toolchange", onEngineToolChange);
    window.addEventListener("millrect:uiupdate", () => {
      if (isActive()) refresh();
    });
    window.addEventListener("mouseup", () => {
      if (isActive()) requestAnimationFrame(refresh);
    });
    window.addEventListener("millrect-localechange", () => {
      if (!built) return;
      applyTitles();
      refresh();
    });
    // ネイティブのカラーピッカーをドラッグ中に履歴を積まなかった変更は、ピッカーを
    // 閉じずに別操作へ移った時でも 1 回だけ確定させる
    window.addEventListener("blur", () => {
      if (livePaintPending) {
        livePaintPending = false;
        pushHistory();
      }
    });
  }

  window.__millrectDesignMode = {
    isActive,
    getTool: () => designTool,
    selectTool: selectDesignTool,
    getPaint: currentPaint,
    applyPaint,
    swapFillStroke,
    resetDefaultPaint,
    setPaintFocus,
    getPaintFocus: () => paintFocus,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
