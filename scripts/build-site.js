"use strict";

// Assembles the static site into a single output folder (manifest.outDir) so
// "what gets uploaded to the rental server" is one inspectable directory.
// Source files stay in place (app/, packages/, etc. are also used by Electron
// and tests); this only copies the deploy set, remapping where needed.

const fs = require("node:fs");
const path = require("node:path");
const manifest = require("./site-manifest");

const ROOT = path.resolve(__dirname, "..");

// Normalize a manifest entry to { from, to }.
function resolveEntry(entry) {
  if (typeof entry === "string") return { from: entry, to: entry };
  return entry;
}

// Assemble the deploy set into outDirAbs (defaults to <repo>/<manifest.outDir>).
function buildSite(outDirAbs) {
  const OUT = outDirAbs || path.join(ROOT, manifest.outDir);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  let copied = 0;
  for (const entry of manifest.entries) {
    const { from, to } = resolveEntry(entry);
    const src = path.join(ROOT, from);
    if (!fs.existsSync(src)) {
      console.warn(`[build-site] skip missing entry: ${from}`);
      continue;
    }
    const dest = path.join(OUT, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    copied += 1;
  }

  return { outDir: OUT, copied };
}

module.exports = { buildSite };

if (require.main === module) {
  const { outDir, copied } = buildSite();
  console.log(
    `[build-site] assembled ${copied} entr${copied === 1 ? "y" : "ies"} -> ${path.relative(ROOT, outDir)}/`,
  );
}
