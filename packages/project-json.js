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

/**
 * バックアップ由来の更新日時を IndexedDB で使うミリ秒 timestamp に揃える。
 * 旧バックアップや外部変換データを考慮し、ミリ秒・秒・数値文字列・ISO文字列を受け付ける。
 */
function normalizeProjectUpdatedAt(...candidates) {
  for (const candidate of candidates) {
    if (candidate instanceof Date) {
      const time = candidate.getTime();
      if (Number.isFinite(time)) return time;
      continue;
    }

    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      if (candidate <= 0) continue;
      // Unix秒は現在でも12桁未満。ミリ秒timestampへ変換する。
      return candidate < 100_000_000_000 ? candidate * 1000 : candidate;
    }

    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (!value) continue;

    if (/^\d+(?:\.\d+)?$/.test(value)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric < 100_000_000_000 ? numeric * 1000 : numeric;
      }
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveImportedProjectUpdatedAt(
  project,
  parsedProject,
  backup,
  fallback = Date.now(),
) {
  return normalizeProjectUpdatedAt(
    project?.updatedAt,
    project?.updatedat,
    project?.updated_at,
    parsedProject?.updatedAt,
    parsedProject?.updatedat,
    parsedProject?.updated_at,
    backup?.exportedAt,
    fallback,
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    isMillrectProjectJson,
    normalizeProjectUpdatedAt,
    resolveImportedProjectUpdatedAt,
  };
}
