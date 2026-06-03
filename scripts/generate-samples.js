#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("@playwright/test");
const { SAMPLE_CATALOG } = require("../packages/sample-catalog");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "samples");

function startStaticServer() {
  const serverPath = path.join(__dirname, "static-server.js");
  delete require.cache[require.resolve(serverPath)];
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let rel = urlPath;
      if (rel === "/" || rel === "") rel = "/index.html";
      if (rel === "/app" || rel === "/app/") rel = "/app/index.html";
      const filePath = path.normalize(path.join(ROOT, rel.replace(/^\//, "")));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const type =
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".wasm": "application/wasm",
          }[ext] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": type,
          "Cache-Control": "no-store",
        });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, appUrl: `http://127.0.0.1:${port}/app/index.html` });
    });
    server.on("error", reject);
  });
}

async function waitForServer(url) {
  const target = new URL(url);
  for (let i = 0; i < 40; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(
          {
            hostname: target.hostname,
            port: target.port,
            path: target.pathname,
          },
          (res) => {
            res.resume();
            if (res.statusCode && res.statusCode < 500) resolve();
            else reject(new Error(`HTTP ${res.statusCode}`));
          },
        );
        req.on("error", reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`Static server did not start on ${url}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { server, appUrl } = await startStaticServer();
  await waitForServer(appUrl);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (err) => {
    throw err;
  });

  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    Boolean(
      window.SAMPLE_CATALOG &&
      window.buildSampleProjectState &&
      window.projectJsonFromState,
    ),
  );

  const catalogMeta = [];

  for (const entry of SAMPLE_CATALOG) {
    const payload = await page.evaluate(
      ({ sampleId, defaultNameKey, entry }) => {
        const name = typeof t === "function" ? t(defaultNameKey) : sampleId;
        const defaults = entry.defaultForm || {};
        const state = buildSampleProjectState(sampleId, {
          projectName: name,
          paper: defaults.paper || "A4",
          orientation: defaults.orientation || "landscape",
          scale: defaults.scale || { numerator: 1, denominator: 10 },
        });
        return {
          fileName: `${sampleId}.json`,
          json: projectJsonFromState(state),
        };
      },
      {
        sampleId: entry.id,
        defaultNameKey: entry.defaultProjectNameKey,
        entry,
      },
    );

    const outPath = path.join(OUT_DIR, payload.fileName);
    fs.writeFileSync(outPath, payload.json + "\n", "utf8");
    catalogMeta.push({
      id: entry.id,
      file: payload.fileName,
      type: entry.type,
      tagKey: entry.tagKey,
      nameKey: entry.nameKey,
      descKey: entry.descKey,
    });
    console.log(`[samples] wrote ${outPath}`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "catalog.json"),
    JSON.stringify({ version: 1, samples: catalogMeta }, null, 2) + "\n",
    "utf8",
  );

  await browser.close();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
