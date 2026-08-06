"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("esbuild");
const scriptOrder = require("./app-script-order");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const DEFAULT_OUTFILE = path.join(APP_DIR, "js", "app.bundle.js");

function formatBuildDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function updateBundleVersion(indexFile, buildDate) {
  const html = fs.readFileSync(indexFile, "utf8");
  const bundlePattern = /js\/app\.bundle\.js(?:\?[^"']*)?/g;
  if (!bundlePattern.test(html)) {
    throw new Error(`[build:app-js] bundle script not found in ${indexFile}`);
  }
  bundlePattern.lastIndex = 0;
  const next = html.replace(
    bundlePattern,
    `js/app.bundle.js?${buildDate}`,
  );
  if (next !== html) fs.writeFileSync(indexFile, next);
}

function buildAppBundle(outfile = DEFAULT_OUTFILE, options = {}) {
  const source = scriptOrder
    .map((relativePath) => {
      const filename = path.resolve(APP_DIR, relativePath);
      return `/* ${relativePath} */\n${fs.readFileSync(filename, "utf8")}`;
    })
    .join("\n;\n");
  const result = transformSync(source, {
    loader: "js",
    minify: true,
    target: "es2022",
    legalComments: "inline",
  });

  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, result.code);
  const buildDate = formatBuildDate(options.date);
  const indexFile =
    options.indexFile ||
    path.join(path.dirname(path.dirname(outfile)), "index.html");
  updateBundleVersion(indexFile, buildDate);
  return {
    outfile,
    sourceCount: scriptOrder.length,
    bytes: Buffer.byteLength(result.code),
    buildDate,
  };
}

module.exports = { buildAppBundle, formatBuildDate, updateBundleVersion };

if (require.main === module) {
  const result = buildAppBundle();
  console.log(
    `[build:app-js] bundled ${result.sourceCount} scripts -> ${path.relative(ROOT, result.outfile)}?${result.buildDate} (${result.bytes} bytes)`,
  );
}
