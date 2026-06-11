"use strict";

interface TextShapeFontCandidate {
  fontFamily?: unknown;
}

interface ProjectFontCandidate {
  family: string;
}

declare function findProjectFontByFamily(
  family: unknown,
): ProjectFontCandidate | null | undefined;

/** 同梱テキストフォント（追加はプロジェクト Google Fonts 登録） */
const BUILTIN_FONT_GEN = "Gen Interface JP";
const BUILTIN_FONT_FAMILIES = [BUILTIN_FONT_GEN];
const DEFAULT_TEXT_FONT_FAMILY = BUILTIN_FONT_GEN;

function normalizeTextFontFamily(fontFamily: unknown): string {
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

function isBuiltinFontFamily(fontFamily: unknown): boolean {
  const n = normalizeTextFontFamily(fontFamily);
  return BUILTIN_FONT_FAMILIES.includes(n);
}

function findProjectFont(family: unknown): ProjectFontCandidate | null {
  if (typeof findProjectFontByFamily !== "function") return null;
  return findProjectFontByFamily(family) || null;
}

function textEnginePrimaryFontFamily(shape?: TextShapeFontCandidate): string {
  const normalized = normalizeTextFontFamily(shape?.fontFamily);
  if (findProjectFont(normalized)) {
    return normalized;
  }
  if (isBuiltinFontFamily(normalized)) return normalized;
  const projectFont = findProjectFont(shape?.fontFamily);
  if (projectFont) {
    return projectFont.family;
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

// バンドル時の global 面（module.exports と同一）。script タグ時代の
// トップレベル宣言によるグローバル公開と同等の面を明示的に維持する。
if (typeof window !== "undefined") {
  Object.assign(window, {
    BUILTIN_FONT_GEN,
    BUILTIN_FONT_FAMILIES,
    DEFAULT_TEXT_FONT_FAMILY,
    TEXT_ENGINE_CJK_FALLBACK_FAMILIES,
    normalizeTextFontFamily,
    isBuiltinFontFamily,
    textEnginePrimaryFontFamily,
  });
}
