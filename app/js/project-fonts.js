"use strict";

const _projectFontBytesCache = new Map();

function _projectFontCacheKey(entryId, bold) {
  return `${entryId}:${bold ? "700" : "400"}`;
}

function ensureProjectFonts() {
  const state = getState();
  if (!Array.isArray(state.fonts)) state.fonts = [];
  return state.fonts;
}

function getProjectFonts() {
  return getState()?.fonts || [];
}

function findProjectFontByFamily(family) {
  const needle = String(family || "")
    .toLowerCase()
    .replace(/[\s-_]/g, "");
  if (!needle) return null;
  for (const entry of getProjectFonts()) {
    const n = String(entry.family || "")
      .toLowerCase()
      .replace(/[\s-_]/g, "");
    if (n === needle || n.includes(needle) || needle.includes(n)) {
      return entry;
    }
  }
  return null;
}

function syncProjectFontStylesheets(fonts) {
  const list = fonts || getProjectFonts();
  let host = document.getElementById("millrect-project-fonts");
  if (!host) {
    host = document.createElement("div");
    host.id = "millrect-project-fonts";
    host.hidden = true;
    document.head.appendChild(host);
  }
  host.replaceChildren();
  const linkedCss = new Set();
  for (const entry of list) {
    if (!entry?.cssUrl || linkedCss.has(entry.cssUrl)) continue;
    linkedCss.add(entry.cssUrl);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = entry.cssUrl;
    link.dataset.fontCss = entry.cssUrl;
    host.appendChild(link);
  }
}

function clearProjectFontBytesCache() {
  _projectFontBytesCache.clear();
}

function _clearProjectFontCacheForEntry(entryId) {
  _projectFontBytesCache.delete(_projectFontCacheKey(entryId, false));
  _projectFontBytesCache.delete(_projectFontCacheKey(entryId, true));
  _projectFontBytesCache.delete(entryId);
}

