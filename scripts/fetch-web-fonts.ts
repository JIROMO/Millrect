"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const GEN_VERSION = "0.5.0";
const GEN_ZIP_URL = `https://github.com/yamatoiizuka/gen-interface-jp/releases/download/v${GEN_VERSION}/GenInterfaceJP-${GEN_VERSION}.zip`;
const GEN_ZIP_PREFIX = `GenInterfaceJP-${GEN_VERSION}/Gen Interface JP/`;

const TTF_ASSETS: { zipEntry: string; dest: string }[] = [
  {
    zipEntry: `${GEN_ZIP_PREFIX}GenInterfaceJP-Regular.ttf`,
    dest: path.join(root, "app", "fonts", "GenInterfaceJP-Regular.ttf"),
  },
  {
    zipEntry: `${GEN_ZIP_PREFIX}GenInterfaceJP-Bold.ttf`,
    dest: path.join(root, "app", "fonts", "GenInterfaceJP-Bold.ttf"),
  },
];

const WOFF2_ASSETS: { name: string; url: string; dirs: string[] }[] = [
  {
    name: "GenInterfaceJP-Regular.woff2",
    url: `https://cdn.jsdelivr.net/npm/gen-interface-jp@${GEN_VERSION}/w/normal/400/000.woff2`,
    dirs: [path.join(root, "docs", "fonts"), path.join(root, "site", "fonts")],
  },
  {
    name: "GenInterfaceJP-Bold.woff2",
    url: `https://cdn.jsdelivr.net/npm/gen-interface-jp@${GEN_VERSION}/w/normal/700/000.woff2`,
    dirs: [path.join(root, "docs", "fonts"), path.join(root, "site", "fonts")],
  },
];

function download(url: string, dest: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res: any) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

const LEGACY_FONT_FILES = [
  "Inter-Regular.otf",
  "Inter-Bold.otf",
  "NotoSansJP-Regular.otf",
  "NotoSansJP-Bold.otf",
];

async function removeLegacyFonts(): Promise<void> {
  const fontsDir = path.join(root, "app", "fonts");
  for (const name of LEGACY_FONT_FILES) {
    const file = path.join(fontsDir, name);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log("[fonts] removed legacy", name);
    }
  }
}

async function fetchTtfFromRelease(): Promise<void> {
  const fontsDir = path.join(root, "app", "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  await removeLegacyFonts();

  const missing = TTF_ASSETS.filter(
    (asset) =>
      !fs.existsSync(asset.dest) || fs.statSync(asset.dest).size < 1000,
  );
  if (missing.length === 0) {
    for (const asset of TTF_ASSETS)
      console.log("[fonts] skip", path.basename(asset.dest));
    return;
  }

  const zipPath = path.join(os.tmpdir(), `GenInterfaceJP-${GEN_VERSION}.zip`);
  console.log("[fonts] fetch zip ←", GEN_ZIP_URL);
  await download(GEN_ZIP_URL, zipPath);

  for (const asset of missing) {
    console.log("[fonts] extract", path.basename(asset.dest));
    const bytes = execFileSync("unzip", ["-p", zipPath, asset.zipEntry], {
      maxBuffer: 64 * 1024 * 1024,
    });
    fs.writeFileSync(asset.dest, bytes);
  }

  fs.unlinkSync(zipPath);
}

async function fetchWoff2Assets(): Promise<void> {
  for (const asset of WOFF2_ASSETS) {
    for (const dir of asset.dirs) {
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, asset.name);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        console.log("[fonts] skip", path.relative(root, dest));
        continue;
      }
      console.log("[fonts] fetch", path.relative(root, dest), "←", asset.url);
      await download(asset.url, dest);
    }
  }
}

async function main(): Promise<void> {
  await fetchTtfFromRelease();
  await fetchWoff2Assets();
}

main().catch((err: any) => {
  console.error("[fonts]", err.message);
  process.exitCode = 1;
});

export {};
