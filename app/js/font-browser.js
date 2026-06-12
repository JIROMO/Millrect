"use strict";

let _fontBrowserOpen = false;

function _escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function _categoryLabel(category) {
  const map = {
    "sans-serif": "Sans",
    serif: "Serif",
    monospace: "Mono",
    display: "Display",
    handwriting: "Hand",
  };
  return map[category] || category || "";
}

async function openFontBrowserModal(opts = {}) {
  if (_fontBrowserOpen) return;
  _fontBrowserOpen = true;

  const addToProject = opts.addToProject !== false;
  let catalog = [];
  let filtered = [];
  let selectedId = null;
  let loading = true;
  let loadError = "";
  let actionError = "";
  let acting = false;

  const overlay = document.createElement("div");
  overlay.id = "font-browser-overlay";
  overlay.innerHTML =
    '<div id="font-browser-dialog" role="dialog" aria-modal="true" aria-labelledby="font-browser-title">' +
    '<h2 id="font-browser-title">' +
    t("font.browser.title") +
    "</h2>" +
    '<p class="font-browser-desc">' +
    t("font.browser.desc") +
    "</p>" +
    '<div class="font-browser-toolbar">' +
    '<input type="search" id="font-browser-search" class="font-browser-search" placeholder="' +
    t("font.browser.searchPlaceholder") +
    '" autocomplete="off">' +
    '<label class="font-browser-filter"><input type="checkbox" id="font-browser-japanese" checked> ' +
    t("font.browser.japanese") +
    "</label>" +
    '<select id="font-browser-category" class="font-browser-category">' +
    '<option value="">' +
    t("font.browser.categoryAll") +
    "</option>" +
    '<option value="sans-serif">Sans-serif</option>' +
    '<option value="serif">Serif</option>' +
    '<option value="monospace">Monospace</option>' +
    '<option value="display">Display</option>' +
    '<option value="handwriting">Handwriting</option>' +
    "</select></div>" +
    '<div id="font-browser-status" class="font-browser-status">' +
    t("font.browser.loading") +
    "</div>" +
    '<ul id="font-browser-list" class="font-browser-list"></ul>' +
    '<div class="font-browser-preview">' +
    '<span class="font-browser-preview-label">' +
    t("font.browser.preview") +
    "</span>" +
    '<p id="font-browser-preview-text" class="font-browser-preview-text">' +
    t("font.browser.previewText") +
    "</p>" +
    "</div>" +
    (addToProject
      ? '<label class="font-browser-option"><input type="checkbox" id="font-browser-add-project" checked> ' +
        t("font.browser.addToProjectOption") +
        "</label>"
      : "") +
    '<p id="font-browser-error" class="font-browser-error" hidden></p>' +
    '<div class="font-browser-actions">' +
    '<button type="button" id="font-browser-cancel">' +
    t("font.browser.cancel") +
    "</button>" +
    '<button type="button" id="font-browser-add" class="font-browser-add" disabled>' +
    t("font.browser.addToLibrary") +
    "</button>" +
    "</div></div>";
  document.body.appendChild(overlay);

  const searchEl = overlay.querySelector("#font-browser-search");
  const japaneseEl = overlay.querySelector("#font-browser-japanese");
  const categoryEl = overlay.querySelector("#font-browser-category");
  const statusEl = overlay.querySelector("#font-browser-status");
  const listEl = overlay.querySelector("#font-browser-list");
  const previewEl = overlay.querySelector("#font-browser-preview-text");
  const errorEl = overlay.querySelector("#font-browser-error");
  const addBtn = overlay.querySelector("#font-browser-add");
  const cancelBtn = overlay.querySelector("#font-browser-cancel");
  const addProjectEl = overlay.querySelector("#font-browser-add-project");

  function setError(message) {
    actionError = message || "";
    if (!errorEl) return;
    errorEl.textContent = actionError;
    errorEl.hidden = !actionError;
  }

  function applyFilters() {
    filtered = filterFontCatalog(catalog, {
      query: searchEl.value,
      japaneseOnly: japaneseEl.checked,
      category: categoryEl.value,
    });
    if (selectedId && !filtered.some((f) => f.id === selectedId)) {
      selectedId = filtered[0]?.id || null;
    }
    if (!selectedId && filtered.length) selectedId = filtered[0].id;
    renderList();
  }

  function renderList() {
    listEl.innerHTML = "";
    if (loading) {
      statusEl.textContent = t("font.browser.fetching");
      addBtn.disabled = true;
      return;
    }
    if (loadError) {
      statusEl.textContent = loadError;
      addBtn.disabled = true;
      return;
    }
    statusEl.textContent = t("font.browser.count", { count: filtered.length });
    if (!filtered.length) {
      const li = document.createElement("li");
      li.className = "font-browser-empty";
      li.textContent = t("font.browser.empty");
      listEl.appendChild(li);
      addBtn.disabled = true;
      previewEl.style.fontFamily = "";
      return;
    }
    for (const item of filtered.slice(0, 200)) {
      const li = document.createElement("li");
      li.className = "font-browser-item";
      if (item.id === selectedId) li.classList.add("selected");
      li.dataset.fontId = item.id;
      li.innerHTML =
        `<span class="font-browser-item-name">${_escapeHtml(item.family)}</span>` +
        `<span class="font-browser-item-meta">${_escapeHtml(_categoryLabel(item.category))}</span>`;
      li.addEventListener("click", () => {
        selectedId = item.id;
        renderList();
        updatePreview(item);
      });
      listEl.appendChild(li);
    }
    if (filtered.length > 200) {
      const li = document.createElement("li");
      li.className = "font-browser-more";
      li.textContent = t("font.browser.more", {
        count: filtered.length - 200,
      });
      listEl.appendChild(li);
    }
    addBtn.disabled = !selectedId || acting;
    const selected = filtered.find((f) => f.id === selectedId);
    if (selected) updatePreview(selected);
  }

  function updatePreview(item) {
    previewEl.style.fontFamily = `"${item.family}", sans-serif`;
    const cssUrl = buildGoogleFontsCssUrl(item.family);
    let link = document.getElementById("font-browser-preview-css");
    if (!link) {
      link = document.createElement("link");
      link.id = "font-browser-preview-css";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== cssUrl) link.href = cssUrl;
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    _fontBrowserOpen = false;
    document.removeEventListener("keydown", onKeyDown, true);
    document.getElementById("font-browser-preview-css")?.remove();
    overlay.remove();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  cancelBtn.addEventListener("click", close);
  searchEl.addEventListener("input", applyFilters);
  japaneseEl.addEventListener("change", applyFilters);
  categoryEl.addEventListener("change", applyFilters);

  addBtn.addEventListener("click", async () => {
    const item = filtered.find((f) => f.id === selectedId);
    if (!item || acting) return;
    acting = true;
    addBtn.disabled = true;
    setError("");
    try {
      const meta = await fetchFontsourceFontMeta(item.id);
      const libEntry = await registerFontsourceFamilyToLibrary(meta);
      if (addToProject && addProjectEl?.checked) {
        await addProjectFontFromLibrary(libEntry);
      }
      if (typeof updateProjectFontsPanel === "function") {
        updateProjectFontsPanel();
      }
      if (typeof updatePropertiesPanel === "function") {
        updatePropertiesPanel();
      }
      close();
    } catch (err) {
      setError(err.message || String(err));
      acting = false;
      addBtn.disabled = !selectedId;
    }
  });

  document.addEventListener("keydown", onKeyDown, true);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  searchEl.focus();

  try {
    catalog = await getFontCatalogItems(false);
    loading = false;
    applyFilters();
  } catch (err) {
    loading = false;
    loadError = err.message || String(err);
    renderList();
  }
}

async function addLibraryFontToProject(libraryId) {
  const entry = findLibraryFontById(libraryId);
  if (!entry) throw new Error("ライブラリにフォントが見つかりません");
  return addProjectFontFromLibrary(entry);
}
