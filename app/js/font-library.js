"use strict";

const _LIBRARY_STORAGE_KEY = "millrect-font-library";
const _CATALOG_STORAGE_KEY = "millrect-font-catalog-cache";

let _libraryCache = null;

async function _readPersisted(kind) {
  if (window.electronAPI?.readFontLibrary) {
    return kind === "library"
      ? window.electronAPI.readFontLibrary()
      : window.electronAPI.readFontCatalogCache();
  }
  const key = kind === "library" ? _LIBRARY_STORAGE_KEY : _CATALOG_STORAGE_KEY;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function _writePersisted(kind, data) {
  if (window.electronAPI?.writeFontLibrary) {
    if (kind === "library") {
      await window.electronAPI.writeFontLibrary(data);
    } else {
      await window.electronAPI.writeFontCatalogCache(data);
    }
    return;
  }
  const key = kind === "library" ? _LIBRARY_STORAGE_KEY : _CATALOG_STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(data));
}

function _normalizeFamilyKey(family) {
  return String(family || "")
    .toLowerCase()
    .replace(/[\s-_]/g, "");
}

async function loadFontLibrary() {
  if (_libraryCache) return _libraryCache;
  const raw = await _readPersisted("library");
  _libraryCache = {
    version: 1,
    fonts: Array.isArray(raw?.fonts) ? raw.fonts : [],
  };
  return _libraryCache;
}

function getFontLibraryFonts() {
  return _libraryCache?.fonts || [];
}

async function saveFontLibrary(data) {
  _libraryCache = {
    version: 1,
    fonts: Array.isArray(data?.fonts) ? data.fonts : [],
  };
  await _writePersisted("library", _libraryCache);
}

function findLibraryFontByFamily(family) {
  const needle = _normalizeFamilyKey(family);
  if (!needle) return null;
  for (const entry of getFontLibraryFonts()) {
    if (_normalizeFamilyKey(entry.family) === needle) return entry;
  }
  return null;
}

function findLibraryFontById(id) {
  return getFontLibraryFonts().find((f) => f.id === id) || null;
}

async function upsertLibraryFont(entry) {
  const lib = await loadFontLibrary();
  const dup = findLibraryFontByFamily(entry.family);
  if (dup) {
    Object.assign(dup, {
      cssUrl: entry.cssUrl || dup.cssUrl,
      fileUrl: entry.fileUrl || dup.fileUrl,
      fileUrlBold: entry.fileUrlBold || dup.fileUrlBold || null,
      fontsourceId: entry.fontsourceId || dup.fontsourceId,
      category: entry.category || dup.category,
      subsets: entry.subsets || dup.subsets,
    });
    await saveFontLibrary(lib);
    return dup;
  }
  lib.fonts.push(entry);
  await saveFontLibrary(lib);
  return entry;
}

async function removeLibraryFont(fontId) {
  const lib = await loadFontLibrary();
  const idx = lib.fonts.findIndex((f) => f.id === fontId);
  if (idx < 0) return false;
  lib.fonts.splice(idx, 1);
  await saveFontLibrary(lib);
  return true;
}

async function registerFontsourceFamilyToLibrary(meta) {
  const existing = findLibraryFontByFamily(meta.family);
  const entry = libraryEntryFromFontsourceMeta(meta, existing?.id);
  return upsertLibraryFont(entry);
}

async function getFontCatalogItems(forceRefresh = false) {
  const cached = await _readPersisted("catalog");
  if (
    !forceRefresh &&
    cached?.fetchedAt &&
    Array.isArray(cached.items) &&
    Date.now() - cached.fetchedAt < FONT_CATALOG_TTL_MS
  ) {
    return cached.items;
  }
  const items = await fetchFontsourceCatalog();
  await _writePersisted("catalog", {
    fetchedAt: Date.now(),
    items,
  });
  return items;
}

async function hydrateFontLibrary() {
  await loadFontLibrary();
}
