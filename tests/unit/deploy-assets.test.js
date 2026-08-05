"use strict";

// Guards against deploy drift: builds the static site (scripts/build-site.js
// from scripts/site-manifest.js) into a temp dir, then asserts every relative
// <script src> / <link href> in every published HTML resolves to a file that
// actually exists inside the built output. This catches the class of bug where
// an HTML file references e.g. ../packages/... but that directory is not part
// of the deploy set, or a landing page is remapped to the wrong URL.

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSite } = require("../../scripts/build-site");

// Walk a directory for .html files.
function htmlFilesIn(dirAbs) {
  const out = [];
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) out.push(...htmlFilesIn(abs));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(abs);
  }
  return out;
}

// Relative local assets referenced by <script src> / <link href>.
function localAssetRefs(html) {
  const refs = [];
  const patterns = [
    /<script\b[^>]*\bsrc="([^"]+)"/g,
    /<link\b[^>]*\bhref="([^"]+)"/g,
  ];
  for (const re of patterns) {
    for (const match of html.matchAll(re)) {
      const src = match[1];
      if (/^(https?:)?\/\//.test(src)) continue; // external / protocol-relative
      if (src.startsWith("data:") || src.startsWith("#")) continue;
      refs.push(src.split("?")[0].split("#")[0]);
    }
  }
  return refs;
}

describe("static deploy assets", () => {
  let outDir;

  before(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "millrect-site-"));
    buildSite(outDir);
  });

  after(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("publishes the landing pages at / and /en/, plus the app and packages", () => {
    assert.ok(fs.existsSync(path.join(outDir, "index.html")), "/ landing page");
    assert.ok(
      fs.existsSync(path.join(outDir, "en/index.html")),
      "/en/ landing page",
    );
    assert.ok(fs.existsSync(path.join(outDir, "app/index.html")), "web app");
    assert.ok(
      fs.existsSync(path.join(outDir, "packages/schema/index.js")),
      "packages must be deployed",
    );
  });

  it("preserves non-generated files in the output repository", () => {
    const marker = path.join(outDir, "README.md");
    fs.writeFileSync(marker, "keep me\n");

    buildSite(outDir);

    assert.equal(fs.readFileSync(marker, "utf8"), "keep me\n");
  });

  it("every local asset in every published HTML resolves within the build", () => {
    const htmlFiles = htmlFilesIn(outDir);
    assert.ok(htmlFiles.length > 0, "should produce published HTML files");

    const problems = [];
    for (const fileAbs of htmlFiles) {
      const relFile = path.relative(outDir, fileAbs);
      const html = fs.readFileSync(fileAbs, "utf8");
      for (const ref of localAssetRefs(html)) {
        // Absolute URL paths resolve from the site root; relative ones from the
        // file's own directory.
        const resolvedAbs = ref.startsWith("/")
          ? path.join(outDir, ref)
          : path.resolve(path.dirname(fileAbs), ref);
        const relResolved = path.relative(outDir, resolvedAbs);
        if (relResolved.startsWith("..")) {
          problems.push(`${relFile} → ${ref} escapes the site root`);
        } else if (!fs.existsSync(resolvedAbs)) {
          problems.push(`${relFile} → ${ref} (missing: ${relResolved})`);
        }
      }
    }
    assert.deepEqual(
      problems,
      [],
      `unresolved deploy assets:\n${problems.join("\n")}`,
    );
  });

  it("prevents Cloudflare from injecting inline JavaScript into HTML", () => {
    const workerSource = fs.readFileSync(
      path.join(__dirname, "../../worker/src/index.ts"),
      "utf8",
    );

    assert.match(workerSource, /contentType\.startsWith\("text\/html"\)/);
    assert.match(workerSource, /headers\.set\("cache-control", "no-transform"\)/);
    assert.match(workerSource, /app\.all\("\/app\/\*", serveStatic\)/);
    assert.doesNotMatch(workerSource, /script-src[^\n]*unsafe-inline/);
  });
});
