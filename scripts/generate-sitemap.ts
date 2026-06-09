"use strict";

const fs = require("fs");
const path = require("path");

const SITE = "https://millrect.com";
const LASTMOD = new Date().toISOString().slice(0, 10);

const URLS: { loc: string; changefreq: string; priority: string }[] = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/en/", changefreq: "weekly", priority: "0.9" },
  { loc: "/app/", changefreq: "weekly", priority: "0.9" },
  { loc: "/docs/", changefreq: "weekly", priority: "0.8" },
  { loc: "/docs/getting-started.html", changefreq: "monthly", priority: "0.7" },
  {
    loc: "/docs/desktop-download.html",
    changefreq: "monthly",
    priority: "0.8",
  },
  { loc: "/docs/interface.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/drawing.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/editing.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/multiview-3d.html", changefreq: "monthly", priority: "0.7" },
  { loc: "/docs/export.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/shortcuts.html", changefreq: "monthly", priority: "0.5" },
  { loc: "/docs/ai-mcp.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/en/", changefreq: "weekly", priority: "0.8" },
  {
    loc: "/docs/en/getting-started.html",
    changefreq: "monthly",
    priority: "0.7",
  },
  {
    loc: "/docs/en/desktop-download.html",
    changefreq: "monthly",
    priority: "0.8",
  },
  { loc: "/docs/en/interface.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/en/drawing.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/en/editing.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/en/multiview-3d.html", changefreq: "monthly", priority: "0.7" },
  { loc: "/docs/en/export.html", changefreq: "monthly", priority: "0.6" },
  { loc: "/docs/en/shortcuts.html", changefreq: "monthly", priority: "0.5" },
  { loc: "/docs/en/ai-mcp.html", changefreq: "monthly", priority: "0.6" },
];

const body = URLS.map(
  (entry) => `  <url>
    <loc>${SITE}${entry.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

const out = path.join(__dirname, "..", "site", "sitemap.xml");
fs.writeFileSync(out, xml, "utf8");
console.log("[seo:sitemap] wrote", out, `(${URLS.length} URLs)`);

export {};
