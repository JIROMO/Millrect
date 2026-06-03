"use strict";

/** Millrect プロジェクト JSON（.json）の最小スキーマ検証 */
function isMillrectProjectJson(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (!Array.isArray(data.pages) || data.pages.length === 0) return false;
  return data.pages.every((page) => {
    if (!page || typeof page !== "object" || Array.isArray(page)) return false;
    if (typeof page.id !== "string" || !page.id) return false;
    if (!Array.isArray(page.layers) || page.layers.length === 0) return false;
    return page.layers.every((layer) => {
      if (!layer || typeof layer !== "object" || Array.isArray(layer))
        return false;
      if (typeof layer.id !== "string" || !layer.id) return false;
      return Array.isArray(layer.shapes);
    });
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { isMillrectProjectJson };
}
