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
