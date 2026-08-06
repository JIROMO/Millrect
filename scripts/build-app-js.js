"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("esbuild");
const scriptOrder = require("./app-script-order");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const DEFAULT_OUTFILE = path.join(APP_DIR, "js", "app.bundle.js");

function buildAppBundle(outfile = DEFAULT_OUTFILE) {
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
  return {
    outfile,
    sourceCount: scriptOrder.length,
    bytes: Buffer.byteLength(result.code),
  };
}

module.exports = { buildAppBundle };

if (require.main === module) {
  const result = buildAppBundle();
  console.log(
    `[build:app-js] bundled ${result.sourceCount} scripts -> ${path.relative(ROOT, result.outfile)} (${result.bytes} bytes)`,
  );
}
