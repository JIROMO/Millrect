"use strict";

// Browser HarfBuzz text engine bootstrap (ESM → global MillrectTextEngine).

window.__millrectHbReady = false;

function getTextEngineModuleUrl() {
  const scriptSrc = document.currentScript?.src;
  if (scriptSrc) {
    return new URL("../vendor/millrect-text-engine.mjs", scriptSrc).href;
  }
  return new URL("./vendor/millrect-text-engine.mjs", window.location.href)
    .href;
}

const _textEngineFileProtocol = window.location.protocol === "file:";

if (_textEngineFileProtocol && !window.electronAPI?.measureTextLayout) {
  console.warn(
    "[text-engine] file:// では WASM モジュールを読み込めません。npm run serve で HTTP サーバーを起動してください。",
  );
}

window.__millrectHbInitPromise = _textEngineFileProtocol
  ? Promise.resolve()
  : import(getTextEngineModuleUrl())
      .then(() => {
        if (!window.MillrectTextEngine?.init) {
          throw new Error("MillrectTextEngine module missing");
        }
        return window.MillrectTextEngine.init();
      })
      .then(() => {
        window.__millrectHbReady = Boolean(window.MillrectTextEngine?.ready);
        if (
          window.__millrectHbReady &&
          typeof refreshAllTextNativePreviews === "function"
        ) {
          refreshAllTextNativePreviews();
        }
      })
      .catch((err) => {
        console.warn("[text-engine] browser WASM init failed:", err);
        window.__millrectHbReady = false;
      });

function isBrowserTextEngineReady() {
  return Boolean(window.__millrectHbReady && window.MillrectTextEngine);
}

async function ensureBrowserTextEngine() {
  if (isBrowserTextEngineReady()) return window.MillrectTextEngine;
  if (window.__millrectHbInitPromise) await window.__millrectHbInitPromise;
  if (!isBrowserTextEngineReady()) {
    throw new Error("ブラウザ text engine が初期化できませんでした");
  }
  return window.MillrectTextEngine;
}

async function browserMeasureTextLayout(payload) {
  const engine = await ensureBrowserTextEngine();
  return engine.measureTextLayout(payload);
}

async function browserOutlineText(payload) {
  const engine = await ensureBrowserTextEngine();
  return engine.outlineText(payload);
}
