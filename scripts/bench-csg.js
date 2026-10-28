"use strict";

// 3D 生成（多ビュー CSG）のベンチマーク: csg.js（BSP）と manifold-3d（WASM）を比較する。
// 使い方: node scripts/bench-csg.js [--runs 3]
// 3d-scene-worker.js と同じスクリプト群を vm で読み込み、_build3DSceneFromViews を
// 両エンジンで実行して時間・三角形数・開いたエッジ数を出す。

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app");
const RUNS = Number(process.argv[process.argv.indexOf("--runs") + 1]) || 3;

function bootScene() {
  const sandbox = { console, performance };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.t = (key) => key;
  vm.createContext(sandbox);
  for (const file of [
    "vendor/three.min.js",
    "vendor/csg.js",
    "vendor/csg-three-adapter.js",
    "vendor/csg-manifold-adapter.js",
    "js/transform.js",
    "js/profiles.js",
    "js/3d-view.js",
  ]) {
    vm.runInContext(fs.readFileSync(path.join(APP, file), "utf8"), sandbox, {
      filename: file,
    });
  }
  vm.runInContext(
    `globalThis.__bench = {
       build: _build3DSceneFromViews,
       ManifoldCSG,
       setState(s) { globalThis.__state = s; },
     };
     function getState() { return globalThis.__state; }
     function findShapeById() { return null; }`,
    sandbox,
  );
  return sandbox;
}

// ── テスト用シーン ───────────────────────────────────────────
const R = 10; // real units / mm

function circleRing(cx, cy, r, seg = 48) {
  const ring = [];
  for (let i = 0; i <= seg; i++) {
    const a = (-2 * Math.PI * i) / seg;
    ring.push([(cx + r * Math.cos(a)) * R, (cy + r * Math.sin(a)) * R]);
  }
  return ring;
}

function rectRing(x, y, w, h) {
  return [
    [x * R, y * R],
    [(x + w) * R, y * R],
    [(x + w) * R, (y + h) * R],
    [x * R, (y + h) * R],
    [x * R, y * R],
  ];
}

// 上辺が半円アーチの輪郭（正面図・丸頭）
function archRing(x, y, w, h, seg = 48) {
  const r = w / 2;
  const ring = [[x * R, (y + h) * R]];
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI + (Math.PI * i) / seg;
    ring.push([(x + r + r * Math.cos(a)) * R, (y + r + r * Math.sin(a)) * R]);
  }
  ring.push([(x + w) * R, (y + h) * R], [x * R, (y + h) * R]);
  return ring;
}

function pathShape(id, contours, extra = {}) {
  return {
    id,
    type: "path",
    contours,
    stroke: "#1a1a2e",
    fill: "#cccccc",
    strokeWidth: "thin",
    ...extra,
  };
}

function page(id, viewType, shapes) {
  return {
    id,
    name: id,
    paper: "A4",
    orientation: "landscape",
    scale: { numerator: 1, denominator: 1 },
    viewDefinition: { type: viewType, normal: null, up: null },
    dimensions: [],
    constraints: [],
    layers: [{ id: `${id}-l`, name: "L", visible: true, locked: false, shapes }],
  };
}

function project(pages) {
  return { projectName: "bench", unit: "mm", fonts: [], pages };
}

// 穴あきプレート（上面 N×N 穴）× 丸頭の正面図
function holePlate(n, seg) {
  const size = 20 + n * 12;
  const holes = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      holes.push(circleRing(16 + i * 12, 16 + j * 12, 3.5, seg));
  const top = pathShape("plate-top", [[rectRing(10, 10, size, size), ...holes]], {
    solidIntersect: true,
  });
  const front = pathShape("plate-front", [[archRing(10, 10, size, size * 0.6)]]);
  return project([page("top", "top", [top]), page("front", "front", [front])]);
}

// 3 ビューとも穴あき（top + front + right）
function threeViewBracket(seg) {
  const top = pathShape(
    "br-top",
    [[rectRing(10, 10, 80, 50), circleRing(30, 35, 6, seg), circleRing(70, 35, 6, seg)]],
    { solidIntersect: true },
  );
  const front = pathShape("br-front", [
    [archRing(10, 10, 80, 60, seg), circleRing(50, 50, 10, seg)],
  ]);
  const right = pathShape("br-right", [
    [rectRing(10, 10, 50, 60), circleRing(35, 30, 5, seg)],
  ]);
  return project([
    page("top", "top", [top]),
    page("front", "front", [front]),
    page("right", "right", [right]),
  ]);
}

