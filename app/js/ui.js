"use strict";

// ── System fonts → 同梱 Gen Interface JP + プロジェクト Google Fonts ──
async function loadSystemFonts() {
  return typeof getFontFamilyOptions === "function"
    ? getFontFamilyOptions()
    : BUILTIN_FONT_FAMILIES;
}

function buildFontFamilySelect(key, currentValue) {
  const fonts =
    typeof getFontFamilyOptions === "function"
      ? getFontFamilyOptions()
      : BUILTIN_FONT_FAMILIES;
  const current = normalizeTextFontFamily(currentValue);
  const opts = fonts
    .map((f) => {
      const sel = f === current ? " selected" : "";
      return `<option value="${f}"${sel}>${f}</option>`;
    })
    .join("");
  return `<div class="prop-row"><label>${t("props.font")}</label><select data-key="${key}" class="font-family-select">${opts}</select></div>`;
}

function _updateMeasureStatusVisibility(tool) {
  const wrap = document.getElementById("status-measure-wrap");
  if (!wrap) return;
  wrap.hidden = tool !== "measure";
  if (tool === "measure") {
    const el = document.getElementById("status-measure");
    if (el) el.textContent = "";
  }
}

const TOOL_INFO = {
  select: "SELECT",
  line: "LINE",
  rect: "RECT",
  circle: "CIRCLE",
  text: "TEXT",
  dimension: "DIM",
  hand: "HAND",
  bezier: "PEN",
  pencil: "PENCIL",
  measure: "MEASURE",
};

function initUI() {
  bindToolbar();
  bindPageSettings();
  bindReferenceImageSettings();
  bindProjectFonts();
  if (typeof hydrateFontLibrary === "function") {
    hydrateFontLibrary().then(() => updateProjectFontsPanel());
  }
  bindKeyShortcuts();
  initSidebarTabs();
  const sidebar = document.getElementById("sidebar-right");
  applyPanelSectionStates(sidebar);
  bindPanelSections(sidebar);
  initPanelSplit();
  updateAll();
}

const _uiPanelCache = Object.create(null);
let _updateAllRaf = 0;

function scheduleUpdateAll() {
  if (_updateAllRaf) return;
  _updateAllRaf = requestAnimationFrame(() => {
    _updateAllRaf = 0;
    updateAll();
  });
}

function _uiLocaleKey() {
  return typeof getLocale === "function" ? getLocale() : "";
}

function _uiCacheChanged(key, signature) {
  if (_uiPanelCache[key] === signature) return false;
  _uiPanelCache[key] = signature;
  return true;
}

function _pageListSignature(state) {
  return JSON.stringify({
    locale: _uiLocaleKey(),
    currentPageId: state.currentPageId,
    pages: (state.pages || []).map((page) => ({
      id: page.id,
      name: page.name,
      paper: page.paper,
      orientation: page.orientation,
      scale: page.scale,
      viewType: page.viewDefinition?.type || "top",
    })),
  });
}

function _layerListSignature(state, page) {
  const selected = (state.selectedShapeIds || []).join(",");
  const layers = (page?.layers || [])
    .map((layer) => {
      const shapes = (layer.shapes || [])
        .map((shape) => {
          const rv =
            typeof getShapeRenderVersion === "function"
              ? getShapeRenderVersion(shape.id)
              : 0;
          return `${shape.id}:${shape.type}:${shape.locked ? 1 : 0}:${rv}`;
        })
        .join(",");
      return `${layer.id}:${layer.name}:${layer.visible ? 1 : 0}:${layer.locked ? 1 : 0}:${shapes}`;
    })
    .join("|");
  return `${_uiLocaleKey()}|${state.currentPageId}|${state.currentLayerId}|${selected}|${layers}`;
}

function _propertiesPanelSignature(state) {
  const ids = state.selectedShapeIds || [];
  if (!ids.length) return `${_uiLocaleKey()}|empty|${state.activeTool}`;
  const page = getCurrentPage();
  const sc = page?.scale
    ? `${page.scale.numerator}/${page.scale.denominator}`
    : "1/1";
  const shapes = ids
    .map((id) => {
      const res = findShapeById(id);
      if (!res) return `${id}:missing`;
      const rv =
        typeof getShapeRenderVersion === "function"
          ? getShapeRenderVersion(id)
          : 0;
      return `${id}:${res.shape.type}:${rv}`;
    })
    .join(",");
  // Edit-mode toggles don't change the selection, so fold them into the
  // signature — otherwise the panel cache skips the rebuild and the path-edit
  // button label stays stale.
  const editMode = `${typeof _bezierEditId !== "undefined" ? _bezierEditId : ""}/${
    typeof _vertexEditId !== "undefined" ? _vertexEditId : ""
  }`;
  return `${_uiLocaleKey()}|${state.currentPageId}|${sc}|${state.activeTool}|${shapes}|${editMode}`;
}

function _pageSettingsSignature(state, page) {
  return JSON.stringify({
    locale: _uiLocaleKey(),
    currentPageId: state.currentPageId,
    paper: page?.paper,
    orientation: page?.orientation,
    scale: page?.scale,
    pages: (state.pages || []).map((pageItem) => ({
      id: pageItem.id,
      name: pageItem.name,
      viewType: pageItem.viewDefinition?.type || "top",
    })),
  });
}

function _historyPanelSignature() {
  return JSON.stringify({
    locale: _uiLocaleKey(),
    index: typeof getHistoryIndex === "function" ? getHistoryIndex() : -1,
    labels: typeof getHistoryLabels === "function" ? getHistoryLabels() : [],
  });
}

function _projectFontsSignature(state) {
  const projectFonts = state.fonts || [];
  const libraryFonts =
    typeof getFontLibraryFonts === "function" ? getFontLibraryFonts() : [];
  return JSON.stringify({
    locale: _uiLocaleKey(),
    projectFonts,
    libraryFonts,
  });
}

async function applyOpenedProject({
  projectId,
  json,
  projectName,
  paper,
  orientation,
  scale,
  template,
  savedAt,
}) {
  if (json) {
    try {
      importProjectFromJsonString(json);
    } catch (e) {
      if (e.code === "NotMillrectProject") {
        alert(t("common.alert.notMillrectProject"));
      } else if (e instanceof SyntaxError) {
        alert(t("common.alert.projectJsonParseError", { message: e.message }));
      } else {
        throw e;
      }
    }
  } else {
    const state = typeof initState === "function" ? initState() : getState();
    if (projectName) state.projectName = projectName;
    Object.assign(state.pages[0], { paper, orientation, scale });
    replaceState(state);
  }
  const id = projectId || genId("proj");
  setCurrentProjectId(id);
  const isNewEmpty = !projectId && !json && !template;
  if (isNewEmpty) {
    setAutosaveStatus("");
  } else if (projectId) {
    markProjectSaved(savedAt);
  } else {
    await doAutosave();
  }
  if (typeof cancelDim === "function") cancelDim();
  if (typeof fitPage === "function") {
    fitPage();
  }
  render();
  updateAll();
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
  if (typeof hydrateProjectFontsFromState === "function") {
    hydrateProjectFontsFromState();
  }
}

function updateAll() {
  const state = getState();
  const page = getCurrentPage();
  updateToolbar();
  const pagesEl = document.getElementById("pages-list");
  const pagesSig = _pageListSignature(state);
  if (_uiCacheChanged("pages", pagesSig) || !pagesEl?.childElementCount) {
    updatePagesList();
  }
  const projectFontsSig = _projectFontsSignature(state);
  if (_uiCacheChanged("projectFonts", projectFontsSig)) {
    updateProjectFontsPanel();
  }
  const layersEl = document.getElementById("layers-list");
  const layersSig = _layerListSignature(state, page);
  if (_uiCacheChanged("layers", layersSig) || !layersEl?.childElementCount) {
    updateLayersList();
  }
  const propertiesSig = _propertiesPanelSignature(state);
  if (_uiCacheChanged("properties", propertiesSig)) {
    updatePropertiesPanel();
  }
  const pageSettingsSig = _pageSettingsSignature(state, page);
  if (_uiCacheChanged("pageSettings", pageSettingsSig)) {
    updatePageSettings();
  }
  updateReferenceImagePanel();
  const historySig = _historyPanelSignature();
  if (_uiCacheChanged("history", historySig)) {
    updateHistoryPanel();
  }
  if (typeof renderProjectTabs === "function") renderProjectTabs();
  const el = document.getElementById("status-scale");
  if (el) el.textContent = `1/${page.scale.denominator}`;
  const ez = document.getElementById("status-zoom");
  if (ez) ez.textContent = `${(getState().zoom * 100).toFixed(0)}%`;
}

function bindToolbar() {
  document.getElementById("btn-new").addEventListener("click", () => {
    // 新規ボタン: 名称未設定プロジェクトを新しいタブで直接開く（モーダル無し）
    if (typeof openUntitledProjectTab === "function") {
      openUntitledProjectTab();
    } else {
      showProjectList().then((result) => result && applyOpenedProject(result));
    }
  });
  document
    .getElementById("btn-save")
    .addEventListener("click", () => doAutosave());
  document.getElementById("btn-open").addEventListener("click", () => {
    // 開くボタン: 保存済みプロジェクトをリストから選んで新しいタブで開く
    if (typeof promptNewProjectTab === "function") {
      promptNewProjectTab();
    } else {
      showProjectList().then((result) => result && applyOpenedProject(result));
    }
  });
  document
    .getElementById("btn-import-svg")
    .addEventListener("click", async () => {
      try {
        const svgText = await importSvgFromFile();
        const shapes = parseSvgToShapes(svgText);
        if (shapes.length === 0) {
          alert(t("common.alert.noShapesInSvg"));
          return;
        }
        const state = getState();
        const page = state.pages.find((p) => p.id === state.currentPageId);
        const layer = page?.layers.find((l) => l.id === state.currentLayerId);
        if (!layer) {
          alert(t("common.alert.layerNotFound"));
          return;
        }
        layer.shapes.push(...shapes);
        pushHistory();
        render();
        updateAll();
      } catch (e) {
        if (e.message !== "No file")
          alert(t("common.alert.svgImportError", { message: e.message }));
      }
    });
  document
    .getElementById("btn-import-image")
    ?.addEventListener("click", async () => {
      try {
        const image = await importImageFromFile();
        const state = getState();
        const page = state.pages.find((p) => p.id === state.currentPageId);
        const layer = page?.layers.find((l) => l.id === state.currentLayerId);
        if (!layer) {
          alert(t("common.alert.layerNotFound"));
          return;
        }
        if (layer.locked) return;

        const paper = getPaperDimensions(page);
        const aspect = image.naturalHeight / Math.max(1, image.naturalWidth);
        const widthMm = Math.min(120, paper.width * 0.7);
        const heightMm = Math.max(1, widthMm * aspect);
        const placed = layoutCenteredRectMm(
          widthMm,
          heightMm,
          paper,
          page.scale,
        );
        const newShape = {
          id: genId("image"),
          type: "image",
          dataUrl: image.dataUrl,
          name: image.name,
          x: placed.x,
          y: placed.y,
          width: mmToReal(widthMm),
          height: mmToReal(heightMm),
          opacity: 1,
          originalBytes: image.originalBytes,
          storageBytes: image.storageBytes,
          compressed: image.compressed,
        };
        layer.shapes.push(newShape);
        state.selectedShapeIds = [newShape.id];
        pushHistory();
        render();
        updateAll();
      } catch (e) {
        if (e.message !== "No file")
          alert(t("common.alert.imageImportError", { message: e.message }));
      }
    });
  document
    .getElementById("btn-export-svg")
    .addEventListener("click", exportCurrentPageSvg);
  document
    .getElementById("btn-export-dxf")
    .addEventListener("click", exportCurrentPageDxf);
  document
    .getElementById("btn-export-pdf")
    .addEventListener("click", async () => {
      const btn = document.getElementById("btn-export-pdf");
      btn.textContent = "..PDF";
      btn.disabled = true;
      try {
        await exportAllPagesPdf();
      } finally {
        btn.textContent = "PDF";
        btn.disabled = false;
      }
    });
  document
    .getElementById("btn-export-json")
    .addEventListener("click", exportProjectJson);
  document.getElementById("btn-undo").addEventListener("click", () => {
    if (undo()) {
      cancelDim();
      render();
      updateAll();
    }
  });
  document.getElementById("btn-redo").addEventListener("click", () => {
    if (redo()) {
      cancelDim();
      render();
      updateAll();
    }
  });
  document.getElementById("btn-help-docs")?.addEventListener("click", () => {
    if (typeof openDocsViewer === "function") openDocsViewer();
  });
  document.getElementById("project-name").addEventListener("change", (e) => {
    getState().projectName = e.target.value;
  });

  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      cancelDim();
      if (typeof cancelMeasure === "function") cancelMeasure();
      const tool = btn.dataset.tool;
      getState().activeTool = tool;
      if (typeof onActiveToolChanged === "function") {
        onActiveToolChanged(tool);
      }
      if (typeof window.dataLayer !== "undefined") {
        window.dataLayer.push({ event: "tool_selected", tool_name: tool });
      }
      updateToolbar();
      updatePropertiesPanel();
      const el = document.getElementById("status-tool");
      if (el) el.textContent = TOOL_INFO[btn.dataset.tool] || btn.dataset.tool;
      _updateMeasureStatusVisibility(tool);
    });
  });

  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    const state = getState(),
      svgEl = document.getElementById("main-svg");
    const { width: cw, height: ch } = svgEl.getBoundingClientRect();
    const mx = cw / 2,
      my = ch / 2;
    const nz = Math.min(50, state.zoom * 1.25);
    state.panX = mx - (mx - state.panX) * (nz / state.zoom);
    state.panY = my - (my - state.panY) * (nz / state.zoom);
    state.zoom = nz;
    render();
    const el = document.getElementById("status-zoom");
    if (el) el.textContent = `${(nz * 100).toFixed(0)}%`;
  });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    const state = getState(),
      svgEl = document.getElementById("main-svg");
    const { width: cw, height: ch } = svgEl.getBoundingClientRect();
    const mx = cw / 2,
      my = ch / 2;
    const nz = Math.max(0.2, state.zoom / 1.25);
    state.panX = mx - (mx - state.panX) * (nz / state.zoom);
    state.panY = my - (my - state.panY) * (nz / state.zoom);
    state.zoom = nz;
    render();
    const el = document.getElementById("status-zoom");
    if (el) el.textContent = `${(nz * 100).toFixed(0)}%`;
  });
  document.getElementById("btn-zoom-fit")?.addEventListener("click", () => {
    fitPage();
    render();
    updateAll();
  });

  document.getElementById("btn-help")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const pop = document.getElementById("help-popover");
    if (!pop) return;
    if (pop.hidden) {
      const rect = e.currentTarget.getBoundingClientRect();
      pop.style.right = window.innerWidth - rect.right + "px";
      pop.style.bottom = window.innerHeight - rect.top + 6 + "px";
      pop.hidden = false;
    } else {
      pop.hidden = true;
    }
  });
  document.getElementById("btn-help-close")?.addEventListener("click", () => {
    const pop = document.getElementById("help-popover");
    if (pop) pop.hidden = true;
  });
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("help-popover");
    if (
      pop &&
      !pop.hidden &&
      !pop.contains(e.target) &&
      e.target.id !== "btn-help"
    ) {
      pop.hidden = true;
    }
  });
}

