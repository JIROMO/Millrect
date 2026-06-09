"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.measureTextLayoutHb = measureTextLayoutHb;
exports.outlineTextHb = outlineTextHb;
exports.getNodeHarfBuzzEngine = getNodeHarfBuzzEngine;
const { createSystemFontHarfBuzzEngine } = require("./text-engine-harfbuzz");
let _enginePromise = null;
async function getNodeHarfBuzzEngine() {
    if (!_enginePromise) {
        _enginePromise = createSystemFontHarfBuzzEngine();
    }
    return _enginePromise;
}
async function measureTextLayoutHb(payload) {
    const engine = await getNodeHarfBuzzEngine();
    return engine.measureTextLayout(payload);
}
async function outlineTextHb(payload) {
    const engine = await getNodeHarfBuzzEngine();
    return engine.outlineText(payload);
}
