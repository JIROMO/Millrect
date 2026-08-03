"use strict";

// Single source of truth for the static assets published by the Hono Worker.
// Consumed by:
//   - scripts/build-site.js            (assembles everything into outDir/)
//   - tests/unit/deploy-assets.test.js (guards against deploy drift)
//
// `npm run build:site` assembles outDir/ inside this repository. Wrangler uses
// that directory as its static-assets binding; no adjacent repository is used.
//
// Each entry is copied into outDir preserving the deployed structure so the
// relative <script src> / <link href> paths inside the HTML keep resolving
// (app/ ↔ packages/ ↔ site/ stay siblings on the host).
//
// An entry is either:
//   - "name"                    → copy <repo>/name to outDir/name
//   - { from, to }              → copy <repo>/from to outDir/to (path remap)
// The landing pages live under site/ but are published at their canonical URLs
// (/ and /en/), so they use the remap form.

module.exports = {
  // Hono Worker static assets, regenerated locally before dev/build/deploy.
  outDir: "dist/site",

  entries: [
    // SEO / root files
    { from: "site/robots.txt", to: "robots.txt" }, // /robots.txt
    { from: "site/sitemap.xml", to: "sitemap.xml" }, // /sitemap.xml
    { from: "site/favicon.ico", to: "favicon.ico" }, // /favicon.ico
    "AGENT.md",
    "AGENT.ja.md",

    // Web app + its first-party libraries
    "app",
    "packages",
    // Documentation site
    "docs",

    // Marketing site assets (kept at /site/*)
    { from: "site/css", to: "site/css" },
    { from: "site/js", to: "site/js" },
    { from: "site/images", to: "site/images" },
    { from: "site/fonts", to: "site/fonts" },

    // Landing pages → canonical URLs
    { from: "site/index.html", to: "index.html" }, // /
    { from: "site/en/index.html", to: "en/index.html" }, // /en/
  ],
};
