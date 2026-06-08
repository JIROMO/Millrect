"use strict";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Millrect プロジェクト JSON（.json）の最小スキーマ検証 */
function isMillrectProjectJson(data: unknown): data is MillrectProjectJson {
  if (!isRecord(data)) return false;
  if (!Array.isArray(data.pages) || data.pages.length === 0) return false;
  return data.pages.every((page: unknown) => {
    if (!isRecord(page)) return false;
    if (typeof page.id !== "string" || !page.id) return false;
    if (!Array.isArray(page.layers) || page.layers.length === 0) return false;
    return page.layers.every((layer: unknown) => {
      if (!isRecord(layer)) return false;
      if (typeof layer.id !== "string" || !layer.id) return false;
      return Array.isArray(layer.shapes);
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { isMillrectProjectJson };
}
