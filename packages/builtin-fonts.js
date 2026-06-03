"use strict";

/** 同梱テキストフォント（追加はプロジェクト Google Fonts 登録） */
const BUILTIN_FONT_GEN = "Gen Interface JP";
const BUILTIN_FONT_FAMILIES = [BUILTIN_FONT_GEN];
const DEFAULT_TEXT_FONT_FAMILY = BUILTIN_FONT_GEN;

function normalizeTextFontFamily(fontFamily) {
  const raw = String(fontFamily || DEFAULT_TEXT_FONT_FAMILY)
    .split(",")[0]
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const k = raw.toLowerCase().replace(/[\s-_]/g, "");
  if (
    !k ||
    k === "sansserif" ||
    k === "arial" ||
    k === "inter" ||
    k.includes("helvetica") ||
    k.includes("notosansjp") ||
    (k.includes("noto") && k.includes("sans")) ||
    k.includes("geninterfacejp") ||
    k === "geninterface"
  ) {
    return BUILTIN_FONT_GEN;
  }
  return raw;
}

function isBuiltinFontFamily(fontFamily) {
  const n = normalizeTextFontFamily(fontFamily);
  return BUILTIN_FONT_FAMILIES.includes(n);
}

function textEnginePrimaryFontFamily(shape) {
  const normalized = normalizeTextFontFamily(shape?.fontFamily);
  if (
    typeof findProjectFontByFamily === "function" &&
    findProjectFontByFamily(normalized)
  ) {
    return normalized;
  }
  if (isBuiltinFontFamily(normalized)) return normalized;
  if (
    typeof findProjectFontByFamily === "function" &&
    findProjectFontByFamily(shape?.fontFamily)
  ) {
    return findProjectFontByFamily(shape.fontFamily).family;
  }
  return normalized || DEFAULT_TEXT_FONT_FAMILY;
}

const TEXT_ENGINE_CJK_FALLBACK_FAMILIES = [BUILTIN_FONT_GEN];

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BUILTIN_FONT_GEN,
    BUILTIN_FONT_FAMILIES,
    DEFAULT_TEXT_FONT_FAMILY,
    TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
    normalizeTextFontFamily,
    isBuiltinFontFamily,
    textEnginePrimaryFontFamily,
  };
}
