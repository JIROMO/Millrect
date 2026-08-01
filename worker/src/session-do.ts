// SessionRelay — Durable Object that relays JSON-RPC-ish calls between a remote MCP client
// (via the Worker/Hono routes in index.ts) and a single browser tab running Millrect
// (connected over WebSocket, using the Hibernation API so idle sessions don't burn compute).
//
// One SessionRelay instance == one pairing session == one browser tab. Routing to the right
// instance happens in index.ts via env.SESSION_DO.idFromName(sessionId).
//
// Design notes (see shimmering-plotting-kurzweil.md):
// - `pending` is a Map<id, {resolve, reject, timer}> for in-flight browser calls.
// - `callBrowser(action, params)` is called directly on the DO stub by the Hono /mcp route
//   (RPC method, not a raw fetch), and resolves once the browser replies over the WS.
// - `isConnected()` reports whether a browser WS is currently attached.
// - MCP protocol-level session state (Mcp-Session-Id) is NOT stored here — this DO only relays
//   WS messages; it is intentionally stateless with respect to the MCP protocol itself.

import { DurableObject } from "cloudflare:workers";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface RelayMessage {
  id: string;
  action?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

const CALL_TIMEOUT_MS = 15_000;

export class SessionRelay extends DurableObject {
  private pending: Map<string, PendingCall> = new Map();

  /** The single active browser WebSocket for this session, if any. */
  private get browserSocket(): WebSocket | undefined {
    // Hibernatable WebSockets survive DO eviction; ctx.getWebSockets() returns any that are
    // still attached after a restart, so we don't need to persist the socket reference itself.
    return this.ctx.getWebSockets()[0];
  }

  isConnected(): boolean {
    return this.browserSocket !== undefined;
  }

  /**
   * fetch() handles two kinds of requests routed here by index.ts:
   *   - GET /mcp/ws (?session=id) → WebSocket upgrade from the browser tab
   * Anything else is a 404 (the Hono /mcp route calls callBrowser() directly via RPC instead
   * of going through fetch()).
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket Upgrade request", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Only one browser tab per session. If one is already attached, close it — the newest
    // connection wins (e.g. a page reload).
    for (const existing of this.ctx.getWebSockets()) {
      try {
        existing.close(1000, "replaced by new connection");
      } catch {
        // ignore
      }
    }

    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Called directly (RPC) by the Hono /mcp route running in the same Worker invocation.
   * Sends {id, action, params} to the browser over WS and resolves when the matching
   * {id, result|error} reply arrives via webSocketMessage().
   */
  async callBrowser(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const ws = this.browserSocket;
    if (!ws) {
      throw new Error(
        "ブラウザタブが接続されていません（Millrect のエージェントパネルで接続してください）",
      );
    }

    const id = crypto.randomUUID();
    const message: RelayMessage = { id, action, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`タイムアウト: ${action}`));
      }, CALL_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let parsed: RelayMessage;
    try {
      parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    const entry = this.pending.get(parsed.id);
    if (!entry) return;

    this.pending.delete(parsed.id);
    clearTimeout(entry.timer);

    if (parsed.error) {
      entry.reject(new Error(parsed.error));
    } else {
      entry.resolve(parsed.result);
    }
  }

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Reject any in-flight calls — the browser is gone, they will never resolve.
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("ブラウザ接続が切断されました"));
      this.pending.delete(id);
    }
  }

  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error instanceof Error ? error : new Error(String(error)));
      this.pending.delete(id);
    }
  }
}
