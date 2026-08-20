"use strict";

// ── Web版のリモートMCPブリッジ ──────────────────────────────────
// main.js（Electron）の startWebSocketServer() が action ごとに
// webContents.executeJavaScript() で文字列evalしていたのは、Electronの
// main/rendererが別プロセスだから。ブラウザ単体ではその境界が無いので、
// ここでは同じ action 名を素直に関数呼び出しするだけでよい。
//
// 接続先: サイト本体と同じ Cloudflare Worker（worker/、Hono がルーティングを一元管理）内の
// SessionRelay Durable Object。MCP/WSは専用のWorkerに分けず、/mcp・/mcp/ws として
// サイト本体（/, /app, /docs 等）と同じWorkerが処理する。
// セッションIDはこのブラウザが生成する「キャパビリティURL」の一部（?session=クエリ）で、
// エージェント側の設定に貼るMCPエンドポイントURLとペアになる。
(function () {
  const SESSION_STORAGE_PREFIX = "millrect.mcpSessionId.";
  const RECONNECT_BASE_DELAY = 1000;
  const RECONNECT_MAX_DELAY = 15000;

  let ws = null;
  let reconnectTimer = null;
  let reconnectDelay = RECONNECT_BASE_DELAY;
  let manuallyStopped = true;

  function workerOrigin() {
    // サブドメインは使わず、サイト本体と同一の Worker/オリジンに向ける。
    // ローカル検証時のみ wrangler dev（デフォルト8787）に向ける
    // （static-server.js で配信するアプリ自体は4173、Workerは別プロセスの8787）。
    const isLocal =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    return isLocal
      ? { http: "http://localhost:8787", ws: "ws://localhost:8787" }
      : { http: "https://millrect.com", ws: "wss://millrect.com" };
  }

  function sessionStorageKey() {
    const projectId =
      typeof getCurrentProjectId === "function" ? getCurrentProjectId() : "";
    return SESSION_STORAGE_PREFIX + (projectId || "default");
  }

  function getOrCreateSessionId() {
    const key = sessionStorageKey();
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function regenerateSessionId() {
    const key = sessionStorageKey();
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  }

  function pairingUrl() {
    return `${workerOrigin().http}/mcp?session=${getOrCreateSessionId()}`;
  }

  // ── アクションディスパッチ ────────────────────────────────────
  // main.js の action 名と1:1。処理内容も同等（executeJavaScript の
  // 中身をそのまま関数呼び出しに置き換えたもの）。
  const ACTIONS = {
    getState: () => {
      const state = getState();
      const page = getCurrentPage();
      const ID_SCALE = { numerator: 1, denominator: 1 };
      const allShapes = getAllShapesOnPage(page);
      const profiles = extractProfilesFromPage(page);
      return {
        projectName: state.projectName,
        unit: state.unit,
        page: {
          id: page.id,
          name: page.name,
          paper: page.paper,
          orientation: page.orientation,
          scale: page.scale,
          viewDefinition: page.viewDefinition ?? null,
        },
        shapes: allShapes.map((s) => {
          const bb = getShapeBBox(s, ID_SCALE);
          return { id: s.id, type: s.type, bbox: bb, feature: s.feature ?? null };
        }),
        dimensions: (page.dimensions || []).map((d) => ({
          id: d.id,
          dimensionType: d.dimensionType,
          from: d.from,
          to: d.to,
          offset: d.offset,
          from_mm: { x: realToMM(d.from.x), y: realToMM(d.from.y) },
          to_mm: { x: realToMM(d.to.x), y: realToMM(d.to.y) },
          offset_mm: realToMM(d.offset || 0),
          value_mm: dimensionValueMM(d),
          text_size_mm: d.textSize ?? 3,
          line_width_mm: d.lineWidth ?? 0.25,
          prefix: d.prefix ?? "",
          suffix: d.suffix ?? "",
        })),
        profiles: profiles.map((p) => ({
          id: p.id,
          sourceId: p.sourceId,
          bbox: p.bbox,
          area: p.area,
        })),
        selectedShapeIds: state.selectedShapeIds,
      };
    },

    getProjectContext: () => {
      const state = getState();
      const allShapes = state.pages.flatMap((p) =>
        p.layers.flatMap((l) => l.shapes),
      );
      const allDims = state.pages.flatMap((p) => p.dimensions || []);
      const page = getCurrentPage();
      return {
        projectName: state.projectName,
        projectId:
          typeof getCurrentProjectId === "function"
            ? getCurrentProjectId()
            : null,
        isNew: allShapes.length === 0 && allDims.length === 0,
        totalShapes: allShapes.length,
        totalDimensions: allDims.length,
        profileCount: extractProfilesFromPage(page).length,
        pageCount: state.pages.length,
        currentPage: page.name,
        viewDefinition: page.viewDefinition ?? null,
      };
    },

    applyCommands: ({ commands, options }) => {
      try {
        applyDrawingCommands(commands ?? [], options ?? {});
        render();
        uiUpdate();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    clearCanvas: () => {
      const layer = getCurrentLayer();
      layer.shapes = [];
      pushHistory();
      render();
      uiUpdate();
      return { ok: true };
    },

    getSvg: () => ({ svg: buildPageSVG(getCurrentPage()).outerHTML }),

    alignShapes: ({ direction }) => {
      const ok = alignShapes(direction);
      if (!ok) return { ok: false, error: "no shapes selected" };
      render();
      uiUpdate();
      return { ok: true };
    },

    distributeShapes: ({ axis }) => {
      const ok = distributeShapes(axis);
      if (!ok)
        return { ok: false, error: "need at least 3 shapes selected" };
      render();
      uiUpdate();
      return { ok: true };
    },

    undo: () => {
      const ok = undo();
      render();
      uiUpdate();
      return { ok, canUndo: canUndo(), canRedo: canRedo() };
    },

    redo: () => {
      const ok = redo();
      render();
      uiUpdate();
      return { ok, canUndo: canUndo(), canRedo: canRedo() };
    },

    groupShapes: () => {
      const ok = groupSelectedShapes();
      if (!ok)
        return { ok: false, error: "need at least 2 shapes selected" };
      render();
      uiUpdate();
      return { ok: true, groupId: getState().selectedShapeIds[0] ?? null };
    },

    ungroupShapes: () => {
      const ok = ungroupSelectedShapes();
      if (!ok) return { ok: false, error: "select exactly one group shape" };
      render();
      uiUpdate();
      return { ok: true };
    },

    booleanSubtract: async () => {
      const ok = await subtractSelectedShapesAsync();
      render();
      uiUpdate();
      return ok ? { ok: true } : { ok: false, error: "boolean subtract failed" };
    },

    booleanUnion: async () => {
      const ok = await unionSelectedShapesAsync();
      render();
      uiUpdate();
      return ok ? { ok: true } : { ok: false, error: "boolean union failed" };
    },

    booleanIntersect: async () => {
      const ok = await intersectSelectedShapesAsync();
      render();
      uiUpdate();
      return ok
        ? { ok: true }
        : { ok: false, error: "boolean intersect failed" };
    },

    booleanExclude: async () => {
      const ok = await excludeSelectedShapesAsync();
      render();
      uiUpdate();
      return ok ? { ok: true } : { ok: false, error: "boolean exclude failed" };
    },

    booleanFlatten: () => {
      const ok = flattenSelectedShapes();
      render();
      uiUpdate();
      return ok ? { ok: true } : { ok: false, error: "boolean flatten failed" };
    },

    addConstraint: ({ constraint }) => {
      try {
        const id = addConstraint(constraint);
        applyConstraints();
        render();
        uiUpdate();
        return { ok: true, id };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    removeConstraint: ({ id }) => {
      const ok = removeConstraint(id);
      render();
      uiUpdate();
      return { ok };
    },

    getConstraints: () => ({ constraints: getAllConstraints() }),

    setSelectedShapes: ({ ids }) => {
      getState().selectedShapeIds = Array.isArray(ids) ? ids : [];
      render();
      uiUpdate();
      return { ok: true };
    },

    get3DSceneStatus: () => get3DSceneStatus(),

    update3DScene: () => {
      const canvas = document.getElementById("canvas-3d");
      if (canvas && typeof init3DView === "function" && !window._3scene) {
        init3DView(canvas);
      }
      update3DScene();
      return get3DSceneStatus();
    },

    validate3DReadiness: () => validate3DReadiness(),

    createMultiviewBox: ({ options }) => {
      try {
        return createMultiviewBox(options ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    createPart: ({ options }) => {
      try {
        return createPart(options ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    layoutRectOnPageMm: ({ mmW, mmH, style }) => {
      try {
        return layoutRectOnPageMm(Number(mmW), Number(mmH), style ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    addDimensionsMm: ({ specs }) => {
      try {
        return addDimensionsMm(specs ?? []);
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    listDocsScenarios: () => listDocsScenarios(),

    runDocsScenario: ({ scenarioId, options }) => {
      try {
        return runDocsScenario(scenarioId, options ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    setReferenceImageScaleAnchor: ({ pageId, from, to, lengthMm }) =>
      setReferenceImageScaleAnchor(pageId ?? null, from, to, Number(lengthMm)),

    compilePartDsl: ({ dsl }) => compilePartDslPlan(dsl ?? {}),

    applyPartDsl: ({ dsl, runtimeOpts }) => {
      try {
        return applyPartDsl(dsl ?? {}, runtimeOpts ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    updatePartParam: ({ param, valueMm, runtimeOpts }) => {
      try {
        return updatePartParam(param, Number(valueMm), runtimeOpts ?? {});
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    validatePartManufacturability: ({ dsl }) =>
      validatePartManufacturability(dsl ?? {}),

    applyDigitizeProposals: ({ pageId, proposals, opts }) =>
      applyDigitizeProposals(pageId ?? null, proposals ?? [], opts ?? {}),

    confirmDigitizeProposals: ({ pageId, shapeIds }) =>
      confirmDigitizeProposals(pageId ?? null, shapeIds ?? null),
  };

  async function dispatch(action, params) {
    const fn = ACTIONS[action];
    if (!fn) throw new Error(`Unknown action: ${action}`);
    return await fn(params || {});
  }

  // Progressive enhancement for browsers that implement WebMCP. This uses the
  // same dispatcher as the remote MCP/WebSocket path, so both integrations stay
  // on one implementation of the actual Millrect operations.
  void globalThis.MillrectWebMcp?.register(dispatch);

  // ── UI状態 ────────────────────────────────────────────────────
  function setStatus(state) {
    const el = document.getElementById("agent-panel-status");
    if (!el) return;
    el.dataset.state = state;
    el.textContent =
      typeof t === "function"
        ? t(`agentPanel.status.${state}`)
        : state;
    const toggleBtn = document.getElementById("agent-panel-toggle");
    if (toggleBtn) {
      const running = state === "connecting" || state === "connected";
      toggleBtn.textContent =
        typeof t === "function"
          ? t(running ? "agentPanel.stop" : "agentPanel.start")
          : running
            ? "Stop"
            : "Start";
    }
  }

  function refreshUrlField() {
    const input = document.getElementById("agent-panel-url");
    if (input) input.value = pairingUrl();
  }

  // ── WebSocket ライフサイクル ──────────────────────────────────
  function connect() {
    manuallyStopped = false;
    if (ws) return;
    setStatus("connecting");
    const sessionId = getOrCreateSessionId();
    const socket = new WebSocket(
      `${workerOrigin().ws}/mcp/ws?session=${sessionId}`,
    );
    ws = socket;

    socket.onopen = () => {
      reconnectDelay = RECONNECT_BASE_DELAY;
      setStatus("connected");
    };

    socket.onmessage = async (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      try {
        const result = await dispatch(msg.action, msg.params);
        socket.send(JSON.stringify({ id: msg.id, result }));
      } catch (e) {
        socket.send(
          JSON.stringify({ id: msg.id, error: String(e.message || e) }),
        );
      }
    };

    socket.onclose = () => {
      ws = null;
      if (manuallyStopped) {
        setStatus("disconnected");
        return;
      }
      setStatus("error");
      scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose が後続で発火するのでそちらで再接続をスケジュールする
    };
  }

  function disconnect() {
    manuallyStopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    setStatus("disconnected");
  }

  function scheduleReconnect() {
    if (manuallyStopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!manuallyStopped) connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY);
  }

  // ── パネル配線 ────────────────────────────────────────────────
  function wire() {
    const panel = document.getElementById("agent-panel");
    const toggleBtn = document.getElementById("btn-agent-panel");
    if (!panel || !toggleBtn) return;

    toggleBtn.addEventListener("click", () => {
      const isHidden = panel.hidden;
      panel.hidden = !isHidden;
      toggleBtn.setAttribute("aria-pressed", isHidden ? "true" : "false");
      if (isHidden) {
        refreshUrlField();
        setStatus(ws ? "connected" : "disconnected");
      }
    });

    document
      .getElementById("agent-panel-close")
      ?.addEventListener("click", () => {
        panel.hidden = true;
        toggleBtn.setAttribute("aria-pressed", "false");
      });

    document
      .getElementById("agent-panel-copy")
      ?.addEventListener("click", async () => {
        const input = document.getElementById("agent-panel-url");
        if (!input) return;
        try {
          await navigator.clipboard.writeText(input.value);
        } catch {
          input.select();
          document.execCommand("copy");
        }
      });

    document
      .getElementById("agent-panel-toggle")
      ?.addEventListener("click", () => {
        if (ws) disconnect();
        else connect();
      });

    document
      .getElementById("agent-panel-new-session")
      ?.addEventListener("click", () => {
        const wasConnected = !!ws;
        if (wasConnected) disconnect();
        regenerateSessionId();
        refreshUrlField();
        if (wasConnected) connect();
      });

    setStatus("disconnected");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
