"use strict";

function boxIntersects(a, b) {
  if (!a || !b) return true;
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function isShapeVisibleInCull(shape, page, cullBox, selSet, getBBox) {
  if (!cullBox || selSet?.has(shape.id)) return true;
  let bb = null;
  try {
    bb = getBBox(shape, page.scale);
  } catch {
    return true;
  }
  if (!bb) return true;
  return boxIntersects(bb, cullBox);
}

function visibleShapesForRender(shapes, page, cullBox, selSet, getBBox) {
  if (!cullBox) return shapes;
  return (shapes || []).filter((shape) =>
    isShapeVisibleInCull(shape, page, cullBox, selSet, getBBox),
  );
}

if (typeof module !== "undefined") {
  module.exports = {
    boxIntersects,
    isShapeVisibleInCull,
    visibleShapesForRender,
  };
}

if (typeof window !== "undefined") {
  window.ViewportCulling = {
    boxIntersects,
    isShapeVisibleInCull,
    visibleShapesForRender,
  };
}
