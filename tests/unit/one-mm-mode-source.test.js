"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const read = (relative) =>
  fs.readFileSync(path.join(ROOT, relative), "utf8");

test("1 mm mode is exposed in page settings and both locales", () => {
  const sidebar = read("app/js/components/millrect-right-sidebar.js");
  const ja = read("app/js/locales/ja.js");
  const en = read("app/js/locales/en.js");
  assert.match(sidebar, /id="one-mm-mode"/);
  assert.match(sidebar, /data-i18n="page\.oneMmMode"/);
  assert.match(ja, /"page\.oneMmMode": "1mmモード"/);
  assert.match(en, /"page\.oneMmMode": "1 mm mode"/);
});

test("1 mm mode is applied to drawing, movement, resize and numeric position", () => {
  const interaction = read("app/js/interaction.js");
  const panel = read("app/js/panel-transform.js");
  const ui = read("app/js/ui.js");
  assert.match(interaction, /quantizeRealPointForUnitMode\(rp, state\)/);
  assert.match(interaction, /quantizeMoveDeltaForUnitMode\(/);
  assert.match(interaction, /_quantizePrimitiveGeometryForUnitMode\(shape\)/);
  assert.match(panel, /quantizeMmForUnitMode\(parseFloat\(posX\.value\)\)/);
  assert.match(ui, /getState\(\)\.oneMmMode = e\.target\.checked/);
});
