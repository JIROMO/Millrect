"use strict";

function _pageById(pageId) {
  const state = getState();
  if (pageId) return state.pages.find((p) => p.id === pageId) || null;
  return getCurrentPage();
}

function _layerOnPage(page, layerId) {
  if (!layerId) return getCurrentLayer();
  return page.layers.find((l) => l.id === layerId) || null;
}

/** ページ上のゴースト図形を列挙 */
function getDigitizeProposals(pageId) {
  const page = _pageById(pageId);
  if (!page) return [];
  const out = [];
  for (const layer of page.layers) {
    for (const shape of layer.shapes) {
      if (!shape.ghost) continue;
      out.push({
        id: shape.id,
        type: shape.type,
        layerId: layer.id,
      });
    }
  }
  return out;
}

/** ゴースト図形を削除 */
function clearDigitizeProposals(pageId, opts = {}) {
  const page = _pageById(pageId);
  if (!page) return { ok: false, error: "Page not found" };

  const removed = [];
  for (const layer of page.layers) {
    layer.shapes = layer.shapes.filter((s) => {
      if (!s.ghost) return true;
      removed.push(s.id);
      return false;
    });
  }
  if (!removed.length) return { ok: true, removed: [] };

  if (opts.pushHistory !== false) pushHistory();
  render();
  uiUpdate();
  return { ok: true, removed };
}

/**
 * Vision 等からの primitive 提案をゴースト図形として配置。
 * proposals は mm 第一級（packages/digitize-sketch.js）。
 */
function applyDigitizeProposals(pageId, proposals, opts = {}) {
  const page = _pageById(pageId);
  if (!page) return { ok: false, error: "Page not found" };

  const normalized = normalizeDigitizeProposals(proposals, {
    genId: () => genId("digitize"),
    stroke: opts.stroke,
    fill: opts.fill,
  });
  if (!normalized.ok) return normalized;

  const layer = _layerOnPage(page, opts.layerId);
  if (!layer) return { ok: false, error: "Layer not found" };
  if (layer.locked) return { ok: false, error: "Layer is locked" };

  if (opts.clearExisting !== false) {
    clearDigitizeProposals(pageId, { pushHistory: false });
  }

  const shapeIds = [];
  for (const shape of normalized.shapes) {
    layer.shapes.push(shape);
    shapeIds.push(shape.id);
  }

  pushHistory();
  render();
  uiUpdate();
  return {
    ok: true,
    shapeIds,
    count: shapeIds.length,
    errors: normalized.errors?.length ? normalized.errors : undefined,
  };
}

/** ゴースト図形を確定（ghost フラグ解除 → 3D 対象に） */
function confirmDigitizeProposals(pageId, shapeIds = null) {
  const page = _pageById(pageId);
  if (!page) return { ok: false, error: "Page not found" };

  const confirmed = [];
  const idSet = shapeIds ? new Set(shapeIds) : null;

  for (const layer of page.layers) {
    for (const shape of layer.shapes) {
      if (!shape.ghost) continue;
      if (idSet && !idSet.has(shape.id)) continue;
      delete shape.ghost;
      confirmed.push(shape.id);
    }
  }

  if (!confirmed.length) {
    return { ok: false, error: "No ghost shapes to confirm" };
  }

  pushHistory();
  render();
  uiUpdate();
  if (typeof update3DScene === "function") update3DScene();
  return { ok: true, shapeIds: confirmed };
}
