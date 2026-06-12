"use strict";

const PANEL_SECTIONS_STORAGE_KEY = "millrect-panel-sections";

const PANEL_SECTION_CHEVRON =
  '<svg class="panel-collapse-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let _panelSectionCache = null;

function _loadPanelSections() {
  if (_panelSectionCache) return _panelSectionCache;
  try {
    _panelSectionCache = JSON.parse(
      localStorage.getItem(PANEL_SECTIONS_STORAGE_KEY) || "{}",
    );
  } catch {
    _panelSectionCache = {};
  }
  return _panelSectionCache;
}

function isPanelSectionOpen(id, defaultOpen = true) {
  const stored = _loadPanelSections();
  if (Object.prototype.hasOwnProperty.call(stored, id)) {
    return !!stored[id];
  }
  return defaultOpen;
}

function setPanelSectionOpen(id, open) {
  const stored = _loadPanelSections();
  stored[id] = !!open;
  localStorage.setItem(PANEL_SECTIONS_STORAGE_KEY, JSON.stringify(stored));
}

function panelSectionHTML(id, title, bodyHTML, defaultOpen = true) {
  const open = isPanelSectionOpen(id, defaultOpen);
  return `<div class="panel-collapse${open ? "" : " is-collapsed"}" data-section="${id}">
    <button type="button" class="panel-collapse-trigger" data-default-open="${defaultOpen ? "true" : "false"}" aria-expanded="${open}">
      ${PANEL_SECTION_CHEVRON}
      <span class="panel-collapse-title">${title}</span>
    </button>
    <div class="panel-collapse-body">${bodyHTML}</div>
  </div>`;
}

function applyPanelSectionStates(root) {
  if (!root) return;
  root.querySelectorAll(".panel-collapse[data-section]").forEach((wrap) => {
    const id = wrap.dataset.section;
    if (!id) return;
    const trigger = wrap.querySelector(".panel-collapse-trigger");
    const defaultOpen = trigger?.dataset.defaultOpen !== "false";
    const open = isPanelSectionOpen(id, defaultOpen);
    wrap.classList.toggle("is-collapsed", !open);
    trigger?.setAttribute("aria-expanded", String(open));
  });
}

function bindPanelSections(root) {
  if (!root) return;
  root.querySelectorAll(".panel-collapse-trigger").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".panel-collapse");
      const id = wrap?.dataset.section;
      if (!id) return;
      const collapsed = wrap.classList.toggle("is-collapsed");
      const open = !collapsed;
      btn.setAttribute("aria-expanded", String(open));
      setPanelSectionOpen(id, open);
    });
  });
}

const PANEL_SPLIT_STORAGE_KEY = "millrect-panel-split-top";
const PANEL_SPLIT_DEFAULT = 0.55;
const PANEL_SPLIT_MIN = 0.25;
const PANEL_SPLIT_MAX = 0.75;
const PANEL_SPLIT_MIN_PX = 80;

function _clampSplitRatio(ratio) {
  return Math.max(PANEL_SPLIT_MIN, Math.min(PANEL_SPLIT_MAX, ratio));
}

function loadPanelSplitRatio() {
  try {
    const v = parseFloat(localStorage.getItem(PANEL_SPLIT_STORAGE_KEY));
    return Number.isFinite(v) ? _clampSplitRatio(v) : PANEL_SPLIT_DEFAULT;
  } catch {
    return PANEL_SPLIT_DEFAULT;
  }
}

function savePanelSplitRatio(ratio) {
  localStorage.setItem(
    PANEL_SPLIT_STORAGE_KEY,
    String(_clampSplitRatio(ratio)),
  );
}

function applyPanelSplitRatio(ratio) {
  const top = document.getElementById("panel-split-top");
  const bottom = document.getElementById("panel-split-bottom");
  const sidebar = document.getElementById("sidebar-right");
  if (!top || !bottom) return;
  const r = _clampSplitRatio(ratio);
  top.style.flex = `${Math.round(r * 1000)} 1 0%`;
  bottom.style.flex = `${Math.round((1 - r) * 1000)} 1 0%`;
  if (sidebar) sidebar.dataset.splitTop = String(r);
}

function getPanelSplitRatio() {
  const sidebar = document.getElementById("sidebar-right");
  const stored = parseFloat(sidebar?.dataset.splitTop);
  return Number.isFinite(stored) ? stored : loadPanelSplitRatio();
}

function initPanelSplit() {
  const handle = document.getElementById("panel-split-handle");
  const top = document.getElementById("panel-split-top");
  const bottom = document.getElementById("panel-split-bottom");
  if (!handle || !top || !bottom) return;

  applyPanelSplitRatio(loadPanelSplitRatio());

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    handle.classList.add("dragging");
    document.body.classList.add("dragging");
    const startY = e.clientY;
    const startTopH = top.offsetHeight;
    const totalH = top.offsetHeight + bottom.offsetHeight;

    const onMove = (ev) => {
      const delta = ev.clientY - startY;
      let newTopH = startTopH + delta;
      newTopH = Math.max(
        PANEL_SPLIT_MIN_PX,
        Math.min(totalH - PANEL_SPLIT_MIN_PX, newTopH),
      );
      applyPanelSplitRatio(newTopH / totalH);
    };
    const onUp = () => {
      handle.classList.remove("dragging");
      document.body.classList.remove("dragging");
      savePanelSplitRatio(getPanelSplitRatio());
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  handle.addEventListener("dblclick", () => {
    applyPanelSplitRatio(PANEL_SPLIT_DEFAULT);
    savePanelSplitRatio(PANEL_SPLIT_DEFAULT);
  });
}
