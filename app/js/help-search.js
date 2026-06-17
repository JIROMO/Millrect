"use strict";

(function () {
  var overlay = null;
  var input = null;
  var resultsEl = null;
  var results = [];
  var activeIndex = -1;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function localizeOverlay() {
    if (!overlay) return;
    var title = document.getElementById("help-search-title");
    var closeBtn = document.getElementById("help-search-close");
    if (title) title.textContent = t("helpSearch.title");
    if (closeBtn) closeBtn.setAttribute("aria-label", t("helpSearch.close"));
    if (input) input.placeholder = t("helpSearch.placeholder");
    var footer = overlay.querySelector(".help-search-footer");
    if (footer) footer.textContent = t("helpSearch.footer");
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "help-search-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="help-search-panel" role="dialog" aria-modal="true" aria-labelledby="help-search-title">' +
      '<div class="help-search-header">' +
      '<span id="help-search-title"></span>' +
      '<button type="button" id="help-search-close" aria-label="">✕</button>' +
      "</div>" +
      '<input type="search" id="help-search-input" placeholder="" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="help-search-results">' +
      '<div class="help-search-results" id="help-search-results" role="listbox"></div>' +
      '<div class="help-search-footer"></div>' +
      "</div>";
    document.body.appendChild(overlay);

    input = document.getElementById("help-search-input");
    resultsEl = document.getElementById("help-search-results");
    localizeOverlay();
    window.addEventListener("millrect-localechange", function () {
      localizeOverlay();
      if (!overlay.hidden && input.value.trim()) updateResults();
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeHelpSearch();
    });
    document
      .getElementById("help-search-close")
      .addEventListener("click", closeHelpSearch);

    input.addEventListener("input", updateResults);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!results.length) return;
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        renderResults();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!results.length) return;
        activeIndex = Math.max(activeIndex - 1, 0);
        renderResults();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          openActiveResult();
        }
      } else if (e.key === "Escape") {
        closeHelpSearch();
      }
    });
  }

  function renderResults() {
    if (!results.length) {
      resultsEl.innerHTML =
        '<div class="help-search-empty">' +
        escapeHtml(t("helpSearch.empty")) +
        "</div>";
      return;
    }
    resultsEl.innerHTML = results
      .map(function (entry, i) {
        return (
          '<button type="button" class="help-search-item' +
          (i === activeIndex ? " is-active" : "") +
          '" data-index="' +
          i +
          '" role="option" aria-selected="' +
          (i === activeIndex) +
          '">' +
          '<span class="help-search-item-title">' +
          escapeHtml(entry.title) +
          "</span>" +
          '<span class="help-search-item-meta">' +
          escapeHtml(entry.section) +
          "</span>" +
          '<span class="help-search-item-summary">' +
          escapeHtml(entry.summary) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    resultsEl.querySelectorAll(".help-search-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeIndex = Number(btn.dataset.index);
        openActiveResult();
      });
    });
  }

  function currentHelpLocale() {
    return typeof getLocale === "function"
      ? getLocale()
      : getHelpSearchLocale();
  }

  function updateResults() {
    if (typeof searchHelpIndex !== "function") {
      results = [];
      activeIndex = -1;
      renderResults();
      return;
    }
    results = searchHelpIndex(input.value, 12, currentHelpLocale());
    activeIndex = results.length ? 0 : -1;
    renderResults();
  }

  function openActiveResult() {
    var entry = results[activeIndex];
    if (!entry) return;
    closeHelpSearch();
    if (typeof openDocsViewer === "function") {
      openDocsViewer(entry.page, entry.anchor || null);
    } else if (window.electronAPI?.openHelpTopic) {
      window.electronAPI.openHelpTopic(entry.page, entry.anchor || null);
    }
  }

  async function openHelpSearch() {
    if (typeof ensureHelpIndex === "function") {
      try {
        await ensureHelpIndex();
      } catch (e) {
        console.warn("[help-search] failed to load index:", e);
      }
    }
    ensureOverlay();
    overlay.hidden = false;
    input.value = "";
    results = [];
    activeIndex = -1;
    renderResults();
    requestAnimationFrame(function () {
      input.focus();
    });
  }

  function closeHelpSearch() {
    if (!overlay) return;
    overlay.hidden = true;
    input.blur();
  }

  window.openHelpSearch = openHelpSearch;
  window.closeHelpSearch = closeHelpSearch;
})();
