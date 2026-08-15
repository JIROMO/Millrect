"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  formatBuildDate,
  updateBundleVersion,
} = require("../../scripts/build-app-js");

test("app bundle cache buster is generated from the build date", () => {
  assert.equal(formatBuildDate(new Date(2026, 7, 6, 12, 34)), "202608061234");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "millrect-bundle-"));
  const indexFile = path.join(dir, "index.html");
  try {
    fs.writeFileSync(
      indexFile,
      '<link rel="stylesheet" href="css/app.css?old-value" />\n' +
        '<script src="js/app.bundle.js?old-value"></script>\n',
    );
    updateBundleVersion(indexFile, "202608061234");
    const html = fs.readFileSync(indexFile, "utf8");
    assert.match(html, /href="css\/app\.css\?202608061234"/);
    assert.match(html, /src="js\/app\.bundle\.js\?202608061234"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
