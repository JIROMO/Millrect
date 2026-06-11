"use strict";

// アプリバンドル（ADR 0002）。2 エントリを IIFE に束ねる:
//   - bundle-entry.ts  → millrect-packages.bundle.js（head・packages/ 全モジュール）
//   - app-entry.ts     → millrect-app.bundle.js（body・app/js を段階的に取り込み）
// 出力は gitignore 対象の build artifact。vendor ライブラリ（three /
// polygon-clipping 等）は <script> グローバルのまま。

const { build } = require("esbuild");
const path = require("path");

const root = path.join(__dirname, "..");

const targets: { entry: string; outfile: string }[] = [
  {
    entry: path.join(root, "app", "src", "bundle-entry.ts"),
    outfile: path.join(root, "app", "vendor", "millrect-packages.bundle.js"),
  },
  {
    entry: path.join(root, "app", "src", "app-entry.ts"),
    outfile: path.join(root, "app", "vendor", "millrect-app.bundle.js"),
  },
];

Promise.all(
  targets.map(({ entry, outfile }) =>
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
    }),
  ),
).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

export {};
