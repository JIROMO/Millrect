"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = path.join(root, "native", "wasm", "stl_binary.rs");
const out = path.join(root, "app", "vendor", "stl-binary.wasm");

fs.mkdirSync(path.dirname(out), { recursive: true });

function keepExistingOrFail(reason) {
  if (fs.existsSync(out)) {
    console.warn(
      `[build:stl-wasm] ${reason}; keeping existing ${path.relative(root, out)}`,
    );
    process.exit(0);
  }
  console.error(`[build:stl-wasm] ${reason}; no existing wasm artifact found`);
  process.exit(1);
}

const result = spawnSync(
  "rustc",
  [
    "--target",
    "wasm32-unknown-unknown",
    "-O",
    "--crate-type=cdylib",
    "-C",
    "panic=abort",
    source,
    "-o",
    out,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  keepExistingOrFail(`failed to start rustc: ${result.error.message}`);
}

if (result.status !== 0) {
  keepExistingOrFail(`rustc exited with status ${result.status ?? 1}`);
}

fs.chmodSync(out, 0o644);
console.log("[build:stl-wasm] wrote", out);
