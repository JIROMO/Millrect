"use strict";

// Canonical path contours remain the source of truth for saving, Boolean
// operations, manufacturing output and exports. The geometry below is a
// disposable interaction representation used only for screen rendering and
// picking. Keeping it separate lets dense Boolean results stay exact without
// making every pointer interaction walk all canonical vertices.
const PATH_INTERACTION_TOLERANCE_PAPER = 0.02;
const PATH_INTERACTION_CACHE_LIMIT = 500;
const _pathInteractionGeometryCache = new Map();

function _pathInteractionScaleKey(scale) {
  return scale ? `${scale.numerator}/${scale.denominator}` : "1/1";
}

function _pathInteractionCacheKey(shape, scale, ancestorGroups) {
  if (!shape?.id) return null;
  const shapeVersion =
    typeof getShapeRenderVersion === "function"
      ? getShapeRenderVersion(shape.id)
      : 0;
  const ancestorVersion = (ancestorGroups || [])
    .map((group) => {
      const version =
        typeof getShapeRenderVersion === "function"
          ? getShapeRenderVersion(group.id)
          : 0;
      return `${group.id}:${version}`;
    })
    .join("/");
  return `${shape.id}|${shapeVersion}|${_pathInteractionScaleKey(scale)}|${ancestorVersion}`;
}

function _rememberPathInteractionGeometry(key, geometry) {
  if (!key) return geometry;
  if (_pathInteractionGeometryCache.size >= PATH_INTERACTION_CACHE_LIMIT) {
    _pathInteractionGeometryCache.delete(
      _pathInteractionGeometryCache.keys().next().value,
    );
  }
  _pathInteractionGeometryCache.set(key, geometry);
  return geometry;
}

function _interactionRingBounds(ring) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function getPathInteractionGeometry(shape, scale, ancestorGroups = []) {
  if (shape?.type !== "path" || !shape.contours?.length) return null;
  const key = _pathInteractionCacheKey(shape, scale, ancestorGroups);
  const cached = key ? _pathInteractionGeometryCache.get(key) : null;
  if (cached) return cached;

  const displayPaperRings = [];
  const hitRealRings = [];
  const hitRingBounds = [];
  let canonicalVertexCount = 0;
  const needsTransform =
    typeof hasVisualTransform === "function" &&
    typeof applyWorldTransformReal === "function" &&
    (hasVisualTransform(shape) || ancestorGroups.some(hasVisualTransform));

  for (const polygon of shape.contours) {
    for (const ring of polygon) {
      if (!ring?.length) continue;
      canonicalVertexCount += ring.length;
      const canonicalPaperRing = ring.map(([x, y]) => [
        realToPaperDist(x, scale),
        realToPaperDist(y, scale),
      ]);
      const displayPaperRing = _simplifySnapRing(
        canonicalPaperRing,
        PATH_INTERACTION_TOLERANCE_PAPER,
      );
      if (!displayPaperRing.length) continue;
      displayPaperRings.push(displayPaperRing);

      const hitRealRing = displayPaperRing.map(([px, py]) => {
        const x = paperToRealDist(px, scale);
        const y = paperToRealDist(py, scale);
        return needsTransform
          ? applyWorldTransformReal(x, y, shape, ancestorGroups)
          : [x, y];
      });
      hitRealRings.push(hitRealRing);
      hitRingBounds.push(_interactionRingBounds(hitRealRing));
    }
  }

  return _rememberPathInteractionGeometry(key, {
    canonicalVertexCount,
    displayPaperRings,
    hitRealRings,
    hitRingBounds,
    tolerancePaper: PATH_INTERACTION_TOLERANCE_PAPER,
  });
}

