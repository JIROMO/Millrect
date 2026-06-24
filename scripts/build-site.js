"use strict";

// Assembles the static site into a single output folder (manifest.outDir).
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

function assertSafeDestination(outDirAbs, to) {
  if (!to || to === "." || path.isAbsolute(to)) {
    throw new Error(`[build-site] unsafe destination: ${to}`);
  }
  const dest = path.resolve(outDirAbs, to);
  const rel = path.relative(outDirAbs, dest);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`[build-site] destination escapes output directory: ${to}`);
  }
  return dest;
}

// Assemble the deploy set into outDirAbs (defaults to <repo>/<manifest.outDir>).
function buildSite(outDirAbs) {
  const OUT = path.resolve(outDirAbs || path.join(ROOT, manifest.outDir));
  fs.mkdirSync(OUT, { recursive: true });

  for (const entry of manifest.entries) {
    const { to } = resolveEntry(entry);
    fs.rmSync(assertSafeDestination(OUT, to), { recursive: true, force: true });
  }

  let copied = 0;
  for (const entry of manifest.entries) {
    const { from, to } = resolveEntry(entry);
    const src = path.join(ROOT, from);
    if (!fs.existsSync(src)) {
      console.warn(`[build-site] skip missing entry: ${from}`);
      continue;
    }
    const dest = assertSafeDestination(OUT, to);
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
