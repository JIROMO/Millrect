"use strict";

const {
  createHarfBuzzTextEngine,
  openHbFont,
} = require("./text-engine-harfbuzz-core");

let _hbPromise = null;

async function loadHarfBuzz() {
  if (!_hbPromise) {
    _hbPromise = import("harfbuzzjs");
  }
  return _hbPromise;
}

async function createNodeHarfBuzzEngine(loadFontEntry) {
  const hb = await loadHarfBuzz();
  return createHarfBuzzTextEngine(hb, loadFontEntry);
}

async function createSystemFontHarfBuzzEngine() {
  const fontkit = require("fontkit");
  const { findFontFile, readFontFile } = require("./font-path");
  const hb = await loadHarfBuzz();

  function pickFaceIndex(filePath, familyHint) {
    if (!filePath.toLowerCase().endsWith(".ttc")) return 0;
    const handle = fontkit.openSync(filePath);
    if (!handle.fonts?.length) return 0;
    const needle = familyHint.toLowerCase().replace(/[\s-_]/g, "");
    const match = handle.fonts.find((f) => {
      const name = (f.familyName || f.postscriptName || "")
        .toLowerCase()
        .replace(/[\s-_]/g, "");
      return name.includes(needle) || needle.includes(name);
    });
    const font = match || handle.fonts[0];
    return Math.max(0, handle.fonts.indexOf(font));
  }

  return createNodeHarfBuzzEngine(async (family, style) => {
    const filePath = findFontFile(family, style, { includeTtc: true });
    if (!filePath) return null;
    const buffer = readFontFile(filePath);
    const faceIndex = pickFaceIndex(filePath, family);
    return openHbFont(hb, buffer, faceIndex);
  });
}

module.exports = {
  loadHarfBuzz,
  createHarfBuzzTextEngine,
  createNodeHarfBuzzEngine,
  createSystemFontHarfBuzzEngine,
  openHbFont,
};