function updateToolbar() {
  const state = getState();
  document.getElementById("btn-undo").disabled = !canUndo();
  document.getElementById("btn-redo").disabled = !canRedo();
  const n = document.getElementById("project-name");
  if (n && document.activeElement !== n) n.value = state.projectName;
  document
    .querySelectorAll(".tool-btn")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.tool === state.activeTool),
    );
  const svg = document.getElementById("main-svg");
  if (svg) {
    svg.classList.toggle("tool-select", state.activeTool === "select");
    svg.classList.toggle("tool-bezier", state.activeTool === "bezier");
    // Idle cursor is CSS-driven: crosshair for drawing tools (#main-svg),
    // default for select (.tool-select). Clear any inline cursor left over from
    // an interaction so CSS wins; the hand tool uses grab.
    svg.style.cursor = state.activeTool === "hand" ? "grab" : "";
  }
}

function updatePagesList() {
  const state = getState(),
    c = document.getElementById("pages-list");
  if (!c) return;
  const frag = document.createDocumentFragment();
  for (const page of state.pages) {
    const div = document.createElement("div");
    div.className = `list-item${page.id === state.currentPageId ? " active" : ""}`;
    const nm = document.createElement("span");
    nm.className = "item-name";
    nm.textContent = page.name;
    const viewType = page.viewDefinition?.type || "top";
    nm.title = t("page.meta", {
      paper: page.paper,
      orientation: t("page.orientation." + page.orientation),
      scale: page.scale.denominator,
    });
    nm.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const n = prompt(t("pages.promptName"), page.name);
      if (n?.trim()) {
        updatePage(page.id, { name: n.trim() });
        updatePagesList();
      }
    });
    const db = document.createElement("button");
    db.className = "item-del";
    db.textContent = "×";
    db.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.pages.length <= 1) return;
      if (!confirm(t("pages.deleteConfirm", { name: page.name }))) return;
      deletePage(page.id);
      render();
      updateAll();
    });
    const badge = document.createElement("span");
    badge.className = "item-view-badge";
    badge.textContent = viewType;
    badge.title = t("view.type." + viewType);
    div.appendChild(nm);
    div.appendChild(badge);
    div.appendChild(db);
    div.addEventListener("click", () => {
      activatePage(page.id);
    });
    frag.appendChild(div);
  }
  c.replaceChildren(frag);
}

function activatePage(pageId) {
  const state = getState();
  if (state.currentPageId === pageId) return true;
  if (typeof switchPage === "function") {
    if (!switchPage(pageId)) return false;
  } else {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return false;
    state.currentPageId = page.id;
    state.currentLayerId = page.layers[0]?.id || "";
    state.selectedShapeIds = [];
  }
  if (typeof deselectReferenceImage === "function") {
    deselectReferenceImage();
  }
  cancelDim();
  render();
  updateAll();
  return true;
}

function addViewPage(viewType) {
  if (!viewType || pageViewTypeExists(viewType)) {
    resetAddViewSelect();
    return null;
  }
  const current = getCurrentPage();
  const preset = VIEW_DEFINITION_PRESETS[viewType] || {
    normal: null,
    up: null,
  };
  addPage(
    createPage({
      name: uniquePageName(viewPageBaseName(viewType)),
      paper: current.paper,
      orientation: current.orientation,
      scale: { ...current.scale },
      viewDefinition: { type: viewType, ...preset },
    }),
  );
  if (typeof deselectReferenceImage === "function") {
    deselectReferenceImage();
  }
  cancelDim();
  render();
  updateAll();
  return getCurrentPage().id;
}

function pageViewTypeExists(viewType) {
  return getState().pages.some(
    (p) => (p.viewDefinition?.type || "top") === viewType,
  );
}

function viewPageBaseName(viewType) {
  return t("view.type." + viewType).replace(/\s*\([^)]*\)\s*$/, "");
}

function uniquePageName(baseName) {
  const names = new Set(getState().pages.map((p) => p.name));
  if (!names.has(baseName)) return baseName;
  for (let i = 2; ; i += 1) {
    const next = `${baseName} ${i}`;
    if (!names.has(next)) return next;
  }
}

function updateLayersList() {
  const state = getState(),
    page = getCurrentPage(),
    c = document.getElementById("layers-list");
  if (!c) return;
  const frag = document.createDocumentFragment();
  for (const layer of [...page.layers].reverse()) {
    const div = document.createElement("div");
    div.className = `list-item layer-item${layer.id === state.currentLayerId ? " active" : ""}`;
    const vb = document.createElement("button");
    vb.className = "layer-vis";
    vb.title = layer.visible ? t("layers.hide") : t("layers.show");
    vb.innerHTML = layer.visible ? EYE_ON : EYE_OFF;
    vb.addEventListener("click", (e) => {
      e.stopPropagation();
      updateLayer(page.id, layer.id, { visible: !layer.visible });
      render();
      updateLayersList();
    });
    const lb = document.createElement("button");
    lb.className = "layer-lock";
    lb.title = layer.locked ? t("layers.unlock") : t("layers.lock");
    lb.innerHTML = layer.locked ? LOCK_ON : LOCK_OFF;
    lb.addEventListener("click", (e) => {
      e.stopPropagation();
      updateLayer(page.id, layer.id, { locked: !layer.locked });
      updateLayersList();
    });
    const nm = document.createElement("span");
    nm.className = "item-name";
    nm.textContent = layer.name;
    nm.title = t("layers.renameHint");
    nm.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      startLayerNameEdit(page, layer, nm);
    });
    const eb = document.createElement("button");
    eb.className = "item-edit";
    eb.title = t("layers.rename");
    eb.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 2.5 11.5 5.5"/><path d="M2 12l3.4-.7L12 3.7 10.3 2 2.7 8.6 2 12Z"/></svg>`;
    eb.addEventListener("click", (e) => {
      e.stopPropagation();
      startLayerNameEdit(page, layer, nm);
    });
    const db = document.createElement("button");
    db.className = "item-del";
    db.textContent = "×";
    db.addEventListener("click", (e) => {
      e.stopPropagation();
      if (page.layers.length <= 1) return;
      deleteLayer(page.id, layer.id);
      render();
      updateAll();
    });
    div.appendChild(vb);
    div.appendChild(lb);
    div.appendChild(nm);
    div.appendChild(eb);
    div.appendChild(db);
    div.addEventListener("click", () => {
      if (state.currentLayerId === layer.id) return;
      state.currentLayerId = layer.id;
      updateLayersList();
    });
    frag.appendChild(div);
  }
  const ab = document.createElement("button");
  ab.className = "add-btn";
  ab.textContent = t("layers.add");
  ab.addEventListener("click", () => {
    addLayer(
      page.id,
      createLayer({ name: t("default.layer", { n: page.layers.length + 1 }) }),
    );
    updateAll();
  });
  frag.appendChild(ab);

  // ── Shape list (current layer) ──────────────────────
  const state2 = getState();
  const curLayer = page.layers.find((l) => l.id === state2.currentLayerId);
  if (curLayer && curLayer.shapes.length > 0) {
    const holder = document.createElement("div");
    holder.innerHTML = panelSectionHTML(
      "panel.layers.shapes",
      t("panel.layers.shapes", { count: curLayer.shapes.length }),
      "",
      true,
    );
    const sec = holder.firstElementChild;
    const body = sec.querySelector(".panel-collapse-body");

    const TYPE_ICON = {
      rect: "▭",
      circle: "○",
      line: "╱",
      text: "T",
      bezier: "✒",
      pencil: "✎",
      dimension: "↔",
      path: "⬠",
      rawpath: "✒",
      ellipse: "○",
      image: "▧",
    };

    // Render in reverse order (top of stack first)
    const shapes = [...curLayer.shapes].reverse();
    shapes.forEach((shape) => {
      const row = document.createElement("div");
      const isSelected = state2.selectedShapeIds.includes(shape.id);
      const isLocked = !!shape.locked;
      row.className = `list-item shape-item${isSelected ? " active" : ""}${isLocked ? " locked" : ""}`;

      const icon = document.createElement("span");
      icon.className = "shape-icon";
      icon.textContent = TYPE_ICON[shape.type] || "◻";

      const name = document.createElement("span");
      name.className = "item-name";
      name.textContent =
        shape.type === "text"
          ? (shape.text || "").split("\n")[0].slice(0, 20) ||
            t("layers.shapeEmptyText")
          : `${shape.type} ${shape.id.slice(-4)}`;

      const lockBtn = document.createElement("button");
      lockBtn.className = "shape-lock";
      lockBtn.title = isLocked ? t("layers.unlock") : t("layers.lock");
      lockBtn.innerHTML = isLocked ? LOCK_ON : LOCK_OFF;
      lockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setShapeLocked(shape.id, !shape.locked);
        render();
        uiUpdate();
      });

      const upBtn = document.createElement("button");
      upBtn.className = "zorder-btn";
      upBtn.title = t("layers.bringForward");
      upBtn.textContent = "↑";
      upBtn.disabled = isLocked;
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (shape.locked) return;
        moveShapeZOrder(shape.id, "up");
        render();
        updateLayersList();
      });

      const dnBtn = document.createElement("button");
      dnBtn.className = "zorder-btn";
      dnBtn.title = t("layers.sendBackward");
      dnBtn.textContent = "↓";
      dnBtn.disabled = isLocked;
      dnBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (shape.locked) return;
        moveShapeZOrder(shape.id, "down");
        render();
        updateLayersList();
      });

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(lockBtn);
      row.appendChild(upBtn);
      row.appendChild(dnBtn);
      row.addEventListener("click", () => {
        if (shape.locked) {
          updateLayersList();
          return;
        }
        state2.selectedShapeIds = [shape.id];
        render();
        uiUpdate();
      });
      body.appendChild(row);
    });
    frag.appendChild(sec);
  }
  c.replaceChildren(frag);
  bindPanelSections(c);
}

function startLayerNameEdit(page, layer, nameEl) {
  getState().currentLayerId = layer.id;
  const input = document.createElement("input");
  input.className = "layer-name-input";
  input.type = "text";
  input.value = layer.name || "";
  input.setAttribute("aria-label", t("layers.promptName"));
  let cancelled = false;

  const finish = () => {
    const next = input.value.trim();
    if (!cancelled && next && next !== layer.name) {
      updateLayer(page.id, layer.id, { name: next });
    }
    updateLayersList();
  };

  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("dblclick", (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelled = true;
      input.blur();
    }
  });
  input.addEventListener("blur", finish);

  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

const EYE_ON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const LOCK_ON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const LOCK_OFF =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

let _propsPanelSelectionKey = "";

