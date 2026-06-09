"use strict";

const { createSystemFontHarfBuzzEngine } = require("./text-engine-harfbuzz");

let _enginePromise: any = null;

async function getNodeHarfBuzzEngine(): Promise<any> {
  if (!_enginePromise) {
    _enginePromise = createSystemFontHarfBuzzEngine();
  }
  return _enginePromise;
}

async function measureTextLayoutHb(payload: any): Promise<any> {
  const engine = await getNodeHarfBuzzEngine();
  return engine.measureTextLayout(payload);
}

async function outlineTextHb(payload: any): Promise<any> {
  const engine = await getNodeHarfBuzzEngine();
  return engine.outlineText(payload);
}

export { measureTextLayoutHb, outlineTextHb, getNodeHarfBuzzEngine };