function moduleJoint() {
  const s = require(path.join(ROOT, "packages/module-joint-1-scenario.js"));
  const state = JSON.parse(JSON.stringify(s.buildModuleJoint1ProjectState()));
  for (const p of state.pages)
    for (const l of p.layers)
      for (const sh of l.shapes) if (sh.type === "path") sh.solidIntersect = true;
  return state;
}

const SCENES = [
  ["プレート 3×3穴 (48分割)", () => holePlate(3, 48)],
  ["プレート 6×6穴 (48分割)", () => holePlate(6, 48)],
  ["プレート 10×10穴 (32分割)", () => holePlate(10, 32)],
  ["3ビュー ブラケット (64分割)", () => threeViewBracket(64)],
  ["module-joint-1 (solidIntersect)", moduleJoint],
];

// ── 計測 ────────────────────────────────────────────────────
function openEdges(position) {
  const key = (i) =>
    `${Math.round(position[i] * 1e4)},${Math.round(position[i + 1] * 1e4)},${Math.round(position[i + 2] * 1e4)}`;
  const edges = new Map();
  for (let t = 0; t < position.length; t += 9) {
    const k = [key(t), key(t + 3), key(t + 6)];
    for (let e = 0; e < 3; e++) {
      const a = k[e],
        b = k[(e + 1) % 3];
      if (a === b) continue;
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(ek, (edges.get(ek) || 0) + 1);
    }
  }
  let open = 0;
  for (const c of edges.values()) if (c !== 2) open++;
  return open;
}

// 符号付き体積（mm^3）。閉じていない BSP 出力でも概算比較には使える
function volume(p) {
  let v = 0;
  for (let t = 0; t < p.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = p.subarray(t, t + 9);
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

function runOnce(sb, state) {
  sb.__bench.setState(state);
  const meshes = [];
  const t0 = performance.now();
  const result = sb.__bench.build({
    state,
    addMesh(mesh) {
      mesh.updateMatrixWorld(true);
      const g = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      meshes.push(g.attributes.position.array);
    },
  });
  const ms = performance.now() - t0;
  const tris = meshes.reduce((n, p) => n + p.length / 9, 0);
  const open = meshes.reduce((n, p) => n + openEdges(p), 0);
  const vol = meshes.reduce((n, p) => n + volume(p), 0);
  return { ms, tris, open, vol, ok: result?.ok !== false, meshCount: meshes.length };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const { default: Module } = await import(
    pathToFileURL(path.join(ROOT, "node_modules/manifold-3d/manifold.js")).href
  );
  const wasm = await Module();

  const bsp = bootScene();
  const mf = bootScene();
  mf.__bench.ManifoldCSG.init(wasm);

  const rows = [];
  for (const [name, make] of SCENES) {
    const out = {};
    for (const [label, sb] of [
      ["bsp", bsp],
      ["manifold", mf],
    ]) {
      const results = [];
      for (let i = 0; i < RUNS; i++) results.push(runOnce(sb, make()));
      out[label] = { ...results[0], ms: median(results.map((r) => r.ms)) };
    }
    rows.push({ name, ...out });
    const b = out.bsp,
      m = out.manifold;
    console.log(
      `${name}\n` +
        `  csg.js   : ${b.ms.toFixed(0).padStart(7)} ms  tris=${b.tris}  open=${b.open}  vol=${b.vol.toFixed(0)}  meshes=${b.meshCount}\n` +
        `  manifold : ${m.ms.toFixed(0).padStart(7)} ms  tris=${m.tris}  open=${m.open}  vol=${m.vol.toFixed(0)}  meshes=${m.meshCount}\n` +
        `  → ${(b.ms / m.ms).toFixed(1)}x`,
    );
  }
  console.log(
    `\nmanifold ops=${mf.__bench.ManifoldCSG.stats.ops} fallbacks=${mf.__bench.ManifoldCSG.stats.fallbacks}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
