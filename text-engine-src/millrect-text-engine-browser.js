"use strict";

import * as hb from "harfbuzzjs";
import {
  createHarfBuzzTextEngine,
  openHbFont,
} from "./text-engine-harfbuzz-core.js";
import {
  BUILTIN_FONT_GEN,
  normalizeTextFontFamily,
} from "../packages/builtin-fonts.js";

const WEB_FONT_CATALOG = [
  {
    id: "gen-interface-jp",
    regularUrl: "fonts/GenInterfaceJP-Regular.ttf",
    boldUrl: "fonts/GenInterfaceJP-Bold.ttf",
    families: [BUILTIN_FONT_GEN],
  },
];

function matchCatalogEntry(family, bold) {
  const name = normalizeTextFontFamily(family);
  const entry = WEB_FONT_CATALOG.find((e) => e.families.includes(name));
  const picked = entry || WEB_FONT_CATALOG[0];
  return {
    cacheId: `${picked.id}-${bold ? "b" : "r"}`,
    url: bold ? picked.boldUrl : picked.regularUrl,
  };
}

async function createBrowserTextEngine() {
  const fontBytes = new Map();

  async function loadFontEntry(family, _style, bold) {
    const fetchProject = globalThis.__millrectFetchProjectFontBytes;
    if (typeof fetchProject === "function") {
      const projectBytes = await fetchProject(family, bold);
      if (projectBytes?.length) {
        return openHbFont(hb, projectBytes, 0);
      }
    }

    const matched = matchCatalogEntry(family, bold);
    if (!matched?.url) return null;
    let bytes = fontBytes.get(matched.cacheId);
    if (!bytes) {
      const res = await fetch(matched.url);
      if (!res.ok) {
        throw new Error(`Web font not found: ${matched.url}`);
      }
      bytes = new Uint8Array(await res.arrayBuffer());
      fontBytes.set(matched.cacheId, bytes);
    }
    return openHbFont(hb, bytes, 0);
  }

  return createHarfBuzzTextEngine(hb, loadFontEntry);
}

let _engine = null;
let _initPromise = null;

async function init() {
  if (_engine) return _engine;
  if (!_initPromise) {
    _initPromise = createBrowserTextEngine().then((engine) => {
      _engine = engine;
      return engine;
    });
  }
  return _initPromise;
}

async function measureTextLayout(payload) {
  const engine = await init();
  return engine.measureTextLayout(payload);
}

async function outlineText(payload) {
  const engine = await init();
  return engine.outlineText(payload);
}

const api = {
  get ready() {
    return Boolean(_engine);
  },
  init,
  measureTextLayout,
  outlineText,
  catalog: WEB_FONT_CATALOG,
};

globalThis.MillrectTextEngine = api;
