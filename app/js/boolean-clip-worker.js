"use strict";

importScripts("../vendor/polygon-clipping.umd.js", "boolean-clip-core.js");

self.onmessage = (event) => {
  const { id, op, polys, options } = event.data || {};
  try {
    const contours = runBooleanClipOperation(op, polys, options);
    self.postMessage({ id, ok: true, contours });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error?.message || String(error || "Boolean operation failed"),
    });
  }
};
