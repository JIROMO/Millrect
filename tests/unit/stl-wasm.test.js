"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

async function loadStlWasm() {
  const bytes = fs.readFileSync(path.join(ROOT, "app/vendor/stl-binary.wasm"));
  const result = await WebAssembly.instantiate(bytes, {});
  return result.instance;
}

function writeBinaryStl(instance, positions) {
  const { memory, stl_binary_size, write_stl_binary } = instance.exports;
  const inputBytes = positions.byteLength;
  const inputPtr = 0;
  const outputPtr = (inputBytes + 7) & ~7;
  const outputBytes = stl_binary_size(positions.length);
  const requiredBytes = outputPtr + outputBytes;
  const pageSize = 64 * 1024;
  if (requiredBytes > memory.buffer.byteLength) {
    memory.grow(Math.ceil((requiredBytes - memory.buffer.byteLength) / pageSize));
  }
  new Float32Array(memory.buffer, inputPtr, positions.length).set(positions);
  const written = write_stl_binary(
    inputPtr,
    positions.length,
    outputPtr,
    outputBytes,
  );
  assert.equal(written, outputBytes);
  return memory.buffer.slice(outputPtr, outputPtr + outputBytes);
}

test("STL WASM writes a binary STL triangle soup", async () => {
  const instance = await loadStlWasm();
  const stl = writeBinaryStl(
    instance,
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  );
  const view = new DataView(stl);

  assert.equal(stl.byteLength, 134);
  assert.equal(view.getUint32(80, true), 1);

  assert.equal(view.getFloat32(84, true), 0);
  assert.equal(view.getFloat32(88, true), 0);
  assert.ok(Math.abs(view.getFloat32(92, true) - 1) < 1e-5);

  assert.equal(view.getFloat32(96, true), 0);
  assert.equal(view.getFloat32(100, true), 0);
  assert.equal(view.getFloat32(104, true), 0);
  assert.equal(view.getFloat32(108, true), 1);
  assert.equal(view.getFloat32(112, true), 0);
  assert.equal(view.getFloat32(116, true), 0);
  assert.equal(view.getFloat32(120, true), 0);
  assert.equal(view.getFloat32(124, true), 1);
  assert.equal(view.getFloat32(128, true), 0);
  assert.equal(view.getUint16(132, true), 0);
});

test("STL WASM writes deterministic binary size for many triangles", async () => {
  const instance = await loadStlWasm();
  const triangleCount = 512;
  const positions = new Float32Array(triangleCount * 9);
  for (let i = 0; i < triangleCount; i += 1) {
    const o = i * 9;
    const x = i % 32;
    const y = Math.floor(i / 32);
    positions.set([x, y, 0, x + 1, y, 0, x, y + 1, 0], o);
  }

  const stl = writeBinaryStl(instance, positions);
  const view = new DataView(stl);

  assert.equal(stl.byteLength, 84 + triangleCount * 50);
  assert.equal(view.getUint32(80, true), triangleCount);
  assert.equal(view.getUint16(stl.byteLength - 2, true), 0);
});

test("STL WASM build script can keep an existing artifact without rustc", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "scripts/build-stl-wasm.js"),
    "utf8",
  );

  assert.match(source, /function keepExistingOrFail/);
  assert.match(source, /fs\.existsSync\(out\)/);
  assert.match(source, /failed to start rustc/);
  assert.match(source, /rustc exited with status/);
});

test("STL worker caches the instantiated WASM module", () => {
  const source = fs.readFileSync(
    path.join(ROOT, "app/js/3d-stl-worker.js"),
    "utf8",
  );

  assert.match(source, /stlWasmPromise = fetch\(stlWasmUrl\(\)\)\.then/);
  assert.match(source, /return result\.instance/);
  assert.doesNotMatch(source, /stlWasmPromise = await fetch/);
});
