"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../../app/js/interaction.js"),
  "utf8",
);

test("context menu preserves a geometrically hit current selection before using the top DOM hit", () => {
  assert.match(
    source,
    /_contextPointHitsCurrentSelection\(state, rp, hitId\)/,
  );
  assert.match(source, /if \(hitId && !keepCurrentSelection\)/);
  assert.match(
    source,
    /realPointInShapeGeometry\(rp, found\.shape, page\.scale\)/,
  );
});
