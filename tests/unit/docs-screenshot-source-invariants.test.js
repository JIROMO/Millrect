"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../../scripts/docs-multiview-scenario.js"),
  "utf8",
);

test("documentation 3D captures force a fresh synchronous scene", () => {
  const helper = source.match(
    /async function waitFor3DMesh[\s\S]*?module\.exports/,
  )?.[0];
  assert.ok(helper, "waitFor3DMesh helper exists");
  assert.ok(
    (helper.match(/update3DScene\(\{ forceSync: true \}\)/g) || []).length >= 2,
    "mesh wait and camera fit both refresh the current scenario synchronously",
  );
});