function initSidebarTabs() {
  const rightPanel = document.getElementById("sidebar-right");
  if (!rightPanel || rightPanel.dataset.tabsBound) return;
  rightPanel.dataset.tabsBound = "1";

  const TOP_TABS = new Set(["design", "history"]);
  const BOTTOM_TABS = new Set(["layers", "pages"]);

  function switchTab(name) {
    if (!name) return;
    let zone = null;
    if (TOP_TABS.has(name)) {
      zone = rightPanel.querySelector(".panel-split-top");
    } else if (BOTTOM_TABS.has(name)) {
      zone = rightPanel.querySelector(".panel-split-bottom");
    }
    if (!zone) return;
    zone
      .querySelectorAll(".panel-tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    zone
      .querySelectorAll(".tab-pane")
      .forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
  }
  window._switchTab = switchTab;

  rightPanel.addEventListener(
    "pointerdown",
    (e) => {
      const tab = e.target.closest(".panel-tab");
      if (!tab || !rightPanel.contains(tab)) return;
      e.preventDefault();
      e.stopPropagation();
      switchTab(tab.dataset.tab);
    },
    true,
  );
}

function updatePropertiesPanel() {
  const state = getState(),
    c = document.getElementById("properties-panel");
  if (!c) return;
  const selectionKey = state.selectedShapeIds.join(",");
  _propsPanelSelectionKey = selectionKey;
  if (!state.selectedShapeIds.length) {
    if (state.activeTool === "pencil") {
      c.innerHTML = panelSectionHTML(
        "panel.design.pen",
        t("props.penSettings"),
        buildPenSettingsHTML(),
        true,
      );
      bindPenSettingsEvents(c);
      bindPanelSections(c);
      return;
    }
    c.innerHTML = `<p class="prop-empty">${t("props.selectShape")}</p>`;
    return;
  }
  if (state.selectedShapeIds.length > 1) {
    const alignHTML = buildAlignPositionHTML(state.selectedShapeIds);
    const sizeBody = buildMultiSizeHTML(state.selectedShapeIds);
    const sizeHTML = sizeBody
      ? panelSectionHTML(
          "panel.design.bulk-size",
          t("panel.design.bulkSize"),
          sizeBody,
          true,
        )
      : "";
    c.innerHTML =
      `<p class="prop-empty prop-empty-compact">${t("props.multiSelect", { count: state.selectedShapeIds.length })}</p>` +
      alignHTML +
      sizeHTML +
      panelSectionHTML(
        "panel.design.appearance",
        t("panel.design.appearanceBulk"),
        buildMultiAppearanceHTML(state.selectedShapeIds),
        true,
      ) +
      buildBooleanMenuHTML(state.selectedShapeIds.length) +
      panelSectionHTML(
        "panel.design.group",
        t("panel.design.group"),
        `<div class="prop-multi-actions">
        <button id="btn-group-shapes" title="${t("props.groupShortcut")}">${t("props.group")} <kbd>⌘G</kbd></button>
      </div>`,
        true,
      ) +
      _buildArrayDuplicateHTML();
    bindAlignPositionEvents(c, state.selectedShapeIds);
    bindBooleanMenuEvents(c);
    bindPanelSections(c);
    document
      .getElementById("btn-group-shapes")
      .addEventListener("click", () => {
        groupSelectedShapes();
        render();
        uiUpdate();
      });
    _bindArrayDuplicateEvents(c);
    bindAppearanceEvents(c, state.selectedShapeIds);
    bindSizeEvents(c, state.selectedShapeIds);
    return;
  }
  const res = findShapeById(state.selectedShapeIds[0]);
  if (!res) {
    c.innerHTML = "";
    return;
  }
  if (res.shape.type === "group") {
    const alignHTML = buildAlignPositionHTML(state.selectedShapeIds);
    c.innerHTML =
      alignHTML +
      panelSectionHTML(
        "panel.design.group",
        t("panel.design.group"),
        `<p class="prop-empty prop-empty-compact">${t("props.groupCount", { count: res.shape.children.length })}</p>
      <div class="prop-multi-actions"><button id="btn-ungroup-shapes" title="${t("props.ungroupShortcut")}">${t("props.ungroup")} <kbd>⌘⇧G</kbd></button></div>`,
        true,
      ) +
      buildBooleanMenuHTML(1);
    bindAlignPositionEvents(c, state.selectedShapeIds);
    bindBooleanMenuEvents(c);
    bindPanelSections(c);
    document
      .getElementById("btn-ungroup-shapes")
      .addEventListener("click", () => {
        ungroupSelectedShapes();
        render();
        uiUpdate();
      });
    return;
  }
  const alignHTML = buildAlignPositionHTML(state.selectedShapeIds);
  c.innerHTML =
    alignHTML + buildPropsHTML(res.shape) + _buildArrayDuplicateHTML();
  if (window.lucide)
    window.lucide.createIcons({ nameAttr: "data-lucide", nodes: [c] });
  bindAlignPositionEvents(c, state.selectedShapeIds);
  const cbSolid = c.querySelector("#prop-solid-intersect");
  if (cbSolid) {
    cbSolid.addEventListener("change", () => {
      const r = findShapeById(state.selectedShapeIds[0]);
      if (!r) return;
      if (cbSolid.checked) r.shape.solidIntersect = true;
      else delete r.shape.solidIntersect;
      pushHistory();
      render();
      uiUpdate();
      if (
        typeof is3DMode === "function" &&
        is3DMode() &&
        typeof scheduleUpdate3DScene === "function"
      ) {
        scheduleUpdate3DScene(0);
      }
    });
  }
  // Path/bezier edit-mode toggles now live under the rotation control
  // (bindAlignPositionEvents → #btn-pathedit-toggle).
  const btnTE = c.querySelector("#btn-text-edit");
  if (btnTE) {
    btnTE.addEventListener("click", () => {
      const r = findShapeById(state.selectedShapeIds[0]);
      if (!r || r.shape.type !== "text") return;
      editTextShape(r.shape);
    });
  }
  const btnTO = c.querySelector("#btn-text-outline");
  if (btnTO) {
    btnTO.addEventListener("click", () => {
      if (btnTO.disabled || !isTextOutlineAvailable()) return;
      const r = findShapeById(state.selectedShapeIds[0]);
      if (!r || r.shape.type !== "text") return;
      void outlineTextShape(r.shape.id);
    });
  }
  const btnDimReset = c.querySelector("#btn-dim-label-reset");
  if (btnDimReset) {
    btnDimReset.addEventListener("click", () => {
      const r = findShapeById(state.selectedShapeIds[0]);
      if (!r || r.shape.type !== "dimension") return;
      delete r.shape.textOffsetX;
      delete r.shape.textOffsetY;
      delete r.shape.textRotation;
      pushHistory();
      render();
      uiUpdate();
    });
  }
  const btnDimValueReset = c.querySelector("#btn-dim-value-reset");
  if (btnDimValueReset) {
    btnDimValueReset.addEventListener("click", () => {
      const r = findShapeById(state.selectedShapeIds[0]);
      if (!r || r.shape.type !== "dimension") return;
      delete r.shape.value;
      pushHistory();
      render();
      uiUpdate();
    });
  }
  const runFillet = (mode) => {
    const radiusInp = c.querySelector("#fillet-radius");
    const radiusMm = parseFloat(radiusInp?.value);
    if (isNaN(radiusMm) || radiusMm <= 0) return;
    const sid = state.selectedShapeIds[0];
    const ok = applyFilletToPath(sid, radiusMm, mode);
    if (!ok) {
      if (typeof showErrorToast === "function") {
        showErrorToast(t("toast.fillet.failed"));
      }
      return;
    }
    render();
    uiUpdate();
  };
  c.querySelector("#btn-apply-fillet")?.addEventListener("click", () =>
    runFillet("round"),
  );
  c.querySelector("#btn-apply-chamfer")?.addEventListener("click", () =>
    runFillet("chamfer"),
  );
  const btnTMove = c.querySelector("#btn-transform-move");
  const btnTCopy = c.querySelector("#btn-transform-copy");
  const getTransformDelta = () => {
    const dxMm =
      parseFloat(document.getElementById("transform-dx")?.value) || 0;
    const dyMm =
      parseFloat(document.getElementById("transform-dy")?.value) || 0;
    return { dx: mmToReal(dxMm), dy: mmToReal(dyMm) };
  };
  if (btnTMove) {
    btnTMove.addEventListener("click", () => {
      const { dx, dy } = getTransformDelta();
      for (const id of state.selectedShapeIds) {
        const res = findShapeById(id);
        if (res) shiftShape(res.shape, dx, dy);
      }
      pushHistory();
      render();
      uiUpdate();
    });
  }
  if (btnTCopy) {
    btnTCopy.addEventListener("click", () => {
      const { dx, dy } = getTransformDelta();
      const newIds = cloneSelectedShapes(dx, dy);
      if (newIds.length) {
        state.selectedShapeIds = newIds;
        pushHistory();
        render();
        uiUpdate();
      }
    });
  }
  c.querySelectorAll("input,select,textarea").forEach((inp) => {
    if (inp.type === "text" || inp.tagName === "TEXTAREA") {
      inp.addEventListener("input", () =>
        inp.dispatchEvent(new Event("change")),
      );
      inp.addEventListener("keydown", (e) => e.stopPropagation());
    }
    if (inp.type === "number") {
      inp.addEventListener("blur", () => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) inp.value = fmtNum(v);
      });
    }
    inp.addEventListener("change", () => {
      const key = inp.dataset.key;
      if (!key) return;
      if (key === "fill" || key === "stroke") return;
      const sid = state.selectedShapeIds[0];
      if (key === "path-w" || key === "path-h") {
        const newVal = parseFloat(inp.value);
        if (isNaN(newVal) || newVal <= 0) return;
        const r = findShapeById(sid);
        if (!r || r.shape.type !== "path") return;
        const sh = r.shape;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const poly of sh.contours)
          for (const ring of poly)
            for (const [x, y] of ring) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
        const ow = maxX - minX || 1,
          oh = maxY - minY || 1;
        const newReal = mmToReal(newVal);
        const sw = key === "path-w" ? newReal / ow : 1,
          sh2 = key === "path-h" ? newReal / oh : 1;
        sh.contours = sh.contours.map((poly) =>
          poly.map((ring) =>
            ring.map(([x, y]) => [
              minX + (x - minX) * sw,
              minY + (y - minY) * sh2,
            ]),
          ),
        );
        pushHistory();
        render();
        uiUpdate();
        return;
      }
      let raw = inp.type === "number" ? parseFloat(inp.value) : inp.value;
      if (inp.type === "number" && isNaN(raw)) return;
      if (inp.dataset.unit === "mm") raw = mmToReal(raw);
      updateShape(sid, { [key]: raw });
      render();
      // role 切り替えは条件付きフィールド（切り込み幅）の表示を更新するため再描画
      if (key === "role") uiUpdate();
    });
  });
  c.querySelectorAll("[data-rx-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = res.shape;
      const next =
        (s.rxMode || "uniform") === "uniform" ? "individual" : "uniform";
      if (next === "individual") {
        const v = s.rx ?? 0;
        updateShape(state.selectedShapeIds[0], {
          rxMode: "individual",
          rxTL: v,
          rxTR: v,
          rxBR: v,
          rxBL: v,
        });
      } else {
        updateShape(state.selectedShapeIds[0], { rxMode: "uniform" });
      }
      render();
      uiUpdate();
    });
  });
  bindPanelSections(c);
  // 配列複製イベントをバインド（単一選択時）
  _bindArrayDuplicateEvents(c);
  bindAppearanceEvents(c, state.selectedShapeIds);
}
// Display a number with up to 2 decimals, trailing zeros stripped
// (12.00 → "12", 0.50 → "0.5", 0.13 → "0.13").
function fmtNum(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return typeof n === "string" ? n : "0";
  return String(parseFloat(num.toFixed(2)));
}
function pRow(label, key, value, type = "number") {
  const v =
    type === "number" && typeof value === "number" ? fmtNum(value) : value;
  if (type === "textarea") {
    const escaped = String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="prop-row prop-row-textarea"><label>${label}</label><textarea data-key="${key}" rows="3">${escaped}</textarea></div>`;
  }
  return `<div class="prop-row"><label>${label}</label><input type="${type}" data-key="${key}" value="${v}" ${type === "number" ? 'step="0.1"' : ""}></div>`;
}
function stripUnitLabel(label, unit) {
  const escapedUnit = String(unit).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(label)
    .replace(new RegExp("\\s*\\(" + escapedUnit + "\\)\\s*$", "i"), "")
    .replace(new RegExp("\\s+" + escapedUnit + "\\s*$", "i"), "")
    .trim();
}
function pRowUnit(label, key, value, unit, type = "number", dataUnit = "") {
  const v =
    type === "number" && typeof value === "number" ? fmtNum(value) : value;
  const unitAttr = dataUnit ? ` data-unit="${dataUnit}"` : "";
  const stepAttr = type === "number" ? ' step="0.1"' : "";
  return `<div class="prop-row"><label>${stripUnitLabel(label, unit)}</label><div class="prop-unit-field"><input type="${type}" data-key="${key}"${unitAttr} value="${v}"${stepAttr}><span class="prop-unit-suffix">${unit}</span></div></div>`;
}
function pRowUnitById(label, id, value, unit, attrs = "") {
  return `<div class="prop-row"><label>${stripUnitLabel(label, unit)}</label><div class="prop-unit-field"><input type="number" id="${id}" value="${value}" ${attrs}><span class="prop-unit-suffix">${unit}</span></div></div>`;
}
function pRowMm(label, key, realValue, type = "number") {
  const display =
    type === "number" && typeof realValue === "number"
      ? fmtNum(realToMM(realValue))
      : realValue;
  if (type === "textarea") {
    return pRow(label, key, display, type);
  }
  return pRowUnit(label, key, display, "mm", type, "mm");
}
function pSel(label, key, value, options) {
  return `<div class="prop-row"><label>${label}</label><select data-key="${key}">${options.map((o) => `<option value="${o.v}"${o.v === value ? " selected" : ""}>${o.l}</option>`).join("")}</select></div>`;
}
function pRO(label, value) {
  return `<div class="prop-row prop-readonly"><label>${label}</label><span>${value}</span></div>`;
}
// Stroke-width select using the ISO mm presets. Selection matches by resolved mm
// so legacy thin/medium/thick shapes light up the right option. `attr` is the
// data-* attribute name ("data-key" single / "data-appearance" multi).
function strokeWidthSelectHTML(attr, value, mixed) {
  const curMm = resolveStrokeWidthMm(value);
  const opts = STROKE_WIDTH_PRESETS.map((w) => {
    const sel = !mixed && Math.abs(curMm - w) < 1e-6 ? " selected" : "";
    // Plain number string drops trailing zeros (0.50→0.5, 1.00→1).
    return `<option value="${w}"${sel}>${w} mm</option>`;
  }).join("");
  const mixedOpt = mixed
    ? `<option value="" selected disabled>${t("props.mixed")}</option>`
    : "";
  return `<div class="prop-row"><label>${t("props.strokeWidth")}</label><select ${attr}="strokeWidth">${mixedOpt}${opts}</select></div>`;
}
function lineStyleSelectHTML(attr, value, mixed) {
  const cur = value || "solid";
  const opts = LINE_STYLES.map(
    (v) =>
      `<option value="${v}"${!mixed && cur === v ? " selected" : ""}>${t("props.lineStyle." + v)}</option>`,
  ).join("");
  const mixedOpt = mixed
    ? `<option value="" selected disabled>${t("props.mixed")}</option>`
    : "";
  return `<div class="prop-row"><label>${t("props.lineStyle")}</label><select ${attr}="strokeStyle">${mixedOpt}${opts}</select></div>`;
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${fmtNum(n / 1024)} KB`;
  return `${fmtNum(n / (1024 * 1024))} MB`;
}

const FILL_PRESETS = [
  "#5965f9",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#64748b",
  "#1a1a2e",
];
const DEFAULT_FILL_COLOR = "#5965f9";
const DEFAULT_STROKE_COLOR = "#1a1a2e";

function shapeSupportsFill(type) {
  return ["rect", "circle", "ellipse", "path", "bezier"].includes(type);
}

function textInkAppearanceValues(color) {
  return { stroke: color, fill: "none" };
}

function applyTextInkColor(id, color) {
  updateShape(id, textInkAppearanceValues(color));
  _rememberDrawColors({ stroke: color });
  render();
  uiUpdate();
}

function colorForInput(color, fallback) {
  if (!color || color === "none") return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return fallback;
}

function buildSwatchesHTML(target) {
  return `<div class="prop-color-swatches" data-swatch-target="${target}">${FILL_PRESETS.map(
    (c) =>
      `<button type="button" class="prop-color-swatch" data-swatch="${c}" style="background:${c}" title="${c}"></button>`,
  ).join("")}</div>`;
}

function buildAppearanceHTML(s) {
  if (s.type === "dimension") return "";
  const parts = [];
  const hasFill = shapeSupportsFill(s.type);
  const fillNone = !s.fill || s.fill === "none";
  const fillVal = colorForInput(s.fill, DEFAULT_FILL_COLOR);
  const strokeVal = colorForInput(s.stroke, DEFAULT_STROKE_COLOR);

  if (hasFill) {
    parts.push(
      `<div class="prop-row prop-color-row">
        <label>${t("props.fill")}</label>
        <div class="prop-color-control">
          <input type="color" data-key="fill" value="${fillVal}"${fillNone ? " disabled" : ""}>
          <button type="button" class="prop-fill-toggle${fillNone ? " active" : ""}" data-fill-none="1" title="${t("props.fillNone")}">${t("props.fillNone")}</button>
        </div>
      </div>`,
      buildSwatchesHTML("fill"),
    );
  }
  parts.push(
    `<div class="prop-row prop-color-row">
      <label>${s.type === "text" ? t("props.textColor") : t("props.stroke")}</label>
      <div class="prop-color-control">
        <input type="color" data-key="stroke" value="${s.type === "text" ? colorForInput(textShapeInkColor(s), DEFAULT_STROKE_COLOR) : strokeVal}">
      </div>
    </div>`,
    buildSwatchesHTML("stroke"),
  );
  return parts.join("");
}

// 鉛筆の描画前設定（色 + 線幅）。選択が無く pencil ツール時に表示。
function buildPenSettingsHTML() {
  const state = getState();
  const strokeVal = colorForInput(state.drawStroke, DEFAULT_STROKE_COLOR);
  const pw = Number(state.penWidth ?? 1.5);
  return (
    `<div class="prop-row prop-color-row">
      <label>${t("props.stroke")}</label>
      <div class="prop-color-control">
        <input type="color" data-pen="stroke" value="${strokeVal}">
      </div>
    </div>` +
    buildSwatchesHTML("stroke") +
    `<div class="prop-row">
      <label>${stripUnitLabel(t("props.penWidth"), "mm")}</label>
      <div class="prop-unit-field">
        <input type="number" step="0.1" min="0.1" data-pen="width" value="${fmtNum(pw)}">
        <span class="prop-unit-suffix">mm</span>
      </div>
    </div>
    <input type="range" class="prop-pen-range" data-pen="width-range" min="0.3" max="6" step="0.1" value="${pw}">`
  );
}

function bindPenSettingsEvents(container) {
  const state = getState();
  const colorInp = container.querySelector('[data-pen="stroke"]');
  colorInp?.addEventListener("input", () => {
    state.drawStroke = colorInp.value;
  });
  container.querySelectorAll(".prop-color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      state.drawStroke = sw.dataset.swatch;
      if (colorInp) colorInp.value = sw.dataset.swatch;
    });
  });
  const numInp = container.querySelector('[data-pen="width"]');
  const rangeInp = container.querySelector('[data-pen="width-range"]');
  const setWidth = (v) => {
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return;
    state.penWidth = n;
    if (numInp) numInp.value = fmtNum(n);
    if (rangeInp) rangeInp.value = String(n);
  };
  numInp?.addEventListener("keydown", (e) => e.stopPropagation());
  numInp?.addEventListener("change", () => setWidth(numInp.value));
  rangeInp?.addEventListener("input", () => setWidth(rangeInp.value));
}

