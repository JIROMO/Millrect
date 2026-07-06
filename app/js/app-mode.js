"use strict";

// ── Main 2D / 3D mode switch ────────────────────────────────
// 3D mode previews the current drawing through the drawing-derived
// Three.js/CSG pipeline.
(function () {
  let initialized3D = false;
  let resizeObserver = null;
  let pending3DRefresh = null;
  let pendingPrintCall = null;
  let printPageStyle = null;
  let loading3D = null;

  function updateToggleButtons(mode) {
    for (const btn of document.querySelectorAll(".toolbar-mode-btn")) {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function setStoredMode(mode) {
    if (typeof getState !== "function") return;
    try {
      getState().appMode = mode;
    } catch (e) {
      // State may not be initialized yet during early startup.
    }
  }

  function is3DMode() {
    return document.getElementById("app")?.classList.contains("mode-3d");
  }

  function isPrintMode() {
    return document.getElementById("app")?.classList.contains("mode-print");
  }

  function updatePrintButton(on) {
    const btn = document.getElementById("btn-print-mode");
    if (!btn) return;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function pageScaleLabel(page) {
    const sc = page?.scale || { numerator: 1, denominator: 1 };
    return `${sc.numerator}/${sc.denominator}`;
  }

  function syncPrintPageStyle(page) {
    if (!page || typeof getPaperDimensions !== "function") return;
    const dims = getPaperDimensions(page);
    const root = document.documentElement;
    root.style.setProperty("--print-paper-width", `${dims.width}mm`);
    root.style.setProperty("--print-paper-height", `${dims.height}mm`);

    const paper = /^(A[1-4])$/.test(page.paper) ? page.paper : "A4";
    const orientation =
      page.orientation === "portrait" ? "portrait" : "landscape";
    if (!printPageStyle) {
      printPageStyle = document.createElement("style");
      printPageStyle.id = "millrect-print-page-style";
      document.head.appendChild(printPageStyle);
    }
    printPageStyle.textContent = `@page { size: ${paper} ${orientation}; margin: 0; }`;
  }

  function updatePrintSummary() {
    const el = document.getElementById("print-mode-summary");
    if (!el || typeof getCurrentPage !== "function") return;
    const page = getCurrentPage();
    syncPrintPageStyle(page);
    const orientation =
      typeof t === "function"
        ? t(`page.orientation.${page.orientation || "landscape"}`)
        : page.orientation || "landscape";
    el.textContent =
      typeof t === "function"
        ? t("printMode.summary", {
            page: page.name || "",
            paper: page.paper || "A4",
            orientation,
            scale: pageScaleLabel(page),
          })
        : `${page.name || ""} · ${page.paper || "A4"} ${orientation} · ${pageScaleLabel(page)}`;
  }

  function enterPrintMode(options = {}) {
    const app = document.getElementById("app");
    if (!app) return;
    if (is3DMode()) setAppMode("2d");
    app.classList.add("mode-print");
    updatePrintButton(true);
    updatePrintSummary();
    if (typeof render === "function") render();

    if (options.print) {
      if (pendingPrintCall) {
        clearTimeout(pendingPrintCall);
        pendingPrintCall = null;
      }
      requestAnimationFrame(() => {
        pendingPrintCall = setTimeout(() => {
          pendingPrintCall = null;
          window.print();
        }, 0);
      });
    }
  }

  function exitPrintMode() {
    const app = document.getElementById("app");
    if (!app) return;
    if (pendingPrintCall) {
      clearTimeout(pendingPrintCall);
      pendingPrintCall = null;
    }
    app.classList.remove("mode-print");
    updatePrintButton(false);
    if (typeof render === "function") render();
  }

  function togglePrintMode() {
    isPrintMode() ? exitPrintMode() : enterPrintMode();
  }

  function printCurrentPage() {
    enterPrintMode({ print: true });
  }

  async function ensure3DInitialized() {
    const canvas = document.getElementById("canvas-3d");
    if (!canvas || typeof init3DView !== "function") return false;
    if (typeof ensure3DLibs === "function") {
      if (!loading3D) {
        loading3D = ensure3DLibs().finally(() => {
          loading3D = null;
        });
      }
      await loading3D;
    }
    if (!initialized3D) {
      init3DView(canvas);
      initialized3D = true;
    }
    if (!resizeObserver && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (is3DMode() && typeof resize3DView === "function") resize3DView();
      });
      resizeObserver.observe(canvas.parentElement || canvas);
    }
    return true;
  }

  async function refresh3DNow() {
    if (pending3DRefresh) {
      clearTimeout(pending3DRefresh);
      pending3DRefresh = null;
    }
    if (!(await ensure3DInitialized())) return;
    if (typeof resize3DView === "function") resize3DView();
    if (typeof update3DScene === "function") update3DScene();
  }

  function showGeneratingOverlay() {
    const el = document.getElementById("panel-3d-empty");
    const msg = el?.querySelector(".panel-3d-empty-msg");
    if (!el) return;
    el.hidden = false;
    if (msg) {
      msg.textContent =
        typeof t === "function" ? t("view3d.generating") : "Generating 3D...";
    }
  }

  function setAppMode(mode) {
    const next = mode === "3d" ? "3d" : "2d";
    const app = document.getElementById("app");
    const panel3d = document.getElementById("panel-3d");

    if (next === "3d" && isPrintMode()) exitPrintMode();
    setStoredMode(next);
    updateToggleButtons(next);
    if (app) app.classList.toggle("mode-3d", next === "3d");

    if (next === "3d") {
      panel3d?.classList.add("visible");
      showGeneratingOverlay();
      if (typeof start3DLoop === "function") start3DLoop(); // 再入時にループ再開
      if (pending3DRefresh) clearTimeout(pending3DRefresh);
      pending3DRefresh = setTimeout(() => {
        requestAnimationFrame(() => {
          refresh3DNow().catch((e) => {
            console.warn("[3D] failed to initialize:", e);
          });
        });
      }, 30);
    } else {
      if (pending3DRefresh) {
        clearTimeout(pending3DRefresh);
        pending3DRefresh = null;
      }
      if (typeof cancelScheduledUpdate3DScene === "function") {
        cancelScheduledUpdate3DScene();
      }
      // 2D に戻ったらレンダリングループを止めて CPU/GPU を遊ばせない
      if (typeof pause3DLoop === "function") pause3DLoop();
      panel3d?.classList.remove("visible");
    }
  }

  function wire() {
    for (const btn of document.querySelectorAll(".toolbar-mode-btn")) {
      btn.addEventListener("click", () => setAppMode(btn.dataset.mode));
    }

    document
      .getElementById("btn-3d-close")
      ?.addEventListener("click", () => setAppMode("2d"));

    document
      .getElementById("btn-print-mode")
      ?.addEventListener("click", togglePrintMode);
    document
      .getElementById("print-mode-print")
      ?.addEventListener("click", printCurrentPage);
    document
      .getElementById("print-mode-exit")
      ?.addEventListener("click", exitPrintMode);

    document.getElementById("btn-export-stl")?.addEventListener("click", () => {
      if (typeof exportSTL === "function") exportSTL();
    });

    document.getElementById("btn-export-3mf")?.addEventListener("click", () => {
      if (typeof export3MF === "function") export3MF();
    });

    document.getElementById("btn-3d-reset")?.addEventListener("click", () => {
      if (typeof reset3DViewCamera === "function") {
        reset3DViewCamera();
      }
    });

    // 3D 再生成は 3D ボタンで表示/再選択したタイミングに限定する。
    // 2D render() から自動更新すると、編集中に重い CSG が割り込んで操作が重くなる。
    window.__3d_render_hook = null;

    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "p") return;
      e.preventDefault();
      togglePrintMode();
    });

    window.addEventListener("beforeprint", () => enterPrintMode());
    window.addEventListener("afterprint", exitPrintMode);
    window.addEventListener("millrect:uiupdate", () => {
      if (isPrintMode()) updatePrintSummary();
    });
    window.addEventListener("millrect-localechange", () => {
      if (isPrintMode()) updatePrintSummary();
    });

    if (window.electronAPI?.onMenu) {
      window.electronAPI.onMenu("menu:print", printCurrentPage);
    }
  }

  window.setAppMode = setAppMode;
  window.enterPrintMode = enterPrintMode;
  window.exitPrintMode = exitPrintMode;
  window.printCurrentPage = printCurrentPage;
  window.__millrectAppMode = {
    getMode: () => (is3DMode() ? "3d" : "2d"),
    isPrintMode,
    refresh3DNow,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
