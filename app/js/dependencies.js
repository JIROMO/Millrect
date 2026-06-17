"use strict";

(function () {
  const cache = new Map();

  function loadScript(src) {
    if (cache.has(src)) return cache.get(src);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      const ready = new Promise((resolve, reject) => {
        if (existing.dataset.loaded === "1") {
          resolve();
          return;
        }
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
      cache.set(src, ready);
      return ready;
    }
    const ready = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
    cache.set(src, ready);
    return ready;
  }

  function loadScriptsInOrder(sources) {
    return sources.reduce(
      (p, src) => p.then(() => loadScript(src)),
      Promise.resolve(),
    );
  }

  window.loadMillrectScript = loadScript;
  window.ensurePdfExportLibs = () =>
    loadScriptsInOrder([
      "vendor/jspdf.umd.min.js",
      "vendor/svg2pdf.umd.min.js",
    ]);
  window.ensure3DLibs = () =>
    loadScriptsInOrder([
      "vendor/three.min.js",
      "vendor/three-orbit-controls.js",
      "vendor/three-stl-exporter.js",
      "vendor/csg.js",
      "vendor/csg-three-adapter.js",
    ]);
  window.ensureHelpIndex = () => loadScript("../packages/help-index.js");
})();