function buildMultiAppearanceHTML(shapeIds) {
  const shapes = shapeIds
    .map((id) => findShapeById(id)?.shape)
    .filter((s) => s && s.type !== "dimension");
  if (!shapes.length) return "";

  const fillable = shapes.filter((s) => shapeSupportsFill(s.type));
  const strokeWidthable = shapes.filter((s) => s.type !== "image");
  const fills = [...new Set(fillable.map((s) => s.fill || "none"))];
  const strokes = [
    ...new Set(shapes.map((s) => s.stroke || DEFAULT_STROKE_COLOR)),
  ];
  const strokeWidths = [
    ...new Set(strokeWidthable.map((s) => s.strokeWidth || "medium")),
  ];
  const fillNone = fills.length === 1 && fills[0] === "none";
  const fillMixed = fills.length > 1;
  const strokeMixed = strokes.length > 1;
  const strokeWidthMixed = strokeWidths.length > 1;
  const fillVal = fillMixed
    ? DEFAULT_FILL_COLOR
    : colorForInput(fills[0], DEFAULT_FILL_COLOR);
  const strokeVal = strokeMixed
    ? DEFAULT_STROKE_COLOR
    : colorForInput(strokes[0], DEFAULT_STROKE_COLOR);
  const mixedBadge = `<span class="prop-mixed-badge">${t("props.mixed")}</span>`;

  const parts = [];
  if (fillable.length) {
    parts.push(
      `<div class="prop-row prop-color-row">
        <label>${t("props.fill")}</label>
        <div class="prop-color-control">
          <input type="color" data-appearance="fill" value="${fillVal}"${fillNone ? " disabled" : ""}${fillMixed ? ' class="prop-mixed"' : ""}>
          ${fillMixed ? mixedBadge : ""}
          <button type="button" class="prop-fill-toggle${fillNone ? " active" : ""}" data-fill-none="1" title="${t("props.fillNone")}">${t("props.fillNone")}</button>
        </div>
      </div>`,
      buildSwatchesHTML("fill"),
    );
  }
  parts.push(
    `<div class="prop-row prop-color-row">
      <label>${t("props.stroke")}</label>
      <div class="prop-color-control">
        <input type="color" data-appearance="stroke" value="${strokeVal}"${strokeMixed ? ' class="prop-mixed"' : ""}>
        ${strokeMixed ? mixedBadge : ""}
      </div>
    </div>`,
    buildSwatchesHTML("stroke"),
  );
  if (strokeWidthable.length) {
    parts.push(
      strokeWidthSelectHTML(
        "data-appearance",
        strokeWidths[0],
        strokeWidthMixed,
      ),
    );
    const styles = [
      ...new Set(strokeWidthable.map((s) => s.strokeStyle || "solid")),
    ];
    parts.push(
      lineStyleSelectHTML("data-appearance", styles[0], styles.length > 1),
    );
  }
  return parts.join("");
}

// 同一タイプの複数選択時にサイズを一括編集できるフィールド定義
// key = shape プロパティ, unit = "mm"（real units 保存・mm 表示）/ "px"（変換なし）
const BULK_SIZE_FIELDS = {
  circle: [{ key: "r", label: "props.radiusMm", unit: "mm" }],
  rect: [
    { key: "width", label: "props.widthMm", unit: "mm" },
    { key: "height", label: "props.heightMm", unit: "mm" },
  ],
  ellipse: [
    { key: "rx", label: "props.rxMm", unit: "mm" },
    { key: "ry", label: "props.ryMm", unit: "mm" },
  ],
  text: [{ key: "fontSize", label: "props.fontSizePx", unit: "px" }],
};

function buildMultiSizeHTML(shapeIds) {
  const shapes = shapeIds.map((id) => findShapeById(id)?.shape).filter(Boolean);
  if (shapes.length < 2) return "";
  const types = new Set(shapes.map((s) => s.type));
  if (types.size !== 1) return ""; // 異なるタイプが混在する場合は出さない
  const fields = BULK_SIZE_FIELDS[shapes[0].type];
  if (!fields) return "";

  const rows = fields.map((f) => {
    const vals = [...new Set(shapes.map((s) => Number(s[f.key] ?? 0)))];
    const mixed = vals.length > 1;
    const label = stripUnitLabel(t(f.label), f.unit);
    const display = f.unit === "mm" ? realToMM(vals[0]) : vals[0];
    const valAttr = mixed ? "" : fmtNum(display);
    const extra = mixed
      ? ` class="prop-mixed" placeholder="${t("props.mixed")}"`
      : "";
    const unitAttr = f.unit === "mm" ? ' data-unit="mm"' : "";
    return `<div class="prop-row"><label>${label}</label><div class="prop-unit-field"><input type="number" step="0.1" data-size="${f.key}"${unitAttr}${extra} value="${valAttr}"><span class="prop-unit-suffix">${f.unit}</span></div></div>`;
  });
  return rows.join("");
}

function applySizeToSelection(key, rawValue, shapeIds, unit) {
  const value = unit === "mm" ? mmToReal(rawValue) : rawValue;
  let changed = false;
  for (const id of shapeIds) {
    const res = findShapeById(id);
    if (!res || res.isDimension) continue;
    if (res.layer?.locked || res.shape.locked) continue;
    res.shape[key] = value;
    changed = true;
  }
  if (!changed) return;
  applyConstraints(getCurrentPage());
  pushHistory();
  render();
  uiUpdate();
}

function bindSizeEvents(container, shapeIds) {
  container.querySelectorAll("[data-size]").forEach((inp) => {
    inp.addEventListener("keydown", (e) => e.stopPropagation());
    inp.addEventListener("change", () => {
      const v = parseFloat(inp.value);
      if (isNaN(v)) return;
      applySizeToSelection(inp.dataset.size, v, shapeIds, inp.dataset.unit);
    });
  });
}

function _rememberDrawColors(updates) {
  const state = getState();
  if (updates.fill !== undefined) state.drawFill = updates.fill;
  if (updates.stroke !== undefined) state.drawStroke = updates.stroke;
}

function applyAppearanceToSelection(updates, shapeIds) {
  let changed = false;
  for (const id of shapeIds) {
    const res = findShapeById(id);
    if (!res || res.isDimension) continue;
    const t = res.shape.type;
    if (updates.fill !== undefined && shapeSupportsFill(t)) {
      res.shape.fill = updates.fill;
      changed = true;
    }
    if (updates.stroke !== undefined) {
      res.shape.stroke = updates.stroke;
      if (t === "text") res.shape.fill = "none";
      changed = true;
    }
    if (updates.strokeWidth !== undefined && t !== "image") {
      res.shape.strokeWidth = updates.strokeWidth;
      changed = true;
    }
    if (updates.strokeStyle !== undefined && t !== "image") {
      res.shape.strokeStyle = updates.strokeStyle;
      changed = true;
    }
  }
  if (!changed) return;
  applyConstraints(getCurrentPage());
  _rememberDrawColors(updates);
  pushHistory();
  render();
  uiUpdate();
}

function bindAppearanceEvents(container, shapeIds) {
  const multi = shapeIds.length > 1;
  const sid = shapeIds[0];

  container.querySelectorAll("[data-fill-none]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fillInp = container.querySelector(
        multi ? '[data-appearance="fill"]' : '[data-key="fill"]',
      );
      if (btn.classList.contains("active")) {
        btn.classList.remove("active");
        if (fillInp) {
          fillInp.disabled = false;
          const color = fillInp.value || DEFAULT_FILL_COLOR;
          if (multi) applyAppearanceToSelection({ fill: color }, shapeIds);
          else {
            updateShape(sid, { fill: color });
            _rememberDrawColors({ fill: color });
            render();
            uiUpdate();
          }
        }
        return;
      }
      btn.classList.add("active");
      if (fillInp) fillInp.disabled = true;
      if (multi) applyAppearanceToSelection({ fill: "none" }, shapeIds);
      else {
        updateShape(sid, { fill: "none" });
        _rememberDrawColors({ fill: "none" });
        render();
        uiUpdate();
      }
    });
  });

  container.querySelectorAll(".prop-color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      const color = sw.dataset.swatch;
      const target = sw.closest(".prop-color-swatches")?.dataset.swatchTarget;
      if (!target) return;
      if (target === "fill") {
        const fillInp = container.querySelector(
          multi ? '[data-appearance="fill"]' : '[data-key="fill"]',
        );
        const noneBtn = container.querySelector("[data-fill-none]");
        if (fillInp) {
          fillInp.value = color;
          fillInp.disabled = false;
        }
        noneBtn?.classList.remove("active");
        if (multi) applyAppearanceToSelection({ fill: color }, shapeIds);
        else {
          updateShape(sid, { fill: color });
          _rememberDrawColors({ fill: color });
          render();
          uiUpdate();
        }
      } else if (target === "stroke") {
        const strokeInp = container.querySelector(
          multi ? '[data-appearance="stroke"]' : '[data-key="stroke"]',
        );
        if (strokeInp) strokeInp.value = color;
        if (multi) applyAppearanceToSelection({ stroke: color }, shapeIds);
        else {
          const res = findShapeById(sid);
          if (res?.shape?.type === "text") applyTextInkColor(sid, color);
          else {
            updateShape(sid, { stroke: color });
            _rememberDrawColors({ stroke: color });
            render();
            uiUpdate();
          }
        }
      }
    });
  });

  if (multi) {
    container.querySelectorAll("[data-appearance]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const key = inp.dataset.appearance;
        if (!inp.value) return; // 「混在」プレースホルダ選択時は何もしない
        if (key === "fill") {
          const noneBtn = container.querySelector("[data-fill-none]");
          noneBtn?.classList.remove("active");
          inp.disabled = false;
        }
        applyAppearanceToSelection({ [key]: inp.value }, shapeIds);
      });
    });
    return;
  }

  container.querySelectorAll('[data-key="fill"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      const noneBtn = container.querySelector("[data-fill-none]");
      noneBtn?.classList.remove("active");
      inp.disabled = false;
      updateShape(sid, { fill: inp.value });
      _rememberDrawColors({ fill: inp.value });
      render();
      uiUpdate();
    });
  });
  container.querySelectorAll('[data-key="stroke"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      const res = findShapeById(sid);
      if (res?.shape?.type === "text") applyTextInkColor(sid, inp.value);
      else {
        updateShape(sid, { stroke: inp.value });
        _rememberDrawColors({ stroke: inp.value });
        render();
        uiUpdate();
      }
    });
  });
}

