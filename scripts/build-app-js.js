"use strict";

const fs = require("node:fs");
const path = require("node:path");
const scriptOrder = require("./app-script-order");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const DEFAULT_OUTFILE = path.join(APP_DIR, "js", "app.bundle.js");

function formatBuildDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}`;
}

function updateBundleVersion(indexFile, buildDate) {
  const html = fs.readFileSync(indexFile, "utf8");
  const bundlePattern = /js\/app\.bundle\.js(?:\?[^"']*)?/g;
  if (!bundlePattern.test(html)) {
    throw new Error(`[build:app-js] bundle script not found in ${indexFile}`);
  }
  bundlePattern.lastIndex = 0;
  let next = html.replace(bundlePattern, `js/app.bundle.js?${buildDate}`);

  const cssPattern = /css\/app\.css(?:\?[^"']*)?/g;
  if (!cssPattern.test(next)) {
    throw new Error(`[build:app-js] app.css link not found in ${indexFile}`);
  }
  cssPattern.lastIndex = 0;
  next = next.replace(cssPattern, `css/app.css?${buildDate}`);

  if (next !== html) fs.writeFileSync(indexFile, next);
}

function updateServiceWorkerVersion(swFile, buildDate) {
  if (!fs.existsSync(swFile)) return;
  const src = fs.readFileSync(swFile, "utf8");
  const versionPattern = /const CACHE_VERSION = "[^"]*";/;
  if (!versionPattern.test(src)) {
    throw new Error(`[build:app-js] CACHE_VERSION not found in ${swFile}`);
  }
  const next = src.replace(
    versionPattern,
    `const CACHE_VERSION = "${buildDate}";`,
  );
  if (next !== src) fs.writeFileSync(swFile, next);
}

function buildAppBundle(outfile = DEFAULT_OUTFILE, options = {}) {
  const source = scriptOrder
    .map((relativePath) => {
      const filename = path.resolve(APP_DIR, relativePath);
      return `/* ${relativePath} */\n${fs.readFileSync(filename, "utf8")}`;
    })
    .join("\n;\n");
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  // Keep the builder dependency-free: production intentionally skips the root
  // npm install and only installs worker dependencies. The sources are classic
  // scripts, so ordered concatenation preserves their shared global scope.
  fs.writeFileSync(outfile, source);
  const buildDate = formatBuildDate(options.date);
  const appDir = path.dirname(path.dirname(outfile));
  const indexFile = options.indexFile || path.join(appDir, "index.html");
  updateBundleVersion(indexFile, buildDate);
  const swFile = options.swFile || path.join(appDir, "sw.js");
  updateServiceWorkerVersion(swFile, buildDate);
  return {
    outfile,
    sourceCount: scriptOrder.length,
    bytes: Buffer.byteLength(source),
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
