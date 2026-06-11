"use strict";

// アプリバンドル（ADR 0002）。app/src/bundle-entry.ts を IIFE に束ね、
// app/vendor/millrect-packages.bundle.js へ出力する（gitignore 対象の build artifact）。
// vendor ライブラリ（three / polygon-clipping 等）は <script> グローバルのまま。

const { build } = require("esbuild");
const path = require("path");

const root = path.join(__dirname, "..");
const entry = path.join(root, "app", "src", "bundle-entry.ts");
const outfile = path.join(root, "app", "vendor", "millrect-packages.bundle.js");

build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  logLevel: "info",
}).then(() => {
  console.log("[build:app] wrote", path.relative(root, outfile));
});

export {};