function buildPropsHTML(s) {
  const geometry = [
    `<div class="prop-header"><span class="prop-type">${s.type.toUpperCase()}</span><span class="prop-id">${s.id}</span></div>`,
  ];
  let dimStyle = null;
  let dimFormat = null;
  let dimLabel = null;

  if (s.type === "line") {
    geometry.push(
      pRowMm(t("props.x1mm"), "x1", s.x1),
      pRowMm(t("props.y1mm"), "y1", s.y1),
      pRowMm(t("props.x2mm"), "x2", s.x2),
      pRowMm(t("props.y2mm"), "y2", s.y2),
    );
    geometry.push(
      pRO(
        t("props.length"),
        fmtNum(realToMM(Math.hypot(s.x2 - s.x1, s.y2 - s.y1))) + " mm",
      ),
    );
    geometry.push(
      pSel(t("props.lineCap"), "strokeLinecap", s.strokeLinecap || "butt", [
        { v: "butt", l: t("props.lineCap.butt") },
        { v: "round", l: t("props.lineCap.round") },
        { v: "square", l: t("props.lineCap.square") },
      ]),
    );
    geometry.push(
      pSel(t("props.lineRole"), "role", s.role || "drawing", [
        { v: "drawing", l: t("props.lineRole.drawing") },
        { v: "cut", l: t("props.lineRole.cut") },
        { v: "annotation", l: t("props.lineRole.annotation") },
        { v: "construction", l: t("props.lineRole.construction") },
      ]),
    );
  } else if (s.type === "rect") {
    geometry.push(
      pRowMm(t("props.xmm"), "x", s.x),
      pRowMm(t("props.ymm"), "y", s.y),
      pRowMm(t("props.widthMm"), "width", s.width),
      pRowMm(t("props.heightMm"), "height", s.height),
    );
    const indiv = s.rxMode === "individual";
    const toggleIcon = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="2"/><rect x="9" y="1" width="6" height="6" rx="0.5"/><rect x="1" y="9" width="6" height="6" rx="0.5"/><rect x="9" y="9" width="6" height="6" rx="0.5"/></svg>`;
    if (indiv) {
      geometry.push(
        `<div class="prop-row prop-corners-header"><label>${t("props.cornerRadius")}</label><button class="prop-corner-toggle active" data-rx-toggle="1" title="${t("props.cornerToggleUniform")}">${toggleIcon}</button></div>`,
      );
      geometry.push(`<div class="prop-corners-grid">
        <div class="prop-corner"><label>${t("props.corner.tl")}</label><input type="number" step="0.1" data-key="rxTL" data-unit="mm" value="${fmtNum(realToMM(s.rxTL ?? 0))}"><span class="prop-unit-suffix">mm</span></div>
        <div class="prop-corner"><label>${t("props.corner.tr")}</label><input type="number" step="0.1" data-key="rxTR" data-unit="mm" value="${fmtNum(realToMM(s.rxTR ?? 0))}"><span class="prop-unit-suffix">mm</span></div>
        <div class="prop-corner"><label>${t("props.corner.bl")}</label><input type="number" step="0.1" data-key="rxBL" data-unit="mm" value="${fmtNum(realToMM(s.rxBL ?? 0))}"><span class="prop-unit-suffix">mm</span></div>
        <div class="prop-corner"><label>${t("props.corner.br")}</label><input type="number" step="0.1" data-key="rxBR" data-unit="mm" value="${fmtNum(realToMM(s.rxBR ?? 0))}"><span class="prop-unit-suffix">mm</span></div>
      </div>`);
    } else {
      geometry.push(
        `<div class="prop-row prop-corners-header"><label>${stripUnitLabel(t("props.cornerRadius"), "mm")}</label><div class="prop-unit-field"><input type="number" step="0.1" data-key="rx" data-unit="mm" value="${fmtNum(realToMM(s.rx ?? 0))}"><span class="prop-unit-suffix">mm</span></div><button class="prop-corner-toggle" data-rx-toggle="1" title="${t("props.cornerToggleIndividual")}">${toggleIcon}</button></div>`,
      );
    }
  } else if (s.type === "image") {
    geometry.push(
      pRowMm(t("props.xmm"), "x", s.x),
      pRowMm(t("props.ymm"), "y", s.y),
      pRowMm(t("props.widthMm"), "width", s.width),
      pRowMm(t("props.heightMm"), "height", s.height),
      pRow(t("props.opacity"), "opacity", s.opacity ?? 1),
    );
    if (s.name) geometry.push(pRO(t("props.imageName"), s.name));
    if (s.storageBytes) {
      const storage = formatFileSize(s.storageBytes);
      const original = s.originalBytes ? formatFileSize(s.originalBytes) : "";
      geometry.push(
        pRO(
          t("props.imageStorage"),
          original && original !== storage
            ? `${storage} / ${original}`
            : storage,
        ),
      );
    }
  } else if (s.type === "circle") {
    geometry.push(
      pRowMm(t("props.cxMm"), "cx", s.cx),
      pRowMm(t("props.cyMm"), "cy", s.cy),
      pRowMm(t("props.radiusMm"), "r", s.r),
      pRO(t("props.diameter"), fmtNum(realToMM(s.r) * 2) + " mm"),
    );
  } else if (s.type === "ellipse") {
    geometry.push(
      pRowMm(t("props.cxMm"), "cx", s.cx),
      pRowMm(t("props.cyMm"), "cy", s.cy),
      pRowMm(t("props.rxMm"), "rx", s.rx),
      pRowMm(t("props.ryMm"), "ry", s.ry),
    );
  } else if (s.type === "text") {
    const alignOpts = [
      { v: "left", l: t("props.textAlign.left") },
      { v: "center", l: t("props.textAlign.center") },
      { v: "right", l: t("props.textAlign.right") },
    ];
    const weightOpts = [
      { v: "normal", l: t("props.fontWeight.normal") },
      { v: "bold", l: t("props.fontWeight.bold") },
    ];
    geometry.push(
      pRowMm(t("props.xmm"), "x", s.x),
      pRowMm(t("props.ymm"), "y", s.y),
      pRowMm(t("props.widthMm"), "width", s.width ?? 500),
      pRow(t("props.text"), "text", s.text || "", "textarea"),
      pRowUnit(t("props.fontSizePx"), "fontSize", s.fontSize ?? 3.5, "px"),
      pRow(t("props.lineHeight"), "lineHeight", s.lineHeight ?? 1, "number"),
      buildFontFamilySelect(
        "fontFamily",
        s.fontFamily || DEFAULT_TEXT_FONT_FAMILY,
      ),
      pSel(
        t("props.fontWeight"),
        "fontWeight",
        s.fontWeight || "normal",
        weightOpts,
      ),
      pSel(t("props.textAlign"), "textAlign", s.textAlign || "left", alignOpts),
    );
    const outlineAvail =
      typeof isTextOutlineAvailable === "function" && isTextOutlineAvailable();
    geometry.push(
      `<div class="prop-multi-actions"><button id="btn-text-edit">${t("props.textEdit")}</button><button id="btn-text-outline"${
        outlineAvail
          ? ""
          : ` disabled title="${t("props.textOutlineDisabled")}"`
      }>${t("props.textOutline")}</button></div>`,
    );
  } else if (s.type === "path") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const poly of s.contours)
      for (const ring of poly)
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
    const wMM = isFinite(minX) ? fmtNum(realToMM(maxX - minX)) : "0";
    const hMM = isFinite(minY) ? fmtNum(realToMM(maxY - minY)) : "0";
    geometry.push(pRowUnit(t("props.widthMm"), "path-w", wMM, "mm"));
    geometry.push(pRowUnit(t("props.heightMm"), "path-h", hMM, "mm"));
    geometry.push(`<div class="prop-row">
        <label>${t("props.filletRadiusMm")}</label>
        <div class="prop-unit-field"><input type="number" id="fillet-radius" step="0.1" min="0" value="1"><span class="prop-unit-suffix">mm</span></div>
      </div>
      <div class="prop-row">
        <label></label>
        <button type="button" id="btn-apply-fillet" class="prop-btn">${t("props.applyFillet")}</button>
        <button type="button" id="btn-apply-chamfer" class="prop-btn">${t("props.applyChamfer")}</button>
      </div>`);
  } else if (s.type === "bezier") {
    const bb = bezierBBox(s, { numerator: 1, denominator: 1 });
    const wMM = bb ? fmtNum(realToMM(bb.w)) : "0";
    const hMM = bb ? fmtNum(realToMM(bb.h)) : "0";
    geometry.push(
      `<div class="prop-row"><label>${t("props.nodeCount")}</label><span>${s.nodes.length}</span></div>`,
    );
    geometry.push(
      `<div class="prop-row prop-readonly"><label>${t("props.widthMm")}</label><span>${wMM}</span></div>`,
    );
    geometry.push(
      `<div class="prop-row prop-readonly"><label>${t("props.heightMm")}</label><span>${hMM}</span></div>`,
    );
  } else if (s.type === "pencil") {
    geometry.push(
      `<div class="prop-row prop-readonly"><label>${t("props.pointCount")}</label><span>${(s.points || []).length}</span></div>`,
      `<div class="prop-row"><label>${stripUnitLabel(t("props.penWidth"), "mm")}</label><div class="prop-unit-field"><input type="number" step="0.1" min="0.1" data-key="penWidth" value="${fmtNum(s.penWidth ?? 1.5)}"><span class="prop-unit-suffix">mm</span></div></div>`,
    );
  } else if (s.type === "dimension") {
    const hasLabelOffset =
      (s.textOffsetX || 0) !== 0 || (s.textOffsetY || 0) !== 0;
    const arrowOpts = [
      { v: "dot", l: t("props.arrow.dot") },
      { v: "arrow", l: t("props.arrow.arrow") },
      { v: "slash", l: t("props.arrow.slash") },
      { v: "open", l: t("props.arrow.open") },
    ];
    const autoValMM = realToMM(dimensionRealDistance(s));
    const isOverridden =
      s.value !== undefined && Math.abs(dimensionValueMM(s) - autoValMM) > 0.01;
    geometry.push(
      `<div class="prop-row prop-readonly"><label>${t("props.autoValue")}</label><span>${fmtNum(autoValMM)} mm</span></div>`,
      `<div class="prop-row">
        <label>${t("props.overrideValue")}</label>
        <input type="number" step="0.1" data-key="value" value="${s.value ?? ""}" placeholder="${t("props.overridePlaceholder")}" style="${isOverridden ? "color:#e55;" : ""}">
      </div>`,
      pRO(t("props.direction"), s.dimensionType),
      pRowMm(t("props.fromXmm"), "from.x", s.from.x),
      pRowMm(t("props.fromYmm"), "from.y", s.from.y),
      pRowMm(t("props.toXmm"), "to.x", s.to.x),
      pRowMm(t("props.toYmm"), "to.y", s.to.y),
      pRowMm(t("props.offset"), "offset", s.offset ?? -80),
    );
    dimStyle = [
      pSel(t("props.arrow"), "arrowStyle", s.arrowStyle || "dot", arrowOpts),
      `<div class="prop-row"><label>${t("props.dimColor")}</label><input type="color" data-key="color" value="${s.color || "#1a1a2e"}"></div>`,
      pRowUnit(t("props.lineWidthMm"), "lineWidth", s.lineWidth ?? 0.25, "mm"),
      pRowUnit(t("props.textSizeMm"), "textSize", s.textSize ?? 3.0, "mm"),
    ];
    dimFormat = [
      `<div class="prop-row"><label>${t("props.prefix")}</label><input type="text" data-key="prefix" value="${s.prefix || ""}" placeholder="${t("props.prefixPlaceholder")}"></div>`,
      `<div class="prop-row"><label>${t("props.suffix")}</label><input type="text" data-key="suffix" value="${s.suffix || ""}" placeholder="${t("props.suffixPlaceholder")}"></div>`,
      pRow(t("props.decimals"), "decimals", s.decimals ?? 0),
    ];
    dimLabel = [
      pRowMm(t("props.textOffsetX"), "textOffsetX", s.textOffsetX ?? 0),
      pRowMm(t("props.textOffsetY"), "textOffsetY", s.textOffsetY ?? 0),
      pRowUnit(
        t("props.textRotation"),
        "textRotation",
        s.textRotation ?? 0,
        "°",
      ),
      `<div class="prop-row">
        <label></label>
        <button id="btn-dim-label-reset" class="prop-btn${hasLabelOffset ? "" : " prop-btn-disabled"}" ${hasLabelOffset ? "" : "disabled"}>${t("props.dimLabelReset")}</button>
      </div>`,
      `<div class="prop-row">
        <label></label>
        <button id="btn-dim-value-reset" class="prop-btn${isOverridden ? "" : " prop-btn-disabled"}" ${isOverridden ? "" : "disabled"}>${t("props.dimValueReset")}</button>
      </div>`,
    ];
  }

  if (s.type !== "dimension" && s.type !== "image" && s.type !== "pencil") {
    geometry.push(strokeWidthSelectHTML("data-key", s.strokeWidth, false));
    geometry.push(lineStyleSelectHTML("data-key", s.strokeStyle, false));
  }

  const sections = [
    panelSectionHTML(
      "panel.design.props",
      t("props.shape." + s.type),
      geometry.join(""),
      true,
    ),
  ];

  if (s.type !== "dimension" && s.type !== "image") {
    sections.push(
      panelSectionHTML(
        "panel.design.appearance",
        t("panel.design.appearance"),
        buildAppearanceHTML(s),
        true,
      ),
    );
  } else if (s.type === "dimension") {
    sections.push(
      panelSectionHTML(
        "panel.design.dim-style",
        t("panel.design.dimStyle"),
        dimStyle.join(""),
        true,
      ),
      panelSectionHTML(
        "panel.design.dim-format",
        t("panel.design.dimFormat"),
        dimFormat.join(""),
        false,
      ),
      panelSectionHTML(
        "panel.design.dim-label",
        t("panel.design.dimLabel"),
        dimLabel.join(""),
        false,
      ),
    );
  }

  if (SOLID_INTERSECT_TYPES.has(s.type)) {
    sections.push(
      panelSectionHTML(
        "panel.design.solid3d",
        t("panel.design.solid3d"),
        `<label class="prop-checkbox-row"><input type="checkbox" id="prop-solid-intersect"${s.solidIntersect ? " checked" : ""}/> <span>${t("props.solidIntersect")}</span></label>
        <p class="prop-hint">${t("props.solidIntersectHint")}</p>`,
        false,
      ),
    );
  }

  sections.push(
    panelSectionHTML(
      "panel.design.duplicate",
      t("panel.design.duplicate"),
      _buildTransformSectionBodyHTML(),
      false,
    ),
  );

  return sections.join("");
}

// solidIntersect トグルを出す対象（Profile になれる図形のみ）。
const SOLID_INTERSECT_TYPES = new Set(["rect", "circle", "path", "bezier"]);

