"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");

function boot3DExportHelpers() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.t = (key) => key;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, "app/vendor/three.min.js"), "utf8"),
    sandbox,
    { filename: "app/vendor/three.min.js" },
  );
  vm.runInContext(
    `${fs.readFileSync(path.join(ROOT, "app/js/3d-view.js"), "utf8")}
      globalThis.__export3DTest = {
        _profileToThreeShapesForView,
        _weldTriangleSoup,
        _splitBoundaryTJunctions,
        _validateMeshGeometry,
      };`,
    sandbox,
    { filename: "app/js/3d-view.js" },
  );
  return { THREE: sandbox.THREE, ...sandbox.__export3DTest };
}

function roundedHandleWithRectHolesProfile() {
  const outer = [];
  const add = (x, y) => outer.push([x * 10, y * 10]);
  const arc = (cx, cy, start, end, steps = 20) => {
    for (let i = 1; i <= steps; i++) {
      const angle = start + ((end - start) * i) / steps;
      add(cx + 3 * Math.cos(angle), cy + 3 * Math.sin(angle));
    }
  };

  add(0, 3);
  arc(3, 3, Math.PI, Math.PI * 1.5);
  add(27, 0);
  arc(27, 3, Math.PI * 1.5, Math.PI * 2);
  add(30, 10);
  add(60, 10);
  add(60, 3);
  arc(63, 3, Math.PI, Math.PI * 1.5);
  add(87, 0);
  arc(87, 3, Math.PI * 1.5, Math.PI * 2);
  add(90, 37);
  arc(87, 37, 0, Math.PI * 0.5);
  add(63, 40);
  arc(63, 37, Math.PI * 0.5, Math.PI);
  add(60, 30);
  add(30, 30);
  add(30, 37);
  arc(27, 37, 0, Math.PI * 0.5);
  add(3, 40);
  arc(3, 37, Math.PI * 0.5, Math.PI);
  add(0, 3);

  const ring = (points) => points.map(([x, y]) => [x * 10, y * 10]);
  return {
    rings: [
      outer,
      ring([
        [10, 10],
        [10, 30],
        [20, 30],
        [20, 10],
        [10, 10],
      ]),
      ring([
        [70, 10],
        [70, 30],
        [80, 30],
        [80, 10],
        [70, 10],
      ]),
    ],
    bbox: { x: 0, y: 0, w: 900, h: 400 },
  };
}

test("STL cleanup closes cap T-junctions in a rounded handle with rectangular holes", () => {
  const api = boot3DExportHelpers();
  const profile = roundedHandleWithRectHolesProfile();
  const shapes = api._profileToThreeShapesForView(
    profile,
    {},
    "top",
    { bbox: profile.bbox },
  );
  const raw = new api.THREE.ExtrudeGeometry(shapes, {
    depth: 2,
    bevelEnabled: false,
  });
  const welded = api._weldTriangleSoup(raw.attributes.position.array);

  assert.deepEqual(
    Array.from(api._validateMeshGeometry(welded).warnings),
    ["view3d.openEdges"],
    "fixture must reproduce the original false open-edge warning",
  );

  const split = api._splitBoundaryTJunctions(welded);
  assert.notEqual(split, welded);
  assert.deepEqual(Array.from(api._validateMeshGeometry(split).warnings), []);

  raw.dispose();
  welded.dispose();
  split.dispose();
});
