"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const forbiddenPatterns: { label: string; re: RegExp }[] = [
  {
    label: "第一頂点でのネスト判定",
    re: /pointInRing\s*\(\s*(?:candidate|first)\[0\]/,
  },
  {
    label: "Swift 第一頂点でのネスト判定",
    re: /pointInRing\s*\(\s*first\[0\]/,
  },
];

const requiredSnippets: { file: string; label: string; snippets: string[] }[] =
  [
    {
      file: "packages/text-contour-grouping.js",
      label: "共有 contour grouping",
      snippets: ["ringCenter", "groupRingsIntoPolygons"],
    },
    {
      file: "app/vendor/millrect-text-engine.mjs",
      label: "browser text-engine bundle",
      snippets: ["ringCenter(rings[i])", "groupRingsIntoPolygons"],
    },
    {
      file: "native/macos/outline-text/main.swift",
      label: "Core Text outline binary",
      snippets: ["ringCenter", "normalizeRingByDepth", "parent[i] = best"],
    },
  ];

let failed = false;

function fail(msg: string): void {
  failed = true;
  console.error(`[verify:contours] ${msg}`);
}

for (const rel of [
  "app/js/text-outline.js",
  "electron/text-outline-native.js",
  "packages/text-engine-utils.js",
  "packages/text-contour-grouping.js",
  "native/macos/outline-text/main.swift",
  "app/vendor/millrect-text-engine.mjs",
]) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    fail(`missing file: ${rel}`);
    continue;
  }
  const src = fs.readFileSync(filePath, "utf8");
  for (const { label, re } of forbiddenPatterns) {
    if (re.test(src)) {
      fail(`${rel}: forbidden pattern (${label})`);
    }
  }
}

for (const { file, label, snippets } of requiredSnippets) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    fail(`missing ${label}: ${file}`);
    continue;
  }
  const src = fs.readFileSync(filePath, "utf8");
  for (const snippet of snippets) {
    if (!src.includes(snippet)) {
      fail(`${file}: expected ${snippet} (${label})`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[verify:contours] OK");

export {};
