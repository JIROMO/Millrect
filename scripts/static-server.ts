"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const port = Number(process.env.MILLRECT_STATIC_PORT || 4173);
const host = process.env.MILLRECT_STATIC_HOST || "127.0.0.1";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res: any, status: number, body: any, type?: string): void {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function resolveRequestPath(urlPath: string): string {
  // Landing pages + SEO files live under site/ but are published at the root.
  if (urlPath === "/" || urlPath === "") return "/site/index.html";
  if (urlPath === "/en" || urlPath === "/en/") return "/site/en/index.html";
  if (urlPath === "/robots.txt") return "/site/robots.txt";
  if (urlPath === "/sitemap.xml") return "/site/sitemap.xml";
  if (urlPath === "/favicon.ico") return "/site/favicon.ico";
  if (urlPath === "/app" || urlPath === "/app/") return "/app/index.html";
  return urlPath;
}

const server = http.createServer((req: any, res: any) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = resolveRequestPath(urlPath);
  const filePath = path.normalize(path.join(root, rel.replace(/^\//, "")));
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (err: any, data: any) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}/`;
  console.log(`[static-server] ${url}`);
  if (process.send) process.send({ url });
});

export {};
