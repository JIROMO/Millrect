"use strict";

(function () {
  var overlay = null;
  var frame = null;

  var EN_DOC_PAGES = {
    "index.html": true,
    "getting-started.html": true,
    "interface.html": true,
    "drawing.html": true,
    "editing.html": true,
    "multiview-3d.html": true,
    "export.html": true,
    "shortcuts.html": true,
    "ai-mcp.html": true,
    "desktop-download.html": true,
  };

  function buildSrc(page, anchor) {
    var pageName = page || "index.html";
    var useEn =
      typeof getLocale === "function" &&
      getLocale() === "en" &&
      EN_DOC_PAGES[pageName];
    var src = (useEn ? "../docs/en/" : "../docs/") + pageName;
    if (anchor) src += "#" + anchor;
    return src;
  }

  function localizeViewer() {
    if (!overlay) return;
    var back = document.getElementById("docs-viewer-back");
    var forward = document.getElementById("docs-viewer-forward");
    var title = document.getElementById("docs-viewer-title");
    var closeBtn = document.getElementById("docs-viewer-close");
    var frameEl = document.getElementById("docs-viewer-frame");
    if (back) {
      back.title = t("docsViewer.back");
      back.setAttribute("aria-label", t("docsViewer.back"));
    }
    if (forward) {
      forward.title = t("docsViewer.forward");
      forward.setAttribute("aria-label", t("docsViewer.forward"));
    }
    if (title) title.textContent = t("docsViewer.title");
    if (closeBtn) closeBtn.setAttribute("aria-label", t("docsViewer.close"));
    if (frameEl) frameEl.title = t("docsViewer.title");
  }

  function ensureViewer() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "docs-viewer-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="docs-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="docs-viewer-title">' +
      '<div class="docs-viewer-toolbar">' +
      '<div class="docs-viewer-toolbar-left">' +
      '<button type="button" id="docs-viewer-back" title="">←</button>' +
      '<button type="button" id="docs-viewer-forward" title="">→</button>' +
      '<span id="docs-viewer-title"></span>' +
      "</div>" +
      '<div class="docs-viewer-toolbar-right">' +
      '<button type="button" id="docs-viewer-close" aria-label="">✕</button>' +
      "</div>" +
      "</div>" +
      '<iframe id="docs-viewer-frame" title=""></iframe>' +
      "</div>";
    document.body.appendChild(overlay);

    frame = document.getElementById("docs-viewer-frame");
    localizeViewer();
    window.addEventListener("millrect-localechange", localizeViewer);

    document
      .getElementById("docs-viewer-close")
      .addEventListener("click", closeDocsViewer);
    document
      .getElementById("docs-viewer-back")
      .addEventListener("click", function () {
        try {
          frame.contentWindow.history.back();
        } catch (_e) {}
      });
    document
      .getElementById("docs-viewer-forward")
      .addEventListener("click", function () {
        try {
          frame.contentWindow.history.forward();
        } catch (_e) {}
      });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeDocsViewer();
    });

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeDocsViewer();
      }
    });
  }

  function openDocsViewer(page, anchor) {
    ensureViewer();
    frame.src = buildSrc(page, anchor);
    overlay.hidden = false;
  }

  function closeDocsViewer() {
    if (!overlay) return;
    overlay.hidden = true;
    frame.src = "about:blank";
  }

  window.openDocsViewer = openDocsViewer;
  window.closeDocsViewer = closeDocsViewer;
})();
