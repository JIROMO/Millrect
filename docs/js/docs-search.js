(function () {
  "use strict";

  var UI = {
    ja: {
      label: "ヘルプを検索",
      placeholder: "ヘルプを検索…",
      empty: "該当するトピックが見つかりません",
    },
    en: {
      label: "Search help",
      placeholder: "Search help…",
      empty: "No matching topics",
    },
  };

  function docsSearchLocale() {
    if (typeof getHelpSearchLocale === "function") return getHelpSearchLocale();
    return "ja";
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderResults(listEl, results, activeIndex, locale) {
    var copy = UI[locale] || UI.ja;
    if (!results.length) {
      listEl.innerHTML =
        '<div class="docs-search-empty">' + escapeHtml(copy.empty) + "</div>";
      return;
    }
    listEl.innerHTML = results
      .map(function (entry, i) {
        var href = helpTopicHref(entry);
        return (
          '<a class="docs-search-item' +
          (i === activeIndex ? " is-active" : "") +
          '" href="' +
          escapeHtml(href) +
          '" role="option" aria-selected="' +
          (i === activeIndex) +
          '">' +
          '<span class="docs-search-item-title">' +
          escapeHtml(entry.title) +
          "</span>" +
          '<span class="docs-search-item-meta">' +
          escapeHtml(entry.section) +
          "</span>" +
          '<span class="docs-search-item-summary">' +
          escapeHtml(entry.summary) +
          "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  function initDocsSearch() {
    var actions = document.querySelector(".docs-header-actions");
    if (!actions || document.getElementById("docs-search-wrap")) return;

    var locale = docsSearchLocale();
    var copy = UI[locale] || UI.ja;

    var wrap = document.createElement("div");
    wrap.className = "docs-search-wrap";
    wrap.id = "docs-search-wrap";
    wrap.innerHTML =
      '<label class="docs-search" aria-label="' +
      escapeHtml(copy.label) +
      '">' +
      '<span class="docs-search-icon" aria-hidden="true">⌕</span>' +
      '<input type="search" id="docs-search-input" placeholder="' +
      escapeHtml(copy.placeholder) +
      '" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="docs-search-results" aria-expanded="false">' +
      "</label>" +
      '<div class="docs-search-dropdown" id="docs-search-dropdown" hidden>' +
      '<div class="docs-search-results" id="docs-search-results" role="listbox"></div>' +
      "</div>";

    actions.insertBefore(wrap, actions.firstChild);

    var input = document.getElementById("docs-search-input");
    var dropdown = document.getElementById("docs-search-dropdown");
    var resultsEl = document.getElementById("docs-search-results");
    var results = [];
    var activeIndex = -1;

    function closeDropdown() {
      dropdown.hidden = true;
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function openDropdown() {
      dropdown.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function updateResults() {
      locale = docsSearchLocale();
      results = searchHelpIndex(input.value, 10, locale);
      activeIndex = results.length ? 0 : -1;
      renderResults(resultsEl, results, activeIndex, locale);
      if (input.value.trim()) openDropdown();
      else closeDropdown();
    }

    function navigateActive() {
      if (activeIndex < 0 || !results[activeIndex]) return;
      window.location.href = helpTopicHref(results[activeIndex]);
    }

    input.addEventListener("input", updateResults);
    input.addEventListener("focus", function () {
      if (input.value.trim()) updateResults();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!results.length) return;
        activeIndex = Math.min(activeIndex + 1, results.length - 1);
        renderResults(resultsEl, results, activeIndex, locale);
        openDropdown();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!results.length) return;
        activeIndex = Math.max(activeIndex - 1, 0);
        renderResults(resultsEl, results, activeIndex, locale);
        openDropdown();
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          navigateActive();
        }
      } else if (e.key === "Escape") {
        closeDropdown();
        input.blur();
      }
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) closeDropdown();
    });

    // URL hash from app help search deep-link
    var params = new URLSearchParams(window.location.search);
    var q = params.get("q");
    if (q) {
      input.value = q;
      updateResults();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDocsSearch);
  } else {
    initDocsSearch();
  }
})();
