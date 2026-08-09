// Hono entry point for the millrect.com Worker — this is THE worker for the whole site.
// There is no separate "MCP worker"; Hono owns routing for everything (static site sections
// AND the MCP endpoint), and `assets.run_worker_first: true` (see root wrangler.jsonc) makes
// every request hit this script first instead of Cloudflare's default assets-first routing.
//
// Routes:
//   GET  /mcp/ws   — WebSocket upgrade from a Millrect browser tab (session id via ?session=).
//                    Forwarded verbatim to the SessionRelay DO's own fetch(), which does the
//                    WS accept.
//   ALL  /mcp      — MCP Streamable HTTP endpoint for a remote MCP client (e.g. Claude Desktop),
//                    session id via ?session=. A fresh McpServer + WebStandardStreamableHTTPServer
//                    Transport are built per request (stateless — no sessionIdGenerator); tools
//                    are registered against a callBrowser() that RPCs directly to the
//                    SessionRelay DO stub for that session.
//   everything else — static site assets (/, /app/*, /docs/*, /site/*, /packages/*,
//                    robots.txt, sitemap.xml, favicon.ico, …), served via the ASSETS binding.
//
// The `session` query param is the capability-URL pairing secret (see the plan doc); it is
// unrelated to the MCP protocol's own `Mcp-Session-Id` header, which the transport manages
// internally in its stateless per-request mode.

import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { Hono, type Context } from "hono";
import { registerResourcesAndPrompts } from "./mcp-content.js";
import { registerAllTools } from "./tools/registry.js";
import { SessionRelay } from "./session-do.js";

export { SessionRelay };

type Env = CloudflareBindings;

const app = new Hono<{ Bindings: Env }>();

// Cloudflare Bot Management's JavaScript Detection rewrites HTML responses by
// injecting an inline bootstrap script. The app intentionally uses a strict CSP,
// so that injected script would be blocked and reported in the browser console.
// `no-transform` keeps the response intact without weakening the CSP.
async function serveStatic(c: Context<{ Bindings: Env }>) {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html")) return response;

  const headers = new Headers(response.headers);
  // WebMCP requires a stable, origin-isolated document. Opt into an
  // origin-keyed agent cluster explicitly instead of relying on browser
  // defaults that may vary during the origin-trial period.
  headers.set("Origin-Agent-Cluster", "?1");
  const cacheControl = headers.get("cache-control");
  if (!cacheControl) {
    headers.set("cache-control", "no-transform");
  } else if (!/(?:^|,)\s*no-transform\s*(?:,|$)/i.test(cacheControl)) {
    headers.set("cache-control", `${cacheControl}, no-transform`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── MCP: WebSocket relay (browser tab side) ──────────────────────────────────
app.get("/mcp/ws", async (c) => {
  const sessionId = c.req.query("session");
  if (!sessionId) {
    return c.text("Missing ?session=<id> query parameter", 400);
  }
  const stub = c.env.SESSION_DO.getByName(sessionId);
  return stub.fetch(c.req.raw);
});

// ── MCP: Streamable HTTP endpoint (remote MCP client side) ───────────────────
// The official MCP Hono adapter parses JSON without consuming the original Request.
// Host/origin validation is intentionally left to the public Cloudflare hostname and
// the capability URL; unlike a localhost server, this app also serves arbitrary
// workers.dev preview hostnames.
const mcpApp = createMcpHonoApp({ host: "millrect.com" });

mcpApp.all("/", async (c) => {
  const sessionId = c.req.query("session");
  if (!sessionId) {
    return c.text("Missing ?session=<id> query parameter", 400);
  }
  const env = c.env as Env;
  const stub = env.SESSION_DO.getByName(sessionId);
  const requestUrl = c.req.url;

  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: "millrect", version: "1.0.0" });
    registerAllTools(server, (action, params) => stub.callBrowser(action, params));
    registerResourcesAndPrompts(server, async (path) => {
      const assetUrl = new URL(path, requestUrl);
      const response = await env.ASSETS.fetch(new Request(assetUrl));
      if (!response.ok) {
        throw new Error(`Published MCP resource not found: ${path}`);
      }
      return response.text();
    });
    return server;
  }, {
    legacy: "stateless",
    responseMode: "auto",
    onerror: (error) => console.error(JSON.stringify({ event: "mcp_error", message: error.message })),
  });

  return handler.fetch(c.req.raw, { parsedBody: c.get("parsedBody" as never) });
});

app.route("/mcp", mcpApp);

app.get("/health", (c) => c.json({ ok: true, service: "millrect" }));

// ── Static site sections — explicit routes, all forwarded to the ASSETS binding ──
// Listed explicitly (rather than a single bare "*") so the site's URL structure is visible
// here as the one place that owns routing: "/" is the landing page, "/app" is the drawing
// app, "/docs" is the user guide.
app.all("/app/*", serveStatic);

const STATIC_SECTIONS = ["/", "/docs/*", "/site/*", "/packages/*"];
for (const pattern of STATIC_SECTIONS) {
  app.all(pattern, (c) => c.env.ASSETS.fetch(c.req.raw));
}
// Anything else not covered above (robots.txt, sitemap.xml, favicon.ico, top-level en/ pages,
// etc.) still falls through to static assets rather than a Hono 404.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
