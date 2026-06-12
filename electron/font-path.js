"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  BUILTIN_FONT_GEN,
  normalizeTextFontFamily,
} = require("../packages/builtin-fonts");

function findBundledFontFile(family, style = "Regular") {
  const root = path.join(__dirname, "..");
  const name = normalizeTextFontFamily(family);
  const bold = /bold/i.test(style);
  const table = {
    [BUILTIN_FONT_GEN]: bold
      ? "GenInterfaceJP-Bold.ttf"
      : "GenInterfaceJP-Regular.ttf",
  };
  const file = table[name];
  if (!file) return null;
  const full = path.join(root, "app", "fonts", file);
  return fs.existsSync(full) ? full : null;
}

function getFontSearchDirs(platform = process.platform) {
  if (platform === "darwin") {
    return [
      "/System/Library/Fonts/Supplemental",
      "/System/Library/Fonts",
      "/Library/Fonts",
      path.join(os.homedir(), "Library/Fonts"),
    ];
  }
  if (platform === "win32") {
    return [
      "C:\\Windows\\Fonts",
      path.join(os.homedir(), "AppData\\Local\\Microsoft\\Windows\\Fonts"),
    ];
  }
  return [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    path.join(os.homedir(), ".fonts"),
  ];
}

function findFontFile(family, style = "Regular", opts = {}) {
  const bundled = findBundledFontFile(family, style);
  if (bundled) return bundled;

  const includeTtc = opts.includeTtc !== false;
  const exts = includeTtc
    ? [".ttf", ".otf", ".ttc", ".TTF", ".OTF", ".TTC"]
    : [".ttf", ".otf", ".TTF", ".OTF"];
  const needle = family.toLowerCase().replace(/[\s-_]/g, "");
  const wantsUnicode =
    /arialunicode|arialunicodems/.test(needle) ||
    family.includes("Arial Unicode");
  const isRegular = /^(regular|normal|book|roman|)$/i.test(style);
  const styleNeedle = style.toLowerCase().replace(/[\s-_]/g, "");
  const candidates = [];

  function collectDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        collectDir(path.join(dir, entry.name));
        continue;
      }
      if (!exts.some((e) => entry.name.endsWith(e))) continue;
      const base = entry.name
        .toLowerCase()
        .replace(/[\s-_]/g, "")
        .replace(/\.(ttf|otf|ttc)$/, "");
      const matchesFamily =
        base.startsWith(needle) ||
        base.includes(needle) ||
        (wantsUnicode && /arialunicode/.test(base));
      if (!matchesFamily) continue;
      const full = path.join(dir, entry.name);
      const hasStyle = base.includes(styleNeedle);
      const hasRegular = /regular|normal/.test(base);
      let score = hasStyle ? 3 : isRegular && hasRegular ? 2 : 1;
      if (wantsUnicode && /arialunicode/.test(base)) score += 5;
      if (/arialunicode/.test(base)) score += 2;
      if (entry.name.toLowerCase().endsWith(".ttc")) score += 1;
      candidates.push({ full, score });
    }
  }

  for (const dir of getFontSearchDirs()) collectDir(dir);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].full;
}

function readFontFile(filePath) {
  return fs.readFileSync(filePath);
}

module.exports = {
  getFontSearchDirs,
  findFontFile,
  findBundledFontFile,
  readFontFile,
};