function setCustomSelect(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.value = v;
  const opt = el.querySelector(
    `.custom-select-option[data-value="${CSS.escape(v)}"]`,
  );
  el.querySelector(".custom-select-label").textContent = opt
    ? opt.textContent
    : t("view.type." + v);
  el.querySelectorAll(".custom-select-option").forEach((o) =>
    o.classList.toggle("selected", o.dataset.value === v),
  );
}
function bindCustomSelect(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    const opt = e.target.closest(".custom-select-option");
    if (opt) {
      e.stopPropagation();
      if (
        opt.classList.contains("disabled") ||
        opt.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }
      setCustomSelect(id, opt.dataset.value);
      el.classList.remove("open");
      handler(opt.dataset.value);
      return;
    }
    e.stopPropagation();
    const isOpen = el.classList.contains("open");
    document
      .querySelectorAll(".custom-select.open")
      .forEach((s) => s.classList.remove("open"));
    if (!isOpen) el.classList.add("open");
  });
}
document.addEventListener("click", () => {
  document
    .querySelectorAll(".custom-select.open")
    .forEach((s) => s.classList.remove("open"));
});
// viewDefinition.type に対応する3D法線・up ベクトルのプリセット
const VIEW_DEFINITION_PRESETS = {
  top: { normal: [0, 0, 1], up: [0, 1, 0] },
  bottom: { normal: [0, 0, -1], up: [0, 1, 0] },
  front: { normal: [0, -1, 0], up: [0, 0, 1] },
  back: { normal: [0, 1, 0], up: [0, 0, 1] },
  right: { normal: [1, 0, 0], up: [0, 0, 1] },
  left: { normal: [-1, 0, 0], up: [0, 0, 1] },
  section: { normal: null, up: null },
  detail: { normal: null, up: null },
};

// ── Undo 履歴パネル ────────────────────────────────────────────
function updateHistoryPanel() {
  const panel = document.getElementById("history-panel");
  if (!panel) return;

  const labels = getHistoryLabels();
  const curIdx = getHistoryIndex();

  if (!labels.length) {
    panel.innerHTML = `<p class="prop-empty">${t("props.noHistory")}</p>`;
    return;
  }

  // 新しい順（末尾→先頭）に表示
  const items = labels
    .map((label, idx) => {
      const isCurrent = idx === curIdx;
      const isFuture = idx > curIdx;
      const displayLabel = translateHistoryLabel(label);
      return `<div class="history-item${isCurrent ? " history-current" : ""}${isFuture ? " history-future" : ""}"
                 data-hist-idx="${idx}" title="${displayLabel}">
      <span class="history-badge${isCurrent ? "" : " history-badge-hidden"}"></span>
      <span class="history-num">${idx}</span>
      <span class="history-label">${displayLabel}</span>
    </div>`;
    })
    .reverse()
    .join("");

  panel.innerHTML = `
    <div class="history-header">
      <span>${t("history.header", { current: curIdx + 1, total: labels.length })}</span>
    </div>
    <div class="history-list">${items}</div>
  `;

  // クリックでジャンプ
  panel.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.histIdx, 10);
      if (jumpToHistory(idx)) {
        render();
        updateAll();
      }
    });
  });
}

// ── 配列複製 UI ───────────────────────────────────────────────
function _buildArrayDuplicateHTML() {
  const body = `
    <div class="prop-row">
      <label>${t("props.array.mode")}</label>
      <select id="array-dup-mode">
        <option value="linear">${t("props.array.mode.linear")}</option>
        <option value="polar">${t("props.array.mode.polar")}</option>
        <option value="grid">${t("props.array.mode.grid")}</option>
      </select>
    </div>
    <div id="array-dup-params-linear">
      <div class="prop-row"><label>${t("props.array.count")}</label><input type="number" id="array-dup-count" value="3" min="1" step="1"></div>
      ${pRowUnitById(t("props.array.dx"), "array-dup-dx", "0", "mm", 'step="0.1"')}
      ${pRowUnitById(t("props.array.dy"), "array-dup-dy", "100", "mm", 'step="0.1"')}
    </div>
    <div id="array-dup-params-polar" style="display:none">
      <div class="prop-row"><label>${t("props.array.count")}</label><input type="number" id="array-dup-polar-count" value="6" min="2" step="1"></div>
      ${pRowUnitById(t("props.array.cx"), "array-dup-cx", "0", "mm", 'step="0.1"')}
      ${pRowUnitById(t("props.array.cy"), "array-dup-cy", "0", "mm", 'step="0.1"')}
      ${pRowUnitById(t("props.array.angle"), "array-dup-angle", "", "°", `placeholder="${t("props.array.anglePlaceholder")}" step="1"`)}
    </div>
    <div id="array-dup-params-grid" style="display:none">
      <div class="prop-row"><label>${t("props.array.cols")}</label><input type="number" id="array-dup-cols" value="3" min="1" step="1"></div>
      <div class="prop-row"><label>${t("props.array.rows")}</label><input type="number" id="array-dup-rows" value="3" min="1" step="1"></div>
      ${pRowUnitById(t("props.array.dx"), "array-dup-grid-dx", "100", "mm", 'step="0.1"')}
      ${pRowUnitById(t("props.array.dy"), "array-dup-grid-dy", "100", "mm", 'step="0.1"')}
    </div>
    <div class="prop-multi-actions">
      <button id="btn-array-duplicate">${t("props.array.run")}</button>
    </div>`;
  return panelSectionHTML(
    "panel.design.array",
    t("panel.design.array"),
    body,
    false,
  );
}

function _bindArrayDuplicateEvents(container) {
  const modeSelect = container.querySelector("#array-dup-mode");
  const paramsLinear = container.querySelector("#array-dup-params-linear");
  const paramsPolar = container.querySelector("#array-dup-params-polar");
  const paramsGrid = container.querySelector("#array-dup-params-grid");

  function showParams(mode) {
    paramsLinear.style.display = mode === "linear" ? "" : "none";
    paramsPolar.style.display = mode === "polar" ? "" : "none";
    paramsGrid.style.display = mode === "grid" ? "" : "none";
  }

  modeSelect?.addEventListener("change", () => showParams(modeSelect.value));

  container
    .querySelector("#btn-array-duplicate")
    ?.addEventListener("click", () => {
      const mode = modeSelect?.value || "linear";
      const opts = { mode };

      if (mode === "linear") {
        opts.count =
          parseInt(container.querySelector("#array-dup-count")?.value) || 3;
        opts.dx =
          parseFloat(container.querySelector("#array-dup-dx")?.value) || 0;
        opts.dy =
          parseFloat(container.querySelector("#array-dup-dy")?.value) || 0;
      } else if (mode === "polar") {
        opts.count =
          parseInt(container.querySelector("#array-dup-polar-count")?.value) ||
          6;
        opts.cx =
          parseFloat(container.querySelector("#array-dup-cx")?.value) || 0;
        opts.cy =
          parseFloat(container.querySelector("#array-dup-cy")?.value) || 0;
        const angleVal = container.querySelector("#array-dup-angle")?.value;
        if (angleVal !== "") opts.angle = parseFloat(angleVal);
      } else if (mode === "grid") {
        opts.cols =
          parseInt(container.querySelector("#array-dup-cols")?.value) || 3;
        opts.rows =
          parseInt(container.querySelector("#array-dup-rows")?.value) || 3;
        opts.dx =
          parseFloat(container.querySelector("#array-dup-grid-dx")?.value) ||
          100;
        opts.dy =
          parseFloat(container.querySelector("#array-dup-grid-dy")?.value) ||
          100;
      }

      const newIds = arrayDuplicate(opts);
      if (newIds.length) {
        render();
        uiUpdate();
      }
    });
}

function updatePageSettings() {
  updatePageSettingsLabels();
}

function updateProjectFontsPanel() {
  const list = document.getElementById("project-fonts-list");
  const libList = document.getElementById("font-library-list");
  const err = document.getElementById("project-font-error");
  if (!list) return;
  const fonts = getProjectFonts();
  list.innerHTML = "";
  if (!fonts.length) {
    const li = document.createElement("li");
    li.className = "project-font-empty";
    li.textContent = t("font.noneRegistered");
    list.appendChild(li);
  } else {
    for (const f of fonts) {
      const li = document.createElement("li");
      li.className = "project-font-item";
      li.innerHTML = `<span class="project-font-name">${String(f.family).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span><button type="button" class="project-font-remove" data-font-id="${f.id}" title="${t("font.remove")}">×</button>`;
      list.appendChild(li);
    }
  }
  if (libList) {
    const library =
      typeof getFontLibraryFonts === "function" ? getFontLibraryFonts() : [];
    libList.innerHTML = "";
    if (!library.length) {
      const li = document.createElement("li");
      li.className = "project-font-empty";
      li.textContent = t("font.libraryEmpty");
      libList.appendChild(li);
    } else {
      for (const f of library) {
        const inProject = fonts.some(
          (p) => p.family.toLowerCase() === String(f.family).toLowerCase(),
        );
        const li = document.createElement("li");
        li.className = "project-font-item font-library-item";
        li.innerHTML =
          `<span class="project-font-name">${String(f.family).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>` +
          (inProject
            ? `<span class="font-library-badge">${t("font.inUse")}</span>`
            : `<button type="button" class="font-library-add" data-library-id="${f.id}" title="${t("font.addToProject")}">＋</button>`) +
          `<button type="button" class="project-font-remove font-library-remove" data-library-id="${f.id}" title="${t("font.removeFromLibrary")}">×</button>`;
        libList.appendChild(li);
      }
    }
  }
  if (err && document.activeElement?.id !== "project-font-url") {
    err.textContent = "";
    err.hidden = true;
  }
}

