"use strict";

const { execSync } = require("child_process");
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
execSync(
  `swiftc -O -o "${out}" "${src}" -framework CoreText -framework CoreGraphics -framework Foundation`,
  { stdio: "inherit" },
);
console.log("[build:native] built", out);

export {};
