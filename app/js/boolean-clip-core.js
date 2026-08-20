"use strict";

// Pure polygon operation shared by the main-thread fallback and the Boolean
// Worker. Document mutation, selection and history deliberately stay outside.
function runBooleanClipOperation(op, polys, options = {}) {
  if (!Array.isArray(polys) || !polys.length) return null;
  if (op === "subtract") {
    if (polys.length < 2) return null;
    const baseCount = Math.max(1, Number(options.baseCount) || 1);
    const basePolys = polys.slice(0, baseCount);
    const cuts = polys.slice(baseCount);
    if (!cuts.length) return null;
    const base =
      basePolys.length === 1
        ? basePolys[0]
        : polygonClipping.union(...basePolys);
    return polygonClipping.difference(base, ...cuts);
  }
  if (op === "union") return polygonClipping.union(...polys);
  if (op === "intersection") return polygonClipping.intersection(...polys);
  if (op === "exclude") {
    if (polys.length === 1) return polys[0];
    return polygonClipping.xor(...polys);
  }
  return null;
}