function bindProjectFonts() {
  const input = document.getElementById("project-font-url");
  const btn = document.getElementById("project-font-add-btn");
  const browseBtn = document.getElementById("project-font-browse-btn");
  const list = document.getElementById("project-fonts-list");
  const libList = document.getElementById("font-library-list");
  const err = document.getElementById("project-font-error");
  if (!input || !btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";

  const setError = (message) => {
    if (!err) return;
    err.textContent = message || "";
    err.hidden = !message;
  };

  const submit = async () => {
    const url = input.value.trim();
    if (!url) {
      setError(t("font.urlRequired"));
      return;
    }
    btn.disabled = true;
    setError("");
    try {
      await registerGoogleFontCssUrl(url);
      input.value = "";
      setError("");
      updateProjectFontsPanel();
      updatePropertiesPanel();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener("click", () => {
    submit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  });
  browseBtn?.addEventListener("click", () => {
    if (typeof openFontBrowserModal === "function") {
      openFontBrowserModal({ addToProject: true });
    }
  });
  list?.addEventListener("click", (e) => {
    const rm = e.target.closest(".project-font-remove");
    if (!rm) return;
    removeProjectFont(rm.dataset.fontId);
    updateProjectFontsPanel();
    updatePropertiesPanel();
    render();
  });
  libList?.addEventListener("click", async (e) => {
    const addBtnEl = e.target.closest(".font-library-add");
    if (addBtnEl) {
      setError("");
      try {
        await addLibraryFontToProject(addBtnEl.dataset.libraryId);
        updateProjectFontsPanel();
        updatePropertiesPanel();
        render();
      } catch (errAdd) {
        setError(errAdd.message || String(errAdd));
      }
      return;
    }
    const rmLib = e.target.closest(".font-library-remove");
    if (!rmLib) return;
    await removeLibraryFont(rmLib.dataset.libraryId);
    updateProjectFontsPanel();
  });
}

function bindPageSettings() {
  bindCustomSelect("page-current", (v) => {
    activatePage(v);
  });
  bindCustomSelect("page-add-view", (v) => {
    addViewPage(v);
  });
  bindCustomSelect("page-paper", (v) => {
    updatePage(getCurrentPage().id, { paper: v });
    render();
    updateAll();
  });
  bindCustomSelect("page-orientation", (v) => {
    updatePage(getCurrentPage().id, { orientation: v });
    render();
    updateAll();
  });
  bindCustomSelect("page-scale", (v) => {
    const [n, d] = v.split("/").map(Number);
    updatePage(getCurrentPage().id, {
      scale: { numerator: n, denominator: d },
    });
    localStorage.setItem("millrect-last-scale", v);
    if (typeof refreshAllTextNativePreviews === "function") {
      refreshAllTextNativePreviews();
    }
    fitPage();
    render();
    updateAll();
  });
  bindLocaleSettings();
  bindCustomSelect("grid-size", (v) => {
    getState().gridSize = parseFloat(v);
    render();
  });
  document.getElementById("snap-enabled")?.addEventListener("change", (e) => {
    getState().snapEnabled = e.target.checked;
  });
  document.getElementById("show-grid")?.addEventListener("change", (e) => {
    getState().showGrid = e.target.checked;
    render();
  });
  document
    .getElementById("show-view-guides")
    ?.addEventListener("change", (e) => {
      getState().showViewGuides = e.target.checked;
      render();
    });
}

function bindReferenceImageSettings() {
  const fileInput = document.getElementById("ref-image-file");
  const loadBtn = document.getElementById("ref-image-load-btn");
  const editBtn = document.getElementById("ref-image-edit-btn");
  const opacityInput = document.getElementById("ref-image-opacity");
  const scaleBtn = document.getElementById("ref-image-scale-btn");
  const clearBtn = document.getElementById("ref-image-clear-btn");
  const scaleApply = document.getElementById("ref-image-scale-apply");
  const scaleCancel = document.getElementById("ref-image-scale-cancel");
  const lengthInput = document.getElementById("ref-image-length-mm");
  const digitizeConfirm = document.getElementById("ref-image-digitize-confirm");
  const digitizeClear = document.getElementById("ref-image-digitize-clear");

  if (!fileInput || fileInput.dataset.bound) return;
  fileInput.dataset.bound = "1";

  loadBtn?.addEventListener("click", () => fileInput.click());

  editBtn?.addEventListener("click", () => {
    if (typeof selectReferenceImageForEdit === "function") {
      selectReferenceImageForEdit();
      updateReferenceImagePanel();
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = async () => {
        const widthMm = 120;
        const aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
        const heightMm = Math.max(1, widthMm * aspect);
        await setReferenceImage(null, {
          dataUrl,
          widthMm,
          heightMm,
          opacity: parseFloat(opacityInput?.value) || 0.45,
        });
        fileInput.value = "";
        updateReferenceImagePanel();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  opacityInput?.addEventListener("input", () => {
    const page = getCurrentPage();
    if (!page?.referenceImage) return;
    page.referenceImage.opacity = parseFloat(opacityInput.value) || 0.45;
    render();
  });

  opacityInput?.addEventListener("change", () => {
    const page = getCurrentPage();
    if (!page?.referenceImage) return;
    pushHistory();
  });

  scaleBtn?.addEventListener("click", () => {
    beginReferenceScaleAnchor(null);
    updateReferenceImagePanel();
  });

  clearBtn?.addEventListener("click", () => {
    clearReferenceImage(null);
    updateReferenceImagePanel();
  });

  scaleApply?.addEventListener("click", () => {
    const len = lengthInput?.value;
    const result = completeReferenceScaleAnchor(len);
    if (!result.ok && result.error) {
      const status = document.getElementById("ref-image-scale-status");
      if (status) status.textContent = result.error;
    }
    updateReferenceImagePanel();
  });

  lengthInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") scaleApply?.click();
  });

  scaleCancel?.addEventListener("click", () => {
    cancelReferenceScaleAnchor();
    updateReferenceImagePanel();
  });

  digitizeConfirm?.addEventListener("click", () => {
    confirmDigitizeProposals(null);
    updateReferenceImagePanel();
  });

  digitizeClear?.addEventListener("click", () => {
    clearDigitizeProposals(null);
    updateReferenceImagePanel();
  });
}

function updateReferenceImagePanel() {
  const ref = getReferenceImage?.();
  const ghosts = getDigitizeProposals?.() ?? [];
  const anchor = getReferenceScaleAnchorState?.();

  const opacityRow = document.getElementById("ref-image-opacity-row");
  const actions = document.getElementById("ref-image-actions");
  const opacityInput = document.getElementById("ref-image-opacity");
  const scalePanel = document.getElementById("ref-image-scale-panel");
  const lengthRow = document.getElementById("ref-image-length-row");
  const status = document.getElementById("ref-image-scale-status");
  const digitizePanel = document.getElementById("ref-image-digitize-panel");
  const digitizeCount = document.getElementById("ref-image-digitize-count");

  const hasRef = Boolean(ref?.hasData);
  const editRow = document.getElementById("ref-image-edit-row");
  const editBtn = document.getElementById("ref-image-edit-btn");
  const selected =
    typeof isReferenceImageSelected === "function" &&
    isReferenceImageSelected();

  if (opacityRow) opacityRow.hidden = !hasRef;
  if (actions) actions.hidden = !hasRef || selected;
  if (editRow) editRow.hidden = !hasRef;
  if (editBtn) {
    editBtn.classList.toggle("active", selected);
    editBtn.setAttribute("aria-pressed", selected ? "true" : "false");
  }
  if (opacityInput && ref) opacityInput.value = String(ref.opacity ?? 0.45);

  if (scalePanel) {
    const active = Boolean(anchor);
    scalePanel.hidden = !active;
    if (active && status) {
      const key =
        anchor.step === "from"
          ? "refImage.scaleStep.from"
          : anchor.step === "to"
            ? "refImage.scaleStep.to"
            : "refImage.scaleStep.length";
      status.textContent = t(key);
    }
    if (lengthRow) lengthRow.hidden = anchor?.step !== "length";
  }

  if (digitizePanel) {
    digitizePanel.hidden = ghosts.length === 0;
    if (digitizeCount && ghosts.length) {
      digitizeCount.textContent = t("refImage.ghostCount", {
        count: ghosts.length,
      });
    }
  }
}

function bindKeyShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable ||
      (typeof _textEditorActive !== "undefined" && _textEditorActive)
    )
      return;
    const map = {
      v: "select",
      V: "select",
      l: "line",
      L: "line",
      r: "rect",
      R: "rect",
      c: "circle",
      C: "circle",
      t: "text",
      T: "text",
      d: "dimension",
      D: "dimension",
      h: "hand",
      H: "hand",
      p: "pencil",
      P: "pencil",
      b: "bezier",
      B: "bezier",
      m: "measure",
      M: "measure",
    };
    if (map[e.key] && !e.ctrlKey && !e.metaKey) {
      cancelDim();
      if (typeof cancelMeasure === "function") cancelMeasure();
      const tool = map[e.key];
      getState().activeTool = tool;
      if (typeof onActiveToolChanged === "function") {
        onActiveToolChanged(tool);
      }
      if (typeof window.dataLayer !== "undefined") {
        window.dataLayer.push({ event: "tool_selected", tool_name: tool });
      }
      updateToolbar();
      updatePropertiesPanel();
      const el = document.getElementById("status-tool");
      if (el) el.textContent = TOOL_INFO[map[e.key]] || map[e.key];
      _updateMeasureStatusVisibility(tool);
      return;
    }
    // Shift 併用時は e.key が "Z" になるため小文字化して比較（⌘⇧Z の Redo）
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey
        ? redo() && (cancelDim(), render(), updateAll())
        : undo() && (cancelDim(), render(), updateAll());
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo() && (cancelDim(), render(), updateAll());
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      doAutosave();
    }
    if (e.altKey && e.shiftKey && BOOLEAN_KEY_MAP[e.code]) {
      e.preventDefault();
      runBooleanShortcut(e.code);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      if (!getState().selectedShapeIds.length) return;
      e.preventDefault();
      copyShapes();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
      pasteShapes();
      render();
      uiUpdate();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      if (!getState().selectedShapeIds.length) return;
      e.preventDefault();
      duplicateShapes();
      render();
      uiUpdate();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      const st = getState();
      const _p = getCurrentPage();
      st.selectedShapeIds = [
        ...getAllShapesOnPage(_p).map((s) => s.id),
        ...getAllDimensionsOnPage(_p).map((d) => d.id),
      ];
      render();
      uiUpdate();
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "g") {
      e.preventDefault();
      if (getState().selectedShapeIds.length >= 2) {
        groupSelectedShapes();
        render();
        uiUpdate();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "g") {
      e.preventDefault();
      const sel = getState().selectedShapeIds;
      if (sel.length === 1) {
        const r = findShapeById(sel[0]);
        if (r && r.shape.type === "group") {
          ungroupSelectedShapes();
          render();
          uiUpdate();
        }
      }
    }
    const arrowMap = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (arrowMap[e.key] && getState().selectedShapeIds.length > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 100 : 10;
      const [dx, dy] = arrowMap[e.key].map((v) => v * step);
      const page = getCurrentPage();
      for (const id of getState().selectedShapeIds) {
        for (const layer of page.layers) {
          const s = layer.shapes.find((sh) => sh.id === id);
          if (s) {
            shiftShape(s, dx, dy);
            break;
          }
        }
      }
      pushHistory();
      render();
      uiUpdate();
    }
  });
}

// ── Entry point ───────────────────────────────────────────────
function _canvasSize() {
  const el =
    document.getElementById("canvas-container") ||
    document.getElementById("main-svg");
  if (el) return { cw: el.clientWidth, ch: el.clientHeight };
  return { cw: window.innerWidth - 420, ch: window.innerHeight - 80 };
}

function _leftOffset() {
  const tf = document.getElementById("tools-float");
  const cc =
    document.getElementById("canvas-container") ||
    document.getElementById("main-svg");
  if (tf && cc && !tf.classList.contains("panel-hidden")) {
    const tfR = tf.getBoundingClientRect().right;
    const ccL = cc.getBoundingClientRect().left;
    return Math.max(0, tfR - ccL + 16);
  }
  return 0;
}

function _rightOffset() {
  const sr = document.getElementById("sidebar-right");
  return sr ? sr.offsetWidth + 16 : 0;
}

function fitPage() {
  const state = getState();
  const page = getCurrentPage();
  const dims = getPaperDimensions(page);
  const { cw, ch } = _canvasSize();
  const leftOff = _leftOffset();
  const rightOff = _rightOffset();
  const margin = 40;
  const availW = cw - leftOff - rightOff - margin * 2;
  const availH = ch - margin * 2;
  const zoom = Math.min(availW / dims.width, availH / dims.height);
  state.zoom = Math.max(0.1, zoom);
  state.panX = leftOff + margin + (availW - dims.width * state.zoom) / 2;
  state.panY = margin + (availH - dims.height * state.zoom) / 2;
}

function centerPaper() {
  const state = getState();
  const page = getCurrentPage();
  const dims = getPaperDimensions(page);
  const { cw, ch } = _canvasSize();
  const leftOff = _leftOffset();
  const pw = dims.width * state.zoom;
  const ph = dims.height * state.zoom;
  state.panX = Math.max(leftOff + 16, leftOff + (cw - leftOff - pw) / 2);
  state.panY = Math.max(40, (ch - ph) / 2);
}

document.addEventListener("keydown", (e) => {
  const inp = e.target;
  if (inp.tagName !== "INPUT" || inp.type !== "number") return;
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  const delta = e.key === "ArrowUp" ? 1 : -1;
  const parts = inp.value.split(".");
  const newInt = (parseInt(parts[0], 10) || 0) + delta;
  inp.value = parts.length > 1 ? `${newInt}.${parts[1]}` : String(newInt);
  inp.dispatchEvent(new Event("change", { bubbles: true }));
});

function _fmtDate(ts) {
  const d = new Date(ts);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${Y}/${M}/${D} ${h}:${m}`;
}

function bindLocaleSettings() {
  bindCustomSelect("app-locale", (v) => {
    setLocale(v);
  });
  bindCustomSelect("toolbar-locale", (v) => {
    setLocale(v);
  });
}

function updatePageSettingsLabels() {
  syncLocaleSelectLabels();
  const page = getCurrentPage();
  if (!page) return;
  updatePageCurrentOptions();
  setCustomSelect("page-paper", page.paper);
  setCustomSelect("page-orientation", page.orientation);
  setCustomSelect(
    "page-scale",
    `${page.scale.numerator}/${page.scale.denominator}`,
  );
  resetAddViewSelect();
  updateAddViewOptionLabels();
  updateOrientationOptionLabels();
}

function updatePageCurrentOptions() {
  const sel = document.getElementById("page-current");
  if (!sel) return;
  const popover = sel.querySelector(".custom-select-popover");
  const label = sel.querySelector(".custom-select-label");
  const state = getState();
  if (!popover || !label) return;
  popover.innerHTML = "";
  if (!state.pages?.length) {
    sel.dataset.value = "";
    label.textContent = t("page.current.empty");
    return;
  }
  for (const page of state.pages) {
    const opt = document.createElement("div");
    opt.className = "custom-select-option";
    opt.dataset.value = page.id;
    opt.textContent = pageCurrentLabel(page);
    opt.classList.toggle("selected", page.id === state.currentPageId);
    popover.appendChild(opt);
  }
  setCustomSelect("page-current", state.currentPageId);
}

function pageCurrentLabel(page) {
  const viewType = page.viewDefinition?.type || "top";
  return `${page.name} (${viewType})`;
}

function resetAddViewSelect() {
  const sel = document.getElementById("page-add-view");
  if (!sel) return;
  sel.dataset.value = "";
  const label = sel.querySelector(".custom-select-label");
  if (label) label.textContent = t("page.addView.placeholder");
  sel.querySelectorAll(".custom-select-option").forEach((opt) => {
    const exists = pageViewTypeExists(opt.dataset.value);
    opt.classList.remove("selected");
    opt.classList.toggle("disabled", exists);
    opt.setAttribute("aria-disabled", exists ? "true" : "false");
    opt.title = exists ? t("page.addView.exists") : "";
  });
}

function syncLocaleSelectLabels() {
  ["app-locale", "toolbar-locale"].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    setCustomSelect(id, getLocale());
    const label = btn.querySelector(".custom-select-label");
    if (label) label.textContent = t("page.language." + getLocale());
  });
}

function updateAddViewOptionLabels() {
  const sel = document.getElementById("page-add-view");
  if (!sel) return;
  sel.querySelectorAll(".custom-select-option").forEach((opt) => {
    const v = opt.dataset.value;
    const key = "view.add." + v;
    opt.textContent = t(key);
  });
  const label = sel.querySelector(".custom-select-label");
  if (label) label.textContent = t("page.addView.placeholder");
}

function updateOrientationOptionLabels() {
  const sel = document.getElementById("page-orientation");
  if (!sel) return;
  sel.querySelectorAll(".custom-select-option").forEach((opt) => {
    opt.textContent = t("page.orientation." + opt.dataset.value);
  });
  const label = sel.querySelector(".custom-select-label");
  if (label)
    label.textContent = t(
      "page.orientation." + (sel.dataset.value || "landscape"),
    );
}

function showProjectList() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "startup-overlay";
    overlay.innerHTML = `
      <div id="startup-dialog" class="project-list-dialog">
        <div class="pl-header">
          <h2>${t("startup.title")}</h2>
          <p class="pl-subtitle">${t("startup.subtitle")}</p>
          <button id="pl-btn-close" class="pl-btn-close" aria-label="閉じる">✕</button>
        </div>
        <div class="pl-actions">
          <button id="pl-btn-new" class="startup-primary pl-action-primary">${t("startup.newProject")}</button>
          <div class="pl-actions-secondary">
            <button id="pl-btn-import" class="pl-btn-secondary">${t("startup.importJson")}</button>
          </div>
        </div>
        <div class="pl-section">
          <div class="pl-section-label">${t("startup.recentProjects")}</div>
          <input id="pl-search" class="pl-search" type="search" placeholder="${t("startup.searchProjects")}">
          <div id="pl-grid"></div>
        </div>
        <div id="pl-new-form" hidden>
          <div class="startup-row"><label>${t("startup.projectName")}</label>
            <input id="startup-project-name" type="text" placeholder="${t("startup.projectName.placeholder")}" class="pl-text-input">
          </div>
          <div class="startup-row"><label>${t("startup.paperSize")}</label>
            <select id="startup-paper"><option value="A4">A4</option><option value="A3">A3</option><option value="A2">A2</option><option value="A1">A1</option></select>
          </div>
          <div class="startup-row"><label>${t("startup.orientation")}</label>
            <select id="startup-orientation"><option value="landscape">${t("page.orientation.landscape")}</option><option value="portrait">${t("page.orientation.portrait")}</option></select>
          </div>
          <div class="startup-row"><label>${t("startup.scale")}</label>
            <select id="startup-scale">
              <option value="1/1" selected>1/1</option><option value="1/2">1/2</option><option value="1/5">1/5</option>
              <option value="1/10">1/10</option><option value="1/20">1/20</option>
              <option value="1/50">1/50</option><option value="1/100">1/100</option>
              <option value="1/200">1/200</option><option value="1/500">1/500</option>
            </select>
          </div>
          <div class="pl-form-btns">
            <button id="pl-btn-cancel" class="pl-btn-secondary">${t("startup.cancel")}</button>
            <button id="startup-btn-new" class="startup-primary">${t("startup.create")}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector("#pl-grid");
    const search = overlay.querySelector("#pl-search");
    const newForm = overlay.querySelector("#pl-new-form");
    const plActions = overlay.querySelector(".pl-actions");
    const plSection = overlay.querySelector(".pl-section");

    function showNewProjectForm() {
      plSection.hidden = true;
      plActions.hidden = true;
      newForm.hidden = false;
      overlay.querySelector("#startup-project-name").value = "";
      overlay.querySelector("#startup-paper").value = "A4";
      overlay.querySelector("#startup-orientation").value = "landscape";
      const defaultScale = { numerator: 1, denominator: 1 };
      overlay.querySelector("#startup-scale").value =
        `${defaultScale.numerator}/${defaultScale.denominator}`;
      overlay.querySelector("#startup-project-name").focus();
    }

    function hideNewProjectForm() {
      plSection.hidden = false;
      plActions.hidden = false;
      newForm.hidden = true;
    }

    function readNewProjectForm() {
      const projectName =
        overlay.querySelector("#startup-project-name").value.trim() ||
        t("default.untitled");
      const paper = overlay.querySelector("#startup-paper").value;
      const orientation = overlay.querySelector("#startup-orientation").value;
      const [n, d] = overlay
        .querySelector("#startup-scale")
        .value.split("/")
        .map(Number);
      return {
        projectName,
        paper,
        orientation,
        scale: { numerator: n, denominator: d },
      };
    }

    async function renderGrid() {
      const query = (search?.value || "").trim().toLowerCase();
      const projects = (await dbListProjects()).filter((proj) => {
        if (!query) return true;
        return (proj.name || t("default.unnamed"))
          .toLowerCase()
          .includes(query);
      });
      grid.innerHTML = "";
      if (projects.length === 0) return;
      projects.forEach((proj) => {
        const row = document.createElement("div");
        row.className = "pl-row";
        row.innerHTML = `
          <span class="pl-row-name">${proj.name || t("default.unnamed")}</span>
          <span class="pl-row-date">${_fmtDate(proj.updatedAt)}</span>
          <button class="pl-row-btn pl-row-open">${t("startup.open")}</button>
          <button class="pl-row-btn pl-row-del">${t("startup.delete")}</button>
        `;
        row.querySelector(".pl-row-open").addEventListener("click", (e) => {
          e.stopPropagation();
          overlay.remove();
          resolve({
            projectId: proj.id,
            json: proj.data,
            savedAt: proj.updatedAt,
            paper: "A4",
            orientation: "landscape",
            scale: { numerator: 1, denominator: 10 },
          });
        });
        row
          .querySelector(".pl-row-del")
          .addEventListener("click", async (e) => {
            e.stopPropagation();
            if (
              confirm(
                t("startup.deleteProjectConfirm", {
                  name: proj.name || t("default.unnamed"),
                }),
              )
            ) {
              await dbDeleteProject(proj.id);
              await renderGrid();
            }
          });
        grid.appendChild(row);
      });
    }

    renderGrid();
    search?.addEventListener("input", renderGrid);

    overlay.querySelector("#pl-btn-close").addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });

    overlay.querySelector("#pl-btn-new").addEventListener("click", () => {
      showNewProjectForm();
    });

    overlay.querySelector("#pl-btn-cancel").addEventListener("click", () => {
      hideNewProjectForm();
    });

    overlay.querySelector("#startup-btn-new").addEventListener("click", () => {
      const form = readNewProjectForm();
      overlay.remove();
      resolve({
        projectId: null,
        json: null,
        ...form,
      });
    });

    overlay
      .querySelector("#pl-btn-import")
      .addEventListener("click", async () => {
        try {
          const result = await importProjectJsonFromFile();
          overlay.remove();
          resolve({
            projectId: null,
            json: result?.data ?? result,
            paper: "A4",
            orientation: "landscape",
            scale: { numerator: 1, denominator: 10 },
          });
        } catch (e) {
          if (e.message === "No file") return;
          if (e.code === "NotMillrectProject") {
            alert(t("common.alert.notMillrectProject"));
            return;
          }
          if (e instanceof SyntaxError) {
            alert(
              t("common.alert.projectJsonParseError", { message: e.message }),
            );
            return;
          }
          console.warn(e);
        }
      });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMillrectI18n();
  if (window.lucide) window.lucide.createIcons();
  loadSystemFonts().then(() => {
    const state = getState();
    if (state.selectedShapeIds.length) updatePropertiesPanel();
  });
  initState();
  const svgEl = document.getElementById("main-svg");
  initRenderer(svgEl);
  initUI();
  initAutosaveCheckbox();
  setAutosaveStatus("off");

  // 起動時はモーダルを出さず、名称未設定プロジェクト（A4・横・1/1）を直接開く。
  // 保存済みを開くにはツールバーの「開く」かタブの「＋」を使う。
  const hideBootLoader = () =>
    document.getElementById("boot-loading")?.classList.add("hidden");
  // フェイルセーフ: 初回描画が何らかの理由で完了しなくてもローダーで固まらないよう、
  // 最大8秒で必ず消す（Web 版向け。デスクトップ版は CSS で最初から非表示）。
  setTimeout(hideBootLoader, 8000);
  openUntitledProjectTab()
    .then(() => {
      requestAnimationFrame(() => {
        fitPage();
        render();
        updateAll();
        hideBootLoader();
      });
    })
    .catch(hideBootLoader);

  svgEl.addEventListener("mousedown", (e) => onMouseDown(e, svgEl));
  svgEl.addEventListener("mousemove", (e) => onMouseMove(e, svgEl));
  svgEl.addEventListener("mouseup", (e) => onMouseUp(e, svgEl));
  const canvasArea = document.getElementById("canvas-area");
  const onCanvasWheel = (e) => onWheel(e, svgEl);
  canvasArea?.addEventListener("wheel", onCanvasWheel, {
    passive: false,
    capture: true,
  });
  svgEl.addEventListener("contextmenu", (e) =>
    handleCanvasContextMenu(e, svgEl),
  );
  svgEl.addEventListener("selectstart", (e) => {
    if (
      e.target.closest?.("#sel-handles") ||
      e.target.closest?.(".sel-size-badge")
    ) {
      e.preventDefault();
    }
  });
  svgEl.addEventListener("dblclick", (e) => {
    const state = getState();
    const tool = state.activeTool;
    const sv = screenToSVG(e, svgEl);
    const { pt: pp } = getSnapped(sv.x, sv.y);
    const rp = paperToReal(pp.x, pp.y);
    if (tool === "bezier") {
      handleBezierDblClick(rp);
    } else if (["rect", "circle", "line"].includes(tool)) {
      e.preventDefault();
      showSizePopover(tool, rp, e.clientX, e.clientY);
    } else if (tool === "select" || tool === "text") {
      // Double-click on dim label → reset text offset
      const dimLabelEl = e.target.getAttribute?.("data-dim-label")
        ? e.target
        : e.target.closest?.("[data-dim-label]");
      if (dimLabelEl) {
        e.preventDefault();
        e.stopPropagation();
        const sid = dimLabelEl.getAttribute("data-dim-label");
        const res = findShapeById(sid);
        if (res) {
          delete res.shape.textOffsetX;
          delete res.shape.textOffsetY;
          pushHistory();
          render();
          uiUpdate();
        }
        return;
      }
      // Double-click a path/bezier → jump into point-edit mode (Figma-style).
      // Use the same geometry hit-test as single-click selection so it works
      // even though the #sel-handles overlay now sits on top of the shape.
      const picked =
        typeof findTopShapeAtRealPoint === "function"
          ? findTopShapeAtRealPoint(rp)
          : null;
      if (picked) {
        const res = findShapeById(picked.id);
        if (res?.shape?.type === "bezier") {
          e.preventDefault();
          e.stopPropagation();
          state.selectedShapeIds = [picked.id];
          _bezierEditId = picked.id;
          render();
          uiUpdate();
          return;
        }
        if (res?.shape?.type === "path" || res?.shape?.type === "rect") {
          e.preventDefault();
          e.stopPropagation();
          state.selectedShapeIds = [picked.id];
          enterVertexEditMode(picked.id);
          return;
        }
      }
      // Fallback: a single path/bezier is already selected (from the 1st click)
      // and we double-clicked within its bbox → edit it. Covers the case where
      // the snapped point lands just off a thin unfilled stroke.
      if (state.selectedShapeIds.length === 1) {
        const selRes = findShapeById(state.selectedShapeIds[0]);
        const st = selRes?.shape;
        if (st && (st.type === "bezier" || st.type === "path")) {
          const bb = getShapeBBox(st, getCurrentPage().scale);
          const margin = 8 / state.zoom;
          if (
            bb &&
            realPointInPaperBBox(
              rp,
              {
                x: bb.x - margin,
                y: bb.y - margin,
                w: bb.w + 2 * margin,
                h: bb.h + 2 * margin,
              },
              getCurrentPage().scale,
            )
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (st.type === "bezier") _bezierEditId = st.id;
            else enterVertexEditMode(st.id);
            render();
            uiUpdate();
            return;
          }
        }
      }
      handleTextShapeDblClick(e, svgEl);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Alt") {
      beginAltDuplicate();
      return;
    }
    onKeyDown(e);
  });
  document.addEventListener("keyup", (e) => {
    if (e.key !== "Alt") return;
    cancelAltDuplicate();
  });
  window.addEventListener("millrect:uiupdate", scheduleUpdateAll);

  // ── 多ビュー CSG 3D プレビュー UI は廃止（2D/3D モード切替に統合）。
  //    update3DScene/exportSTL/MCP 経路はコードに残置（dormant）。完全削除は別タスク。

  // ── Right panel toggle ────────────────────────────
  const rightPanel = document.getElementById("sidebar-right");
  const btnRight = document.getElementById("btn-toggle-right");
  if (btnRight) {
    btnRight.classList.add("active");
    btnRight.addEventListener("click", () => {
      const hidden = rightPanel.classList.toggle("panel-hidden");
      btnRight.classList.toggle("active", !hidden);
    });
  }

  // ── Right panel resize ────────────────────────────
  const resizeHandle = document.getElementById("right-panel-resize");
  if (resizeHandle && rightPanel) {
    let _rx = 0,
      _rw = 0;
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      _rx = e.clientX;
      _rw = rightPanel.offsetWidth;
      resizeHandle.classList.add("dragging");
      const onMove = (ev) => {
        const delta = _rx - ev.clientX;
        const newW = Math.max(200, Math.min(500, _rw + delta));
        rightPanel.style.width = newW + "px";
        document.documentElement.style.setProperty("--right-w", newW + "px");
      };
      const onUp = () => {
        resizeHandle.classList.remove("dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // ── Tools float toggle ────────────────────────────
  const toolsFloat = document.getElementById("tools-float");
  const btnLeft = document.getElementById("btn-toggle-left");
  if (btnLeft) {
    btnLeft.classList.add("active");
    btnLeft.addEventListener("click", () => {
      const hidden = toolsFloat.classList.toggle("panel-hidden");
      btnLeft.classList.toggle("active", !hidden);
    });
  }

  // ── Tools float drag ──────────────────────────────
  const dragHandle = document.getElementById("tools-drag-handle");
  if (dragHandle && toolsFloat) {
    dragHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX - toolsFloat.offsetLeft;
      const startY = e.clientY - toolsFloat.offsetTop;
      const onMove = (ev) => {
        const ws = document.getElementById("workspace") || document.body;
        const maxX = ws.clientWidth - toolsFloat.offsetWidth;
        const maxY = ws.clientHeight - toolsFloat.offsetHeight;
        toolsFloat.style.left =
          Math.max(0, Math.min(maxX, ev.clientX - startX)) + "px";
        toolsFloat.style.top =
          Math.max(0, Math.min(maxY, ev.clientY - startY)) + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  window.Millrect = {
    applyDrawingCommands,
    addShape: (shape) => applyDrawingCommands([{ action: "addShape", shape }]),
    updateShape: (id, values) =>
      applyDrawingCommands([{ action: "updateShape", id, values }]),
    deleteShape: (id) => applyDrawingCommands([{ action: "deleteShape", id }]),
    exportProjectJson,
    exportProjectJsonString,
    exportCurrentPageSvg,
    exportAllPagesPdf,
    render,
    selectShapes: (ids) => {
      applyDrawingCommands([{ action: "selectShapes", ids }]);
      render();
      uiUpdate();
    },
    getStateSnapshot: () => JSON.parse(exportProjectJsonString()),
  };

  // メニューバーからの操作
  if (window.electronAPI?.onMenu) {
    const onMenu = window.electronAPI.onMenu.bind(window.electronAPI);

    onMenu("menu:new", () => {
      document.getElementById("btn-new")?.click();
    });
    onMenu("menu:open", () => {
      // 「開く...」: 保存済みプロジェクトのリストモーダルを出す（btn-open と同じ）
      document.getElementById("btn-open")?.click();
    });
    onMenu("menu:exportJson", () => exportProjectJson());
    onMenu("menu:exportSvg", () => exportCurrentPageSvg());
    onMenu("menu:exportPdf", () => exportAllPagesPdf());
    onMenu("menu:undo", () => {
      if (undo()) {
        cancelDim();
        render();
        updateAll();
      }
    });
    onMenu("menu:redo", () => {
      if (redo()) {
        cancelDim();
        render();
        updateAll();
      }
    });
    onMenu("menu:zoomIn", () => {
      document.getElementById("btn-zoom-in")?.click();
    });
    onMenu("menu:zoomOut", () => {
      document.getElementById("btn-zoom-out")?.click();
    });
    onMenu("menu:zoomReset", () => {
      fitPage();
      render();
      updateAll();
    });
    onMenu("menu:booleanUnion", () => runBooleanShortcut("KeyU"));
    onMenu("menu:booleanSubtract", () => runBooleanShortcut("KeyS"));
    onMenu("menu:booleanIntersect", () => runBooleanShortcut("KeyI"));
    onMenu("menu:booleanExclude", () => runBooleanShortcut("KeyE"));
    onMenu("menu:booleanFlatten", () => runBooleanShortcut("KeyF"));
    onMenu("menu:helpSearch", () => {
      if (typeof openHelpSearch === "function") openHelpSearch();
    });
    onMenu("menu:helpShortcuts", () => {
      document.getElementById("btn-help")?.click();
    });
    onMenu("menu:openHelpDoc", (_event, payload) => {
      if (typeof openDocsViewer === "function") {
        openDocsViewer(payload?.page, payload?.anchor || null);
      }
    });
  }

  console.log(
    "%cMillrect ready. window.Millrect for AI/agent access.",
    "color:#2563eb;font-weight:bold",
  );
});
