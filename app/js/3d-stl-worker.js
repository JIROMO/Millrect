"use strict";

importScripts("../vendor/three.min.js", "../vendor/three-stl-exporter.js");

function geometryFromPayload(payload) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(payload.position), 3),
  );
  if (payload.normal) {
    geo.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(payload.normal), 3),
    );
  } else {
    geo.computeVertexNormals();
  }
  return geo;
}

self.onmessage = (event) => {
  const { id, meshes } = event.data || {};
  try {
    const group = new THREE.Group();
    for (const payload of meshes || []) {
      group.add(new THREE.Mesh(geometryFromPayload(payload)));
    }
    const exporter = new THREE.STLExporter();
    self.postMessage({
      id,
      ok: true,
      stl: exporter.parse(group, { binary: false }),
    });
  } catch (e) {
    self.postMessage({
      id,
      ok: false,
      error: e?.message || "STL export failed",
    });
  }
};