async function fetchProjectFontBytes(entry, bold = false) {
  if (!entry?.id) throw new Error("フォント登録が不正です");
  const useBold = Boolean(bold && entry.fileUrlBold);
  const cacheKey = _projectFontCacheKey(entry.id, useBold);
  if (_projectFontBytesCache.has(cacheKey)) {
    return _projectFontBytesCache.get(cacheKey);
  }
  let fileUrl = useBold ? entry.fileUrlBold : entry.fileUrl;
  if (!fileUrl || (useBold && !entry.fileUrlBold)) {
    const resolved = await resolveProjectFontUrls(entry.family, entry.cssUrl);
    entry.fileUrl = resolved.fileUrl;
    entry.fileUrlBold = resolved.fileUrlBold || null;
    entry.cssUrl = resolved.cssUrl || entry.cssUrl;
    fileUrl = useBold && entry.fileUrlBold ? entry.fileUrlBold : entry.fileUrl;
  }
  if (!fileUrl) {
    throw new Error(`フォントファイル URL がありません: ${entry.family}`);
  }
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`フォントファイルの取得に失敗 (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  _projectFontBytesCache.set(cacheKey, bytes);
  return bytes;
}

globalThis.__millrectFetchProjectFontBytes = async (family, bold = false) => {
  const entry = findProjectFontByFamily(family);
  if (!entry) return null;
  try {
    return await fetchProjectFontBytes(entry, bold);
  } catch (err) {
    console.warn("[project-fonts] fetch failed:", entry.family, err);
    return null;
  }
};

async function registerProjectFontEntry(spec, opts = {}) {
  const family = String(spec?.family || "").trim();
  if (!family) throw new Error("フォント名が空です");
  const fonts = ensureProjectFonts();
  const dup = fonts.find(
    (f) => f.family.toLowerCase() === family.toLowerCase(),
  );
  if (dup) {
    if (opts.allowDuplicate) return dup;
    throw new Error(`登録済みです: ${family}`);
  }

  let cssUrl = spec.cssUrl;
  let fileUrl = spec.fileUrl || null;
  let fileUrlBold = spec.fileUrlBold || null;

  if (spec.resolveUrls !== false) {
    const resolved = await resolveProjectFontUrls(
      family,
      cssUrl || buildGoogleFontsCssUrl(family),
    );
    if (!spec.keepCssUrl) {
      cssUrl = resolved.cssUrl;
    } else if (!cssUrl) {
      cssUrl = resolved.cssUrl;
    }
    fileUrl = fileUrl || resolved.fileUrl;
    fileUrlBold = fileUrlBold || resolved.fileUrlBold || null;
  } else {
    if (!cssUrl) {
      cssUrl = buildGoogleFontsCssUrl(family, fileUrlBold ? [400, 700] : [400]);
    }
    if (!fileUrl) {
      throw new Error(`フォントファイル URL がありません: ${family}`);
    }
  }

  const entry = {
    id: genId("font"),
    family,
    cssUrl,
    fileUrl,
    fileUrlBold,
    source: spec.source || "google",
    libraryId: spec.libraryId || null,
  };
  fonts.push(entry);
  await fetchProjectFontBytes(entry, false);
  if (entry.fileUrlBold) {
    await fetchProjectFontBytes(entry, true);
  }
  pushHistory(`フォント登録: ${family}`);
  syncProjectFontStylesheets(fonts);
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
  if (opts.saveToLibrary !== false && typeof upsertLibraryFont === "function") {
    const lib = await upsertLibraryFont({
      id:
        spec.libraryId ||
        findLibraryFontByFamily(family)?.id ||
        genId("libfont"),
      fontsourceId: spec.fontsourceId || null,
      family: entry.family,
      cssUrl: entry.cssUrl,
      fileUrl: entry.fileUrl,
      fileUrlBold: entry.fileUrlBold,
      source: entry.source,
      category: spec.category || "",
      subsets: spec.subsets || [],
    });
    entry.libraryId = lib.id;
  }
  return entry;
}

async function addProjectFontFromLibrary(libraryEntry) {
  if (!libraryEntry?.family) throw new Error("ライブラリ登録が不正です");
  const existing = findProjectFontByFamily(libraryEntry.family);
  if (existing) return existing;
  return registerProjectFontEntry(
    {
      family: libraryEntry.family,
      cssUrl: libraryEntry.cssUrl,
      fileUrl: libraryEntry.fileUrl,
      fileUrlBold: libraryEntry.fileUrlBold || null,
      source: libraryEntry.source || "google",
      libraryId: libraryEntry.id,
      fontsourceId: libraryEntry.fontsourceId,
      category: libraryEntry.category,
      subsets: libraryEntry.subsets,
      resolveUrls: false,
    },
    { saveToLibrary: false },
  );
}

async function registerGoogleFontCssUrl(inputUrl) {
  const { cssUrl, families } = parseGoogleFontsCssUrlFamilies(inputUrl);
  const added = [];
  const skipped = [];

  for (const family of families) {
    if (findProjectFontByFamily(family)) {
      skipped.push(family);
      continue;
    }
    try {
      const entry = await registerProjectFontEntry(
        { family, cssUrl, source: "google", keepCssUrl: true },
        { saveToLibrary: true },
      );
      added.push(entry);
    } catch (err) {
      if (String(err.message || "").startsWith("登録済み")) {
        skipped.push(family);
      } else {
        throw err;
      }
    }
  }

  if (!added.length) {
    if (skipped.length) {
      throw new Error(`登録済みです: ${skipped.join(", ")}`);
    }
    throw new Error("フォントを登録できませんでした");
  }
  return added;
}

function removeProjectFont(fontId) {
  const fonts = ensureProjectFonts();
  const idx = fonts.findIndex((f) => f.id === fontId);
  if (idx < 0) return false;
  const [removed] = fonts.splice(idx, 1);
  _clearProjectFontCacheForEntry(fontId);
  pushHistory(`フォント削除: ${removed.family}`);
  syncProjectFontStylesheets(fonts);
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
  return true;
}

function hydrateProjectFontsFromState() {
  ensureProjectFonts();
  clearProjectFontBytesCache();
  syncProjectFontStylesheets();
}

function getFontFamilyOptions() {
  const project = getProjectFonts().map((f) => f.family);
  const out = [];
  const seen = new Set();
  for (const name of [...BUILTIN_FONT_FAMILIES, ...project]) {
    const k = name.toLowerCase();
    if (!name || seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}
