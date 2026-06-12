"use strict";

// Fontsource API helpers — catalog browse, CSS URL build, TTF pick.

const FONTSOURCE_API_BASE = "https://api.fontsource.org/v1/fonts";
const FONT_CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildGoogleFontsCssUrl(family, weights) {
  const name = String(family || "").trim();
  if (!name) throw new Error("フォント名が空です");
  const param = name.replace(/\s+/g, "+");
  const w = Array.isArray(weights)
    ? [...new Set(weights.filter((n) => Number.isFinite(n)))].sort(
        (a, b) => a - b,
      )
    : [];
  if (w.length > 1 || (w.length === 1 && w[0] !== 400)) {
    return `https://fonts.googleapis.com/css2?family=${param}:wght@${w.join(";")}&display=swap`;
  }
  return `https://fonts.googleapis.com/css2?family=${param}&display=swap`;
}

function fontsourceSlug(familyOrId) {
  return String(familyOrId || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function pickFontsourceTtfUrl(meta, opts = {}) {
  const weight = opts.weight ?? 400;
  const style = opts.style ?? "normal";
  const preferJapanese = opts.preferJapanese !== false;
  const variants = meta?.variants;
  if (variants && typeof variants === "object") {
    const weightKeys = Object.keys(variants);
    const wKey = variants[weight] ? String(weight) : weightKeys[0];
    const styleObj = variants[wKey]?.[style] || variants[wKey]?.normal;
    if (styleObj && typeof styleObj === "object") {
      const subsets = meta.subsets || [];
      const subsetOrder = [];
      if (preferJapanese && subsets.includes("japanese")) {
        subsetOrder.push("japanese");
      }
      if (subsets.includes("latin")) subsetOrder.push("latin");
      for (const sub of subsets) {
        if (!subsetOrder.includes(sub)) subsetOrder.push(sub);
      }
      for (const sub of subsetOrder) {
        const ttf = styleObj[sub]?.url?.ttf || styleObj[sub]?.ttf;
        if (ttf) return ttf;
      }
    }
  }
  const slug = meta?.id || fontsourceSlug(meta?.family);
  const ver = meta?.npmVersion || "latest";
  const subsets = meta?.subsets || ["latin"];
  const subset =
    preferJapanese && subsets.includes("japanese")
      ? "japanese"
      : subsets.includes("latin")
        ? "latin"
        : subsets[0];
  const weights = meta?.weights || [400];
  const w = weights.includes(weight) ? weight : weights[0];
  const st = (meta?.styles || ["normal"])[0] || "normal";
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@${ver}/${subset}-${w}-${st}.ttf`;
}

function projectFontUrlsFromFontsourceMeta(meta) {
  const weights = meta?.weights || [400];
  const fileUrl = pickFontsourceTtfUrl(meta, { weight: 400 });
  const fileUrlBold = weights.includes(700)
    ? pickFontsourceTtfUrl(meta, { weight: 700 })
    : null;
  const cssWeights = fileUrlBold ? [400, 700] : [400];
  return {
    fileUrl,
    fileUrlBold,
    cssUrl: buildGoogleFontsCssUrl(meta.family, cssWeights),
  };
}

function libraryEntryFromFontsourceMeta(meta, existingId) {
  const family = meta.family;
  const urls = projectFontUrlsFromFontsourceMeta(meta);
  return {
    id:
      existingId ||
      (typeof genId === "function"
        ? genId("libfont")
        : `libfont-${Date.now()}`),
    fontsourceId: meta.id,
    family,
    cssUrl: urls.cssUrl,
    fileUrl: urls.fileUrl,
    fileUrlBold: urls.fileUrlBold,
    source: "google",
    category: meta.category || "",
    subsets: Array.isArray(meta.subsets) ? meta.subsets.slice() : [],
  };
}

async function resolveProjectFontUrls(family, cssUrl) {
  try {
    const meta = await fetchFontsourceFontMeta(family);
    return { ...projectFontUrlsFromFontsourceMeta(meta), meta };
  } catch (_) {
    const fileUrl = await resolveOutlineFontFileUrl(family, cssUrl);
    return {
      fileUrl,
      fileUrlBold: null,
      cssUrl: cssUrl || buildGoogleFontsCssUrl(family),
      meta: null,
    };
  }
}

async function fetchFontsourceCatalog(query = "") {
  const url = query ? `${FONTSOURCE_API_BASE}?${query}` : FONTSOURCE_API_BASE;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fontsource 一覧の取得に失敗 (${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Fontsource 一覧の形式が不正です");
  return data;
}

async function fetchFontsourceFontMeta(idOrFamily) {
  const slug = fontsourceSlug(idOrFamily);
  const res = await fetch(`${FONTSOURCE_API_BASE}/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    throw new Error(
      `Fontsource に「${idOrFamily}」が見つかりません (${res.status})`,
    );
  }
  return res.json();
}

function filterFontCatalog(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  const q = String(opts.query || "")
    .trim()
    .toLowerCase();
  const japaneseOnly = !!opts.japaneseOnly;
  const category = String(opts.category || "")
    .trim()
    .toLowerCase();
  let out = list.filter((item) => item?.type === "google" && item.family);
  if (japaneseOnly) {
    out = out.filter((item) => (item.subsets || []).includes("japanese"));
  }
  if (category) {
    out = out.filter(
      (item) => String(item.category || "").toLowerCase() === category,
    );
  }
  if (q) {
    out = out.filter((item) => {
      const family = String(item.family).toLowerCase();
      const id = String(item.id || "").toLowerCase();
      return family.includes(q) || id.includes(q.replace(/\s+/g, "-"));
    });
  }
  out.sort((a, b) => String(a.family).localeCompare(String(b.family), "ja"));
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FONTSOURCE_API_BASE,
    FONT_CATALOG_TTL_MS,
    buildGoogleFontsCssUrl,
    fontsourceSlug,
    pickFontsourceTtfUrl,
    projectFontUrlsFromFontsourceMeta,
    libraryEntryFromFontsourceMeta,
    resolveProjectFontUrls,
    fetchFontsourceCatalog,
    fetchFontsourceFontMeta,
    filterFontCatalog,
  };
}
