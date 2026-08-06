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
  assert.equal(formatBuildDate(new Date(2026, 7, 6)), "20260806");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "millrect-bundle-"));
  const indexFile = path.join(dir, "index.html");
  try {
    fs.writeFileSync(
      indexFile,
      '<script src="js/app.bundle.js?old-value"></script>\n',
    );
    updateBundleVersion(indexFile, "20260806");
    assert.match(
      fs.readFileSync(indexFile, "utf8"),
      /src="js\/app\.bundle\.js\?20260806"/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
