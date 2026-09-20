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
import { bodyLimit } from "hono/body-limit";
import { registerResourcesAndPrompts } from "./mcp-content.js";
import { registerAllTools } from "./tools/registry.js";
import { SessionRelay } from "./session-do.js";

export { SessionRelay };

type Env = CloudflareBindings;

const app = new Hono<{ Bindings: Env }>();

const MAX_USAGE_BODY_BYTES = 1024;
const MAX_PROJECT_COUNT = 1_000_000;
const MAX_COUNTER_DELTA = 10_000;
const MAX_ACTIVE_SECONDS_DELTA = 86_400;
const RAW_IP_RETENTION_DAYS = 30;
const USAGE_ACTIONS = new Set([
  "edit",
  "export:json",
  "export:svg",
  "export:dxf",
  "export:pdf",
  "export:stl",
  "export:3mf",
]);

function isProjectCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_PROJECT_COUNT
  );
}

function isCounterDelta(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

function readCounterDelta(
  body: object,
  key: string,
  maximum: number,
  fallback = 0,
): number | null {
  const value = Reflect.get(body, key);
  if (value === undefined) return fallback;
  return isCounterDelta(value, maximum) ? value : null;
}

async function deleteExpiredUsage(env: Env): Promise<void> {
  await env.USAGE_DB.prepare(
    `DELETE FROM usage_daily
     WHERE last_seen_at < datetime('now', ?)`,
  )
    .bind(`-${RAW_IP_RETENTION_DAYS} days`)
    .run();
}

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

// ── Anonymous app usage ─────────────────────────────────────────────────────
// The browser sends aggregate engagement counters and its number of locally
// saved projects. User-Agent and the connecting IP are taken from trusted edge
// headers. Project contents, names, and individual interaction events are never
// sent. Repeat visits update the single row for that IP.
app.post(
  "/api/usage",
  bodyLimit({
    maxSize: MAX_USAGE_BODY_BYTES,
    onError: (c) => c.json({ ok: false, error: "Request body too large" }, 413),
  }),
  async (c) => {
    const requestUrl = new URL(c.req.url);
    if (c.req.header("origin") !== requestUrl.origin) {
      return c.json({ ok: false, error: "Invalid origin" }, 403);
    }
    if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
      return c.json({ ok: false, error: "Expected application/json" }, 415);
    }

    let body: unknown;
    try {
      body = await c.req.json<unknown>();
    } catch {
      return c.json({ ok: false, error: "Invalid JSON" }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ ok: false, error: "Invalid request body" }, 400);
    }

    const rawProjectCount = Reflect.get(body, "projectCount");
    if (!isProjectCount(rawProjectCount)) {
      return c.json({ ok: false, error: "Invalid projectCount" }, 400);
    }

    // visitDelta defaults to 1 so already-cached clients using the previous
    // payload continue to record one app launch. Current clients send 0 for
    // batched activity updates after their initial report.
    const visitDelta = readCounterDelta(body, "visitDelta", 1, 1);
    const meaningfulActionDelta = readCounterDelta(
      body,
      "meaningfulActionDelta",
      MAX_COUNTER_DELTA,
    );
    const exportDelta = readCounterDelta(
      body,
      "exportDelta",
      MAX_COUNTER_DELTA,
    );
    const activeSecondsDelta = readCounterDelta(
      body,
      "activeSecondsDelta",
      MAX_ACTIVE_SECONDS_DELTA,
    );
    const rawLastAction = Reflect.get(body, "lastAction");
    const lastAction = rawLastAction == null ? null : rawLastAction;
    if (
      visitDelta === null ||
      meaningfulActionDelta === null ||
      exportDelta === null ||
      activeSecondsDelta === null ||
      (typeof lastAction !== "string" && lastAction !== null) ||
      (typeof lastAction === "string" && !USAGE_ACTIONS.has(lastAction))
    ) {
      return c.json({ ok: false, error: "Invalid usage counters" }, 400);
    }

    const ipAddress = (c.req.header("cf-connecting-ip") || "unknown").slice(0, 64);
    const userAgent = (c.req.header("user-agent") || "unknown").slice(0, 512);
    const now = new Date().toISOString();
    const activeDate = now.slice(0, 10);
    const projectCount = rawProjectCount;
    const hasActivity =
      meaningfulActionDelta > 0 || exportDelta > 0 || activeSecondsDelta > 0;

    try {
      await c.env.USAGE_DB.prepare(
        `INSERT INTO usage_daily (
           ip_address, user_agent, project_count,
           visit_count, first_seen_at, last_seen_at,
           meaningful_action_count, export_count, active_seconds,
           active_days, last_active_date, last_action, last_action_at
         ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (ip_address) DO UPDATE SET
           user_agent = excluded.user_agent,
           project_count = excluded.project_count,
           visit_count = usage_daily.visit_count + ?,
           last_seen_at = excluded.last_seen_at,
           meaningful_action_count = usage_daily.meaningful_action_count + excluded.meaningful_action_count,
           export_count = usage_daily.export_count + excluded.export_count,
           active_seconds = usage_daily.active_seconds + excluded.active_seconds,
           active_days = usage_daily.active_days + CASE
             WHEN excluded.last_active_date IS NOT NULL
              AND (usage_daily.last_active_date IS NULL
                OR usage_daily.last_active_date <> excluded.last_active_date)
             THEN 1 ELSE 0 END,
           last_active_date = COALESCE(excluded.last_active_date, usage_daily.last_active_date),
           last_action = COALESCE(excluded.last_action, usage_daily.last_action),
           last_action_at = CASE
             WHEN excluded.last_action IS NOT NULL THEN excluded.last_action_at
             ELSE usage_daily.last_action_at END`,
      )
        .bind(
          ipAddress,
          userAgent,
          projectCount,
          now,
          now,
          meaningfulActionDelta,
          exportDelta,
          activeSecondsDelta,
          hasActivity ? 1 : 0,
          hasActivity ? activeDate : null,
          lastAction,
          lastAction ? now : null,
          visitDelta,
        )
        .run();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "usage_write_failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return c.json({ ok: false, error: "Could not record usage" }, 500);
    }

    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  },
);

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

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (_controller, env, ctx) => {
    ctx.waitUntil(
      deleteExpiredUsage(env).catch((error) => {
        console.error(
          JSON.stringify({
            event: "usage_retention_failed",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }),
    );
  },
} satisfies ExportedHandler<Env>;
