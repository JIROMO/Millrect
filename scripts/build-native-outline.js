"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

if (process.platform !== "darwin") {
  console.log("[build:native] skip (not macOS)");
  process.exit(0);
}

const root = path.join(__dirname, "..");
const src = path.join(root, "native/macos/outline-text/main.swift");
const outDir = path.join(root, "native/macos/outline-text/bin");
const out = path.join(outDir, "outline-text");

if (!fs.existsSync(src)) {
  console.error("[build:native] missing", src);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const result = spawnSync(
  "swiftc",
  [
    "-O",
    "-o",
    out,
    src,
    "-framework",
    "CoreText",
    "-framework",
    "CoreGraphics",
    "-framework",
    "Foundation",
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error("[build:native] failed to start swiftc:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[build:native] built", out);
