"use strict";

importScripts("../vendor/three.min.js", "../vendor/three-stl-exporter.js");

let stlWasmPromise = null;

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

function stlWasmUrl() {
  return new URL("../vendor/stl-binary.wasm", self.location.href).href;
}

async function loadStlWasm() {
  if (!stlWasmPromise) {
    stlWasmPromise = fetch(stlWasmUrl()).then(async (res) => {
      if (!res.ok) throw new Error(`STL WASM not found: ${res.status}`);
      const bytes = await res.arrayBuffer();
      const result = await WebAssembly.instantiate(bytes, {});
      return result.instance;
    });
  }
  return stlWasmPromise;
}

function combinedPositions(meshes) {
  const total = (meshes || []).reduce(
    (sum, payload) => sum + (payload.position?.length || 0),
    0,
  );
  const positions = new Float32Array(total);
  let offset = 0;
  for (const payload of meshes || []) {
    positions.set(payload.position || [], offset);
    offset += payload.position?.length || 0;
  }
  return positions;
}

async function exportBinaryStlWithWasm(meshes) {
  const instance = await loadStlWasm();
  const { memory, stl_binary_size, write_stl_binary } = instance.exports;
  if (!memory || !stl_binary_size || !write_stl_binary) {
    throw new Error("STL WASM exports missing");
  }

  const positions = combinedPositions(meshes);
  const inputBytes = positions.byteLength;
  const inputPtr = 0;
  const outputPtr = (inputBytes + 7) & ~7;
  const outputBytes = stl_binary_size(positions.length);
  const requiredBytes = outputPtr + outputBytes;
  const pageSize = 64 * 1024;
  const currentBytes = memory.buffer.byteLength;
  if (requiredBytes > currentBytes) {
    memory.grow(Math.ceil((requiredBytes - currentBytes) / pageSize));
  }

  new Float32Array(memory.buffer, inputPtr, positions.length).set(positions);
  const written = write_stl_binary(
    inputPtr,
    positions.length,
    outputPtr,
    outputBytes,
  );
  if (written !== outputBytes) {
    throw new Error("STL WASM write failed");
  }
  return memory.buffer.slice(outputPtr, outputPtr + outputBytes);
}

function exportAsciiStlWithThree(meshes) {
  const group = new THREE.Group();
  for (const payload of meshes || []) {
    group.add(new THREE.Mesh(geometryFromPayload(payload)));
  }
  const exporter = new THREE.STLExporter();
  return exporter.parse(group, { binary: false });
}

self.onmessage = (event) => {
  const { id, meshes } = event.data || {};
  exportBinaryStlWithWasm(meshes)
    .then((stl) => {
      self.postMessage({ id, ok: true, stl, binary: true }, [stl]);
    })
    .catch(() => {
      try {
        self.postMessage({
          id,
          ok: true,
          stl: exportAsciiStlWithThree(meshes),
          binary: false,
        });
      } catch (e) {
        self.postMessage({
          id,
          ok: false,
          error: e?.message || "STL export failed",
        });
      }
    });
};
