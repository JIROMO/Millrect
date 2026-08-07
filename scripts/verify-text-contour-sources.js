"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const forbiddenPatterns = [
  {
    label: "第一頂点でのネスト判定",
    re: /pointInRing\s*\(\s*(?:candidate|first)\[0\]/,
  },
  {
    label: "Swift 第一頂点でのネスト判定",
    re: /pointInRing\s*\(\s*first\[0\]/,
  },
  {
    // 中心点 1 点でのネスト判定は交差 stroke を counter と誤認する（「切」の重なり抜け）
    label: "リング中心点でのネスト判定",
    re: /pointInRing\s*\(\s*cx\s*,\s*cy\s*,\s*rings\[j\]/,
  },
];

const requiredSnippets = [
  {
    file: "packages/text-contour-grouping.js",
    label: "共有 contour grouping",
    snippets: ["ringContainmentFraction", "groupRingsIntoPolygons"],
  },
  {
    file: "app/vendor/millrect-text-engine.mjs",
    label: "browser text-engine bundle",
    snippets: ["ringContainmentFraction", "groupRingsIntoPolygons"],
  },
];

let failed = false;

function fail(msg) {
  failed = true;
  console.error(`[verify:contours] ${msg}`);
}

for (const rel of [
  "app/js/text-outline.js",
  "packages/text-engine-utils.js",
  "packages/text-contour-grouping.js",
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
