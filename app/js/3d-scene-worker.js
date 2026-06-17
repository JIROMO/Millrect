"use strict";

let __workerState = null;
let __workerMessages = {};

function getState() {
  return __workerState;
}

function findShapeById(id) {
  for (const page of __workerState?.pages || []) {
    for (const layer of page.layers || []) {
      for (const shape of layer.shapes || []) {
        if (shape.id === id) return { shape, layer, page, isDimension: false };
        if (shape.type === "group") {
          const child = (shape.children || []).find((c) => c.id === id);
          if (child) return { shape: child, layer, page, isDimension: false };
        }
      }
    }
    for (const dim of page.dimensions || []) {
      if (dim.id === id) {
        return { shape: dim, layer: null, page, isDimension: true };
      }
    }
  }
  return null;
}

function t(key, vars = {}) {
  let text = __workerMessages[key] || key;
  for (const [name, value] of Object.entries(vars || {})) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

importScripts(
  "../vendor/three.min.js",
  "../vendor/csg.js",
  "../vendor/csg-three-adapter.js",
  "transform.js",
  "profiles.js",
  "3d-view.js",
);

function _payloadFromMesh(mesh) {
  mesh.updateMatrixWorld(true);
  const geometry = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const position = geometry.attributes.position.array.slice();
  const normal = geometry.attributes.normal?.array.slice() || null;
  const color = mesh.material?.color
    ? `#${mesh.material.color.getHexString()}`
    : "#5965f9";
  geometry.dispose();
  _disposeMesh(mesh);
  return { position, normal, color };
}

self.onmessage = (event) => {
  const { id, state, messages } = event.data || {};
  __workerState = state;
  __workerMessages = messages || {};
  const meshes = [];
  const transfers = [];

  try {
    const result = _build3DSceneFromViews({
      state,
      addMesh(mesh) {
        const payload = _payloadFromMesh(mesh);
        meshes.push(payload);
        transfers.push(payload.position.buffer);
        if (payload.normal) transfers.push(payload.normal.buffer);
      },
    });
    self.postMessage({ id, result, meshes }, transfers);
  } catch (e) {
    self.postMessage({
      id,
      result: {
        ok: false,
        message: e?.message || t("view3d.generateFailed"),
        warnings: [],
      },
      meshes: [],
    });
  } finally {
    __workerState = null;
  }
};
