"use strict";

const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vendorDir = path.join(root, "app", "vendor");
const entry = path.join(root, "text-engine-src/millrect-text-engine-browser.js");
const outJs = path.join(vendorDir, "millrect-text-engine.js");
const wasmSrc = path.join(root, "node_modules/harfbuzzjs/dist/harfbuzz.wasm");
const wasmDst = path.join(vendorDir, "harfbuzz.wasm");

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(wasmSrc, wasmDst);

build({
  entryPoints: [entry],
  outfile: outJs.replace(/\.js$/, ".mjs"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  logLevel: "info",
  alias: {
    module: path.join(root, "text-engine-src/stubs/empty-module.js"),
  },
}).then(() => {
  console.log("[build:text-engine] wrote", outJs.replace(/\.js$/, ".mjs"));
  console.log("[build:text-engine] copied", wasmDst);
  require("./verify-text-contour-sources.js");
});
