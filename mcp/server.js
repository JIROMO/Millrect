#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";
import { readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepoFile(filename) {
  return readFileSync(join(REPO_ROOT, filename), "utf8");
}

const WORKFLOW_CHEATSHEET = `# Millrect MCP 操作チェックリスト

## 開始前（必須）
1. Resource \`millrect://docs/agent-manual\` を読む（スキーマ・座標系・禁止事項）
2. （任意）Resource \`millrect://docs/mcp-reference\` — MCP ツール全一覧・apply_commands
3. \`get_project_context\` — 新規/作業中・ViewDefinition・Profile 数を確認
4. \`get_state\` — 現在ページのシェイプ・寸法・スケールを確認

## 2D 図面操作
- 変更は \`apply_commands\` でバッチ適用（1 Undo で全部戻る）
- **Intent API（推奨）**: 座標計算不要の高レベルツールを優先
  - \`compile_part_dsl\` / \`apply_part_dsl\` — Part DSL v1（Solver + DSL パイプライン）
  - \`update_part_param\` — W/D/H 更新（Solver 差分）
  - \`import_part_dsl_file\` — \`.mlr-part.json\` から Part 生成
  - \`validate_manufacturability\` — 製造ルール DSL 検証
  - \`layout_rect_mm\` — 現在ページに mm 矩形を中央配置
  - \`validate_3d_readiness\` — 3D 生成前チェック
  - \`load_reference_image\` / \`set_reference_scale_anchor\` — スケッチ下絵 + スケール校正
  - \`digitize_sketch\` / \`confirm_digitize_proposals\` — Vision 提案 → ゴースト → 確定
- **ドキュメント（Electron 起動時）**: \`list_docs_scenarios\` → \`run_docs_scenario\` → \`capture_screenshot\`
- 低レベル: 各 shape/dimension に固有 \`id\` を付ける（例: rect-001）
- dimension は \`addDimension\` または \`addShape\` + \`type:"dimension"\` → \`page.dimensions[]\` へ
- boolean / グループ化の前に \`set_selected_shapes\`
- 座標は real units（1 mm = 10 units）

## 3D 立体
- 最低 2 軸の正投影ページ（例: 上面 top + 正面 front）
- 各ページに \`viewDefinition.type\` と**閉じた輪郭**（rect/circle/bezier/path）
- \`feature.depth\` は使わない（廃止）
- 描画後 \`update_3d_scene\` → \`get_3d_scene_status\`（meshCount / message）

## 確認
- \`get_svg\` で SVG 確認
- 失敗時 \`undo\` / \`redo\`
`;

const WS_DEFAULT_PORT = 23450;
const CONNECT_TIMEOUT = 3000;

function getWsUrl() {
  try {
    const port = readFileSync(
      join(homedir(), ".millrect", "millrect-ws-port"),
      "utf8",
    ).trim();
    return `ws://localhost:${port}`;
  } catch {
    return `ws://localhost:${WS_DEFAULT_PORT}`;
  }
}

function getWsToken() {
  try {
    return readFileSync(
      join(homedir(), ".millrect", "millrect-ws-token"),
      "utf8",
    ).trim();
  } catch {
    return null;
  }
}

// ── WebSocket helper ────────────────────────────────────────────

let _reqId = 0;
const _pending = new Map(); // id → { resolve, reject }
let _ws = null;

function connectWS() {
  const url = getWsUrl();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(
        new Error(`Millrect が起動していません（${url} に接続できません）`),
      );
    }, CONNECT_TIMEOUT);

    ws.on("open", () => {
      clearTimeout(timer);
      _ws = ws;
      resolve(ws);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const p = _pending.get(msg.id);
        if (p) {
          _pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error));
          else p.resolve(msg.result);
        }
      } catch {}
    });

    ws.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Millrect が起動していません（${url}）: ` + e.message));
    });

    ws.on("close", () => {
      _ws = null;
    });
  });
}

async function call(action, params = {}) {
  const token = getWsToken();
  if (!token) {
    throw new Error(
      "Millrect の WS トークンが見つかりません。Electron アプリを起動してください。",
    );
  }
  if (!_ws || _ws.readyState !== WebSocket.OPEN) {
    await connectWS();
  }
  return new Promise((resolve, reject) => {
    const id = String(++_reqId);
    _pending.set(id, { resolve, reject });
    _ws.send(JSON.stringify({ id, action, token, ...params }));
    setTimeout(() => {
      if (_pending.has(id)) {
        _pending.delete(id);
        reject(new Error("タイムアウト"));
      }
    }, 8000);
  });
}

function parseJsonField(value, fieldName) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      `${fieldName} はJSON文字列ではなくオブジェクトで渡してください`,
    );
  }
}

function normalizeCommand(cmd) {
  const normalized = { ...cmd };
  if ("shape" in normalized)
    normalized.shape = parseJsonField(normalized.shape, "shape");
  if ("values" in normalized)
    normalized.values = parseJsonField(normalized.values, "values");
  if ("scale" in normalized)
    normalized.scale = parseJsonField(normalized.scale, "scale");
  return normalized;
}

// ── MCP Server ──────────────────────────────────────────────────

const server = new McpServer({
  name: "millrect",
  version: "1.0.0",
});

// ── Resources（ドメイン知識）────────────────────────────────────

server.registerResource(
  "agent-manual",
  "millrect://docs/agent-manual",
  {
    title: "Millrect AI Agent Manual",
    description:
      "図面操作のスキーマ・API・禁止事項。MCP で図面を触る前に必ず読むこと。",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: readRepoFile("AGENT.md") }],
  }),
);

server.registerResource(
  "workflow",
  "millrect://docs/workflow",
  {
    title: "Millrect MCP Workflow",
    description: "図面操作の標準手順チェックリスト（短縮版）。",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: WORKFLOW_CHEATSHEET }],
  }),
);

server.registerResource(
  "mcp-reference",
  "millrect://docs/mcp-reference",
  {
    title: "Millrect MCP Tool Reference",
    description:
      "MCP ツール全一覧と apply_commands アクション（agent-manual の補足）。",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: readRepoFile("docs/MCP-REFERENCE.md") }],
  }),
);

server.registerResource(
  "taste-memory",
  "millrect://docs/taste-memory",
  {
    title: "Taste Memory Design",
    description:
      "美意識・判断の 3 層メモリ（Global / Project / Artifact）設計仕様。",
    mimeType: "text/markdown",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: readRepoFile("docs/TASTE-MEMORY.md") }],
  }),
);

// ── Prompts（定型タスク）──────────────────────────────────────────

server.registerPrompt(
  "operate_drawing",
  {
    title: "Millrect 図面操作",
    description:
      "2D 図面の確認・追加・編集を行う。Resource agent-manual を読んだうえで標準ワークフローに従う。",
  },
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Millrect の図面を操作してください。

手順:
1. Resource \`millrect://docs/agent-manual\` を読む
2. \`get_project_context\` → \`validate_3d_readiness\` で現状確認
3. 高レベル: \`apply_part_dsl\` / \`create_multiview_box\` / \`layout_rect_mm\` を優先
4. スケッチ取り込み: \`load_reference_image\` → \`set_reference_scale_anchor\` → \`digitize_sketch\` → \`confirm_digitize_proposals\`
5. 細部編集は \`apply_commands\`（shape に id 必須、dimension は page.dimensions[] へ）
6. \`get_svg\` で結果確認
7. 3D が必要なら \`update_3d_scene\` → \`get_3d_scene_status\`

禁止: feature.depth による押し出し、dimension を layer.shapes に混ぜること、ゴースト図形を 3D 前に確定しないこと。`,
        },
      },
    ],
  }),
);

const TASTE_DIALOG_PROMPT = `Millrect の Taste Memory 対話フェーズです。いきなり図面や Part DSL を生成しないでください。

1. Resource \`millrect://docs/taste-memory\` を読む
2. \`get_taste_context\` / \`get_project_context\` で現状確認
3. ユーザーに質問: 雰囲気・参考ブランド・触り心地・3Dプリント感・作る理由
4. 参考 URL/ブランドは \`update_project_brief\` の tasteRefs に記録
5. 言語化した好みは designPrinciples として \`update_project_brief\`（ユーザー修正は record_decision）
6. 方針合意後 \`set_project_phase\` を brief → make に進める`;

const SESSION_CLOSE_PROMPT = `制作セッションの Learn フェーズです。

1. 今回の制作で分かった好みを短文の designPrinciples / decisions にまとめる
2. \`append_session_learnings\` で projectBrief に追記（2 案件以上で同趣旨なら Global 昇格候補）
3. 明示的に残す価値観は \`promote_principle\`
4. \`list_global_principles\` で共通の好みを確認
5. レビュー所見があれば \`append_artifact_log\`（capture_path があれば付与）`;

server.registerPrompt(
  "taste_dialog",
  {
    title: "Taste 対話（生成前）",
    description:
      "美意識・意図を対話で整理して projectBrief に記録する。図面生成の前に使う。",
  },
  () => ({
    messages: [
      { role: "user", content: { type: "text", text: TASTE_DIALOG_PROMPT } },
    ],
  }),
);

server.registerPrompt(
  "session_close",
  {
    title: "セッション終了（Learn）",
    description: "今回の学びを projectBrief / Global Taste に記録する。",
  },
  () => ({
    messages: [
      { role: "user", content: { type: "text", text: SESSION_CLOSE_PROMPT } },
    ],
  }),
);

server.registerPrompt(
  "create_3d_model",
  {
    title: "Millrect 多ビュー 3D 生成",
    description: "上面+正面など複数正投影ページから CSG 交差で立体を生成する。",
    argsSchema: z.object({
      views: z
        .string()
        .optional()
        .describe("必要なビュー（例: top+front）。省略時は上面+正面を想定。"),
    }),
  },
  ({ views }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Millrect で多ビュー CSG 交差により 3D 立体を作成してください。
${views ? `目標ビュー: ${views}` : "目標: 上面 (top) + 正面 (front)"}

手順:
1. Resource \`millrect://docs/agent-manual\` の「3D API」「Page.viewDefinition」を確認
2. \`get_project_context\` — ページ数・ViewDefinition・profileCount を確認
3. 不足ビューがあれば \`apply_commands\` で \`addPage\` + viewDefinition を設定
4. 各ページに閉じた輪郭（rect/circle/path 等）を \`apply_commands\` で追加
5. \`update_3d_scene\` → \`get_3d_scene_status\`
   - meshCount > 0 なら成功
   - message があればビュー不足または輪郭不足 — 指示に従って修正

禁止: per-shape の feature.depth。3D に使うのは図面輪郭のみ。`,
        },
      },
    ],
  }),
);

// ── Tools ───────────────────────────────────────────────────────

// get_project_context
server.tool(
  "get_project_context",
  "プロジェクトの状態を確認する。isNew=true なら白紙、false なら作業中。図面操作の前に Resource millrect://docs/agent-manual を読み、続けて本ツールで新規/継続を確認すること。",
  {},
  async () => {
    const result = await call("getProjectContext");
    const vd = result.viewDefinition;
    const lines = [
      `プロジェクト名: ${result.projectName}`,
      `状態: ${result.isNew ? "新規（図形なし）" : "作業中"}`,
      `シェイプ総数: ${result.totalShapes}`,
      `寸法線総数: ${result.totalDimensions ?? 0}`,
      `Profile数（3D生成可能）: ${result.profileCount ?? 0}`,
      `ページ数: ${result.pageCount}`,
      `現在のページ: ${result.currentPage}`,
      `ViewDefinition: ${vd?.type ?? "未設定"}`,
      `プロジェクトID: ${result.projectId}`,
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// get_state
server.tool(
  "get_state",
  "現在の Millrect 図面の状態を取得する。ページ情報・シェイプ一覧・スケールが返る。図面を操作する前に必ず呼ぶこと。",
  {},
  async () => {
    const result = await call("getState");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// undo
server.tool(
  "undo",
  "最後の操作を元に戻す。canUndo=false なら何もしない。",
  {},
  async () => {
    const result = await call("undo");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? `✓ Undo しました (canUndo:${result.canUndo}, canRedo:${result.canRedo})`
            : "これ以上 Undo できません",
        },
      ],
    };
  },
);

// redo
server.tool(
  "redo",
  "Undo した操作をやり直す。canRedo=false なら何もしない。",
  {},
  async () => {
    const result = await call("redo");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? `✓ Redo しました (canUndo:${result.canUndo}, canRedo:${result.canRedo})`
            : "これ以上 Redo できません",
        },
      ],
    };
  },
);

// set_selected_shapes
server.tool(
  "set_selected_shapes",
  "指定した ID のシェイプを選択状態にする。boolean演算・グループ化の前に必ず呼ぶこと。空配列を渡すと全選択解除。",
  {
    ids: z.array(z.string()).describe("選択する shape ID の配列"),
  },
  async ({ ids }) => {
    await call("setSelectedShapes", { ids });
    return {
      content: [
        { type: "text", text: `✓ ${ids.length} 個のシェイプを選択しました` },
      ],
    };
  },
);

// group_shapes
server.tool(
  "group_shapes",
  "選択中のシェイプをグループ化する。2個以上選択していること。グループIDが返る。",
  {},
  async () => {
    const result = await call("groupShapes");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? `✓ グループ化しました (groupId: ${result.groupId})`
            : "グループ化に失敗しました（2個以上のシェイプを選択してください）",
        },
      ],
    };
  },
);

// ungroup_shapes
server.tool(
  "ungroup_shapes",
  "選択中のグループを解除する。グループシェイプを選択した状態で呼ぶこと。",
  {},
  async () => {
    await call("ungroupShapes");
    return { content: [{ type: "text", text: "✓ グループを解除しました" }] };
  },
);

// boolean_subtract
server.tool(
  "boolean_subtract",
  "選択中のシェイプで boolean 差分演算を行う。最初に選択したシェイプから残りを差し引く。2個以上選択していること。",
  {},
  async () => {
    const result = await call("booleanSubtract");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? "✓ Boolean 差分を実行しました"
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// boolean_union
server.tool(
  "boolean_union",
  "選択中のシェイプで boolean 結合演算を行う（ユニオン）。2個以上選択していること。",
  {},
  async () => {
    const result = await call("booleanUnion");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? "✓ Boolean 結合を実行しました"
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// boolean_intersect
server.tool(
  "boolean_intersect",
  "選択中のシェイプで boolean 交差演算を行う。2個以上選択していること。",
  {},
  async () => {
    const result = await call("booleanIntersect");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? "✓ Boolean 交差を実行しました"
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// boolean_exclude
server.tool(
  "boolean_exclude",
  "選択中のシェイプで boolean 除外演算を行う（XOR）。2個以上選択していること。",
  {},
  async () => {
    const result = await call("booleanExclude");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? "✓ Boolean 除外を実行しました"
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// boolean_flatten
server.tool(
  "boolean_flatten",
  "選択中の図形またはグループを 1 つの path に統合する。1個以上選択していること。",
  {},
  async () => {
    const result = await call("booleanFlatten");
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? "✓ Boolean 統合を実行しました"
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// add_constraint
server.tool(
  "add_constraint",
  `幾何拘束を追加する。拘束タイプ:
- horizontal   : line を水平にする
- vertical     : line を垂直にする
- parallel     : 2本の line を平行にする
- equal_length : 2本の line を等長にする
- fixed        : shape の位置を固定する (params: {x, y})
- coincident   : 2つの端点を一致させる (params: {point1:"start"|"end", point2:"start"|"end"})
- symmetric    : 2点を軸対称にする (params: {axis:"x"|"y", value:number})`,
  {
    type: z
      .enum([
        "horizontal",
        "vertical",
        "parallel",
        "equal_length",
        "fixed",
        "coincident",
        "symmetric",
      ])
      .describe("拘束タイプ"),
    shapeIds: z.array(z.string()).describe("対象シェイプ ID の配列"),
    params: z.any().optional().describe("拘束パラメータ（タイプにより異なる）"),
  },
  async ({ type, shapeIds, params }) => {
    const constraint = { type, shapeIds, ...(params ? { params } : {}) };
    const result = await call("addConstraint", { constraint });
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? `✓ 拘束を追加しました (id: ${result.id})`
            : `エラー: ${result.error}`,
        },
      ],
    };
  },
);

// remove_constraint
server.tool(
  "remove_constraint",
  "拘束を削除する。get_constraints で ID を確認してから呼ぶこと。",
  {
    id: z.string().describe("削除する拘束の ID"),
  },
  async ({ id }) => {
    const result = await call("removeConstraint", { id });
    return {
      content: [
        {
          type: "text",
          text: result.ok
            ? `✓ 拘束 ${id} を削除しました`
            : `拘束 ${id} が見つかりません`,
        },
      ],
    };
  },
);

// get_constraints
server.tool(
  "get_constraints",
  "現在のページの幾何拘束一覧を取得する。",
  {},
  async () => {
    const result = await call("getConstraints");
    if (!result.constraints.length) {
      return { content: [{ type: "text", text: "拘束はありません" }] };
    }
    return {
      content: [
        { type: "text", text: JSON.stringify(result.constraints, null, 2) },
      ],
    };
  },
);

// update_3d_scene
server.tool(
  "update_3d_scene",
  "全ページの図面から 3D メッシュを再生成する。完了後に meshCount / message を返す。",
  {},
  async () => {
    const result = await call("update3DScene");
    const lines = [
      `meshCount: ${result.meshCount}`,
      result.message ? `message: ${result.message}` : "message: (なし)",
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

// get_3d_scene_status
server.tool(
  "get_3d_scene_status",
  "現在の 3D シーン状態を取得する（meshCount / message）。再生成はしない。",
  {},
  async () => {
    const result = await call("get3DSceneStatus");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// validate_3d_readiness
server.tool(
  "validate_3d_readiness",
  "3D 生成準備状況を構造化して返す。ビュー軸数・各ページの閉輪郭・既知の問題一覧。描画前チェックに使う。",
  {},
  async () => {
    const result = await call("validate3DReadiness");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// create_multiview_box
server.tool(
  "create_multiview_box",
  `mm 指定で多ビュー直方体を一括生成する（Intent API）。
上面+正面を必須生成。views に "right" を含めると右側面も追加。
座標計算不要 — sizeMm のみ指定すれば用紙中央に配置される。`,
  {
    project_name: z.string().optional().describe("プロジェクト名"),
    width_mm: z.number().optional().describe("幅 mm（デフォルト 120）"),
    depth_mm: z.number().optional().describe("奥行 mm（デフォルト 80）"),
    height_mm: z.number().optional().describe("高さ mm（デフォルト 50）"),
    views: z
      .array(z.enum(["top", "front", "right", "left"]))
      .optional()
      .describe('生成ビュー（デフォルト ["top","front"]）'),
    add_dimensions: z
      .boolean()
      .optional()
      .describe("各ビューに外周寸法線を追加"),
    update_3d: z
      .boolean()
      .optional()
      .describe("生成後に 3D を再生成（デフォルト true）"),
  },
  async ({
    project_name,
    width_mm,
    depth_mm,
    height_mm,
    views,
    add_dimensions,
    update_3d,
  }) => {
    const options = {
      projectName: project_name,
      sizeMm: {
        width: width_mm ?? 120,
        depth: depth_mm ?? 80,
        height: height_mm ?? 50,
      },
      views: views ?? ["top", "front"],
      addDimensions: add_dimensions ?? false,
      update3d: update_3d ?? true,
    };
    const result = await call("createMultiviewBox", { options });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// create_part
server.tool(
  "create_part",
  `セマンティック Part 生成（Intent API）。現状 kind="box" のみ。
features 例: hole_grid — 指定ビューの矩形に等ピッチ穴を path 輪郭として追加（3D 貫通穴）。`,
  {
    kind: z.enum(["box"]).optional().describe('パーツ種別（デフォルト "box"）'),
    project_name: z.string().optional().describe("プロジェクト名"),
    width_mm: z.number().optional().describe("幅 mm"),
    depth_mm: z.number().optional().describe("奥行 mm"),
    height_mm: z.number().optional().describe("高さ mm"),
    views: z
      .array(z.enum(["top", "front", "right", "left"]))
      .optional()
      .describe("多ビュー（デフォルト top+front）"),
    features: z
      .array(
        z.object({
          type: z.enum(["hole_grid"]).describe("feature 種別"),
          view: z
            .enum(["top", "front", "right", "left", "bottom", "back"])
            .optional()
            .describe("適用ビュー（hole_grid デフォルト top）"),
          diameter_mm: z.number().optional().describe("穴径 mm"),
          inset_mm: z.number().optional().describe("外周からの inset mm"),
          count: z
            .array(z.number().int().min(1))
            .length(2)
            .optional()
            .describe("穴数 [cols, rows]"),
        }),
      )
      .optional()
      .describe("付加 feature 配列"),
    add_dimensions: z.boolean().optional(),
    update_3d: z.boolean().optional(),
  },
  async ({
    kind,
    project_name,
    width_mm,
    depth_mm,
    height_mm,
    views,
    features,
    add_dimensions,
    update_3d,
  }) => {
    const options = {
      kind: kind ?? "box",
      projectName: project_name,
      sizeMm: {
        width: width_mm ?? 120,
        depth: depth_mm ?? 80,
        height: height_mm ?? 50,
      },
      views: views ?? ["top", "front", "right"],
      features: features ?? [],
      addDimensions: add_dimensions ?? false,
      update3d: update_3d ?? true,
    };
    const result = await call("createPart", { options });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// layout_rect_mm
server.tool(
  "layout_rect_mm",
  "現在のページに mm 指定の矩形を用紙中央へ配置する（Intent API）。",
  {
    width_mm: z.number().describe("幅 mm"),
    height_mm: z.number().describe("高さ mm"),
    add_dimensions: z.boolean().optional().describe("外周寸法線を追加"),
    fill: z.string().optional().describe("塗り色（例: #8fb7ff）"),
    stroke: z.string().optional().describe("線色"),
  },
  async ({ width_mm, height_mm, add_dimensions, fill, stroke }) => {
    const style = { addDimensions: add_dimensions ?? false };
    if (fill) style.fill = fill;
    if (stroke) style.stroke = stroke;
    const result = await call("layoutRectOnPageMm", {
      mmW: width_mm,
      mmH: height_mm,
      style,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// list_docs_scenarios
server.tool(
  "list_docs_scenarios",
  "ドキュメント用シナリオ ID 一覧（capture_screenshot / run_docs_scenario 用）。Electron 起動必須。",
  {},
  async () => {
    const result = await call("listDocsScenarios");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// run_docs_scenario
server.tool(
  "run_docs_scenario",
  `ドキュメント用シナリオを適用する（Intent API + 既存 docs レイアウト）。
scenario 例: multiview_box_3view, drawing_rect, drawing_features, editing_demo, intent_part_holes`,
  {
    scenario: z.string().describe("シナリオ ID（list_docs_scenarios で確認）"),
    locale: z.enum(["ja", "en"]).optional().describe("UI 言語"),
    update_3d: z.boolean().optional().describe("3D 再生成"),
  },
  async ({ scenario, locale, update_3d }) => {
    const result = await call("runDocsScenario", {
      scenarioId: scenario,
      options: { locale, update3d: update_3d },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// capture_screenshot
server.tool(
  "capture_screenshot",
  `画面キャプチャを PNG 保存（Electron 必須）。docs 更新向け。
target: viewport | canvas | toolbar | sidebar | tools | panel_3d | svg
scenario + prepare.viewType / shapeId でキャプチャ前にシーンを整える。`,
  {
    path: z
      .string()
      .describe("保存先（例: docs/images/drawing-rect.png）。リポジトリ相対可"),
    target: z
      .enum([
        "viewport",
        "canvas",
        "toolbar",
        "sidebar",
        "tools",
        "panel_3d",
        "svg",
      ])
      .optional()
      .describe("切り取り対象（省略時はウィンドウ全体）"),
    scenario: z.string().optional().describe("事前に run するシナリオ ID"),
    locale: z.enum(["ja", "en"]).optional(),
    view_type: z
      .enum(["top", "front", "right", "left", "back", "bottom"])
      .optional()
      .describe("キャプチャ前に切り替えるビュー"),
    shape_id: z.string().optional().describe("フォーカスする shape ID"),
    fit: z.enum(["page", "drawing_features"]).optional().describe("ズーム調整"),
    open_3d: z.boolean().optional().describe("3D パネルを開く"),
    record_artifact: z
      .boolean()
      .optional()
      .describe("保存後 projectBrief.artifactLog に追記（デフォルト true）"),
  },
  async ({
    path: outPath,
    target,
    scenario,
    locale,
    view_type,
    shape_id,
    fit,
    open_3d,
    record_artifact,
  }) => {
    const prepare = {};
    if (view_type) prepare.viewType = view_type;
    if (shape_id) prepare.shapeId = shape_id;
    if (fit) prepare.fit = fit;
    if (open_3d) prepare.open3d = true;

    const result = await call("captureScreenshot", {
      options: {
        path: outPath,
        target,
        scenario,
        locale,
        prepare: Object.keys(prepare).length ? prepare : undefined,
        recordArtifact: record_artifact !== false,
      },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// load_reference_image
server.tool(
  "load_reference_image",
  "参照画像ファイルを現在ページ（または page_id）の背景レイヤーに配置。Electron 必須。",
  {
    file_path: z.string().describe("画像パス（リポジトリ相対可）"),
    page_id: z.string().optional(),
    width_mm: z.number().optional().describe("表示幅 mm"),
    height_mm: z.number().optional().describe("表示高さ mm"),
    opacity: z.number().optional().describe("0–1"),
  },
  async ({ file_path, page_id, width_mm, height_mm, opacity }) => {
    const result = await call("loadReferenceImageFromFile", {
      filePath: file_path,
      pageId: page_id ?? null,
      widthMm: width_mm ?? 120,
      heightMm: height_mm ?? 80,
      opacity: opacity ?? 0.45,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// set_reference_scale_anchor
server.tool(
  "set_reference_scale_anchor",
  "参照画像上の 2 点間を既知 mm 長に合わせてスケール（real units 座標）。",
  {
    from_x: z.number().describe("起点 X（real units）"),
    from_y: z.number().describe("起点 Y"),
    to_x: z.number().describe("終点 X"),
    to_y: z.number().describe("終点 Y"),
    length_mm: z.number().describe("2 点間の実長 mm"),
    page_id: z.string().optional(),
  },
  async ({ from_x, from_y, to_x, to_y, length_mm, page_id }) => {
    const result = await call("setReferenceImageScaleAnchor", {
      pageId: page_id ?? null,
      from: { x: from_x, y: from_y },
      to: { x: to_x, y: to_y },
      lengthMm: length_mm,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

const digitizeProposalSchema = z.object({
  type: z.enum(["rect", "circle", "line"]),
  id: z.string().optional(),
  x_mm: z.number().optional(),
  y_mm: z.number().optional(),
  width_mm: z.number().optional(),
  height_mm: z.number().optional(),
  rx_mm: z.number().optional(),
  cx_mm: z.number().optional(),
  cy_mm: z.number().optional(),
  r_mm: z.number().optional(),
  x1_mm: z.number().optional(),
  y1_mm: z.number().optional(),
  x2_mm: z.number().optional(),
  y2_mm: z.number().optional(),
});

// digitize_sketch
server.tool(
  "digitize_sketch",
  `Vision LLM 等から渡された primitive 提案をゴースト図形として配置（mm 第一級）。
confirm=true で即確定。Millrect 内に Vision は含まない — 外部が proposals を生成する。`,
  {
    proposals: z
      .array(digitizeProposalSchema)
      .describe("rect / circle / line の mm 座標提案"),
    page_id: z.string().optional(),
    layer_id: z.string().optional(),
    clear_existing: z
      .boolean()
      .optional()
      .describe("既存ゴーストを削除してから配置（デフォルト true）"),
    confirm: z
      .boolean()
      .optional()
      .describe("配置後に ghost フラグを解除して確定"),
  },
  async ({ proposals, page_id, layer_id, clear_existing, confirm }) => {
    const applyResult = await call("applyDigitizeProposals", {
      pageId: page_id ?? null,
      proposals,
      opts: {
        layerId: layer_id ?? null,
        clearExisting: clear_existing !== false,
      },
    });
    if (!applyResult?.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify(applyResult, null, 2) }],
      };
    }
    if (confirm) {
      const confirmResult = await call("confirmDigitizeProposals", {
        pageId: page_id ?? null,
        shapeIds: applyResult.shapeIds ?? null,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { apply: applyResult, confirm: confirmResult },
              null,
              2,
            ),
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(applyResult, null, 2) }],
    };
  },
);

// confirm_digitize_proposals
server.tool(
  "confirm_digitize_proposals",
  "ゴースト図形を確定（3D 生成対象にする）。shape_ids 省略時はページ上の全ゴースト。",
  {
    page_id: z.string().optional(),
    shape_ids: z.array(z.string()).optional(),
  },
  async ({ page_id, shape_ids }) => {
    const result = await call("confirmDigitizeProposals", {
      pageId: page_id ?? null,
      shapeIds: shape_ids ?? null,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// compile_part_dsl
server.tool(
  "compile_part_dsl",
  `Part DSL v1 をコンパイル（dry-run）。state は変更しない。
Solver + DSL パイプライン: DSL → compile plan → (applyPartDsl で) geometry`,
  {
    dsl: z
      .object({
        version: z.number().optional(),
        part: z.string().optional(),
        params: z
          .object({
            W: z.number().optional(),
            D: z.number().optional(),
            H: z.number().optional(),
          })
          .optional(),
        views: z.array(z.string()).optional(),
        features: z.array(z.any()).optional(),
      })
      .describe("Part DSL v1 オブジェクト"),
  },
  async ({ dsl }) => {
    const result = await call("compilePartDsl", { dsl });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// apply_part_dsl
server.tool(
  "apply_part_dsl",
  "Part DSL v1 をコンパイルして図面に適用する（create_part の DSL 版）。",
  {
    dsl: z.object({}).passthrough().describe("Part DSL v1"),
    project_name: z.string().optional(),
    update_3d: z.boolean().optional(),
  },
  async ({ dsl, project_name, update_3d }) => {
    const result = await call("applyPartDsl", {
      dsl,
      runtimeOpts: {
        projectName: project_name,
        update3d: update_3d ?? true,
      },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ── Taste Memory（Project 層）────────────────────────────────────

server.tool(
  "get_taste_context",
  "プロジェクトの Taste Memory（projectBrief）と要約を返す。Global は未実装。",
  {},
  async () => {
    const result = await call("getTasteContext");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "update_project_brief",
  "projectBrief を部分更新（intent / phase / principles / decisions 等）。Undo 対象。",
  {
    patch: z
      .object({})
      .passthrough()
      .describe("TASTE-MEMORY.md の projectBrief 部分更新"),
    history_label: z.string().optional(),
  },
  async ({ patch, history_label }) => {
    const result = await call("updateProjectBrief", {
      patch,
      historyLabel: history_label,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "record_decision",
  "採用・却下・修正理由を Judgment として projectBrief.decisions に追加。",
  {
    outcome: z.enum(["accept", "reject", "revise", "note"]),
    reason: z.string(),
    target_kind: z.string().optional(),
    target_id: z.string().optional(),
    promote_candidate: z.boolean().optional(),
    session_id: z.string().optional(),
  },
  async ({
    outcome,
    reason,
    target_kind,
    target_id,
    promote_candidate,
    session_id,
  }) => {
    const decision = {
      outcome,
      reason,
      sessionId: session_id,
      promoteCandidate: promote_candidate,
    };
    if (target_kind) {
      decision.target = { kind: target_kind, id: target_id };
    }
    const result = await call("recordDecision", { decision });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "set_project_phase",
  "制作フェーズを更新（discover / taste / brief / make / review / learn / done）。",
  {
    phase: z.enum([
      "discover",
      "taste",
      "brief",
      "make",
      "review",
      "learn",
      "done",
    ]),
  },
  async ({ phase }) => {
    const result = await call("setProjectPhase", { phase });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_global_principles",
  "IndexedDB に保存されたユーザー横断の Taste（principles / pending）一覧。",
  {},
  async () => {
    const result = await call("listGlobalPrinciples");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "promote_principle",
  "価値観を Global Taste に手動昇格（2 プロジェクト待ちをスキップ可）。",
  {
    statement: z.string(),
    polarity: z.enum(["prefer", "avoid"]).optional(),
    scope: z.string().optional(),
  },
  async ({ statement, polarity, scope }) => {
    const result = await call("promotePrinciple", {
      input: { statement, polarity, scope },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "append_artifact_log",
  "レビュー結果を projectBrief.artifactLog に追記。",
  {
    trigger: z
      .enum([
        "user_feedback",
        "ai_self_review",
        "export",
        "param_change",
        "other",
      ])
      .optional(),
    outcome: z.enum(["accept", "reject", "partial"]).optional(),
    capture_path: z.string().optional(),
    aligned: z.array(z.string()).optional(),
    misaligned: z.array(z.string()).optional(),
  },
  async ({ trigger, outcome, capture_path, aligned, misaligned }) => {
    const result = await call("appendArtifactLog", {
      entry: {
        trigger: trigger ?? "ai_self_review",
        outcome,
        capturePath: capture_path,
        evaluation: {
          aligned,
          misaligned,
        },
      },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "append_session_learnings",
  "Learn フェーズ: designPrinciples / decisions をバッチ追加。",
  {
    design_principles: z.array(z.object({}).passthrough()).optional(),
    decisions: z.array(z.object({}).passthrough()).optional(),
    phase: z
      .enum(["discover", "taste", "brief", "make", "review", "learn", "done"])
      .optional(),
  },
  async ({ design_principles, decisions, phase }) => {
    const result = await call("appendSessionLearnings", {
      payload: {
        designPrinciples: design_principles,
        decisions,
        phase,
      },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// update_part_param
server.tool(
  "update_part_param",
  "Part のパラメータを mm 指定で更新（part 種別に応じた Solver 差分）。",
  {
    param: z
      .string()
      .describe("W/D/H（box）, W/H（panel）, A/B/T/H（l_bracket）等"),
    value_mm: z.number().describe("新しい値 mm"),
    project_name: z.string().optional(),
  },
  async ({ param, value_mm, project_name }) => {
    const result = await call("updatePartParam", {
      param,
      valueMm: value_mm,
      runtimeOpts: { projectName: project_name },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// validate_manufacturability
server.tool(
  "validate_manufacturability",
  "Part DSL の製造ルール（穴径・ケルフ・端距離等）を検証。state は変更しない。",
  {
    dsl: z.object({}).passthrough().describe("Part DSL v1"),
  },
  async ({ dsl }) => {
    const result = await call("validatePartManufacturability", { dsl });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// import_part_dsl_file
server.tool(
  "import_part_dsl_file",
  "`.mlr-part.json` ファイルから Part DSL を読み込み図面に適用する。",
  {
    file_path: z
      .string()
      .describe("Part DSL JSON ファイルパス（リポジトリ相対可）"),
    project_name: z.string().optional(),
    update_3d: z.boolean().optional(),
  },
  async ({ file_path, project_name, update_3d }) => {
    const result = await call("importPartDslFromFile", {
      filePath: file_path,
      runtimeOpts: {
        projectName: project_name,
        update3d: update_3d ?? true,
      },
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// apply_commands
server.tool(
  "apply_commands",
  `図面にコマンドをバッチ適用する。複数コマンドをまとめて送れる（1回のUndoで全部戻る）。
アクション一覧:
- addShape        : 通常シェイプ（rect/circle/line/text/bezier/path）を追加
- updateShape     : 既存シェイプを更新
- deleteShape     : 既存シェイプを削除
- addDimension    : 寸法線を追加（page.dimensions[] に格納される）
- updateDimension : 既存寸法線を更新
- addConstraint   : 幾何拘束を追加 (constraint フィールドに { type, shapeIds, params? })
- removeConstraint: 拘束を削除 (id フィールドに拘束ID)
- applyConstraints: 全拘束を即時解く
- selectShapes    : 選択状態を変更 (ids フィールドに ID 配列)
- setPagePaper    : ページの用紙・向きを変更
- setPageScale    : ページのスケールを変更
- setProjectName  : プロジェクト名を変更
- addPage         : 新規ページを追加

shape/dimension オブジェクトは必ず id フィールドを含めること（例: "rect-001"）。

配置（placement）: 追加した図形バッチは既定で自動配置される（auto）。
- auto   : ページが空なら用紙中央へ。既存図形と重なる・遠く離れている場合は空きスペースへ再配置。
           バッチ全体が既存図形の内側に完全に収まる（穴あけ・ブーリアン用の重ね）、
           または既存図形から 20mm 以内に隣接する（接続線・注記）場合は動かさない。
- center : 常に用紙中央へ。
- none   : 座標をそのまま使う。厳密な絶対座標配置をしたいときに指定する。
新しい部品を描くときは座標を原点 (0,0) 起点で相対的に書けばよい（自動配置が用紙上の位置を決める）。`,
  {
    placement: z
      .enum(["auto", "center", "none"])
      .optional()
      .describe(
        "追加図形の自動配置。auto=空なら中央/重なれば回避（既定）, center=常に中央, none=座標そのまま",
      ),
    commands: z
      .array(
        z.object({
          action: z
            .enum([
              "addShape",
              "updateShape",
              "deleteShape",
              "addDimension",
              "updateDimension",
              "addConstraint",
              "removeConstraint",
              "applyConstraints",
              "selectShapes",
              "setPagePaper",
              "setPageScale",
              "setProjectName",
              "addPage",
            ])
            .describe("実行するアクション"),
          shape: z.any().optional().describe("addShape 用シェイプオブジェクト"),
          dimension: z
            .any()
            .optional()
            .describe(
              "addDimension 用寸法オブジェクト。{ id, type:'dimension', from:{x,y}, to:{x,y}, offset, ... }",
            ),
          id: z
            .string()
            .optional()
            .describe("updateShape / deleteShape / updateDimension 用 ID"),
          values: z
            .any()
            .optional()
            .describe("updateShape / updateDimension 用更新値"),
          ids: z
            .array(z.string())
            .optional()
            .describe("selectShapes 用 ID 配列"),
          constraint: z
            .any()
            .optional()
            .describe(
              "addConstraint 用拘束オブジェクト { type, shapeIds, params? }",
            ),
          paper: z
            .string()
            .optional()
            .describe("setPagePaper: 'A4'|'A3'|'A2'|'A1'"),
          orientation: z
            .string()
            .optional()
            .describe("setPagePaper: 'landscape'|'portrait'"),
          scale: z
            .any()
            .optional()
            .describe("setPageScale: {numerator, denominator}"),
          name: z
            .string()
            .optional()
            .describe("setProjectName 用プロジェクト名"),
        }),
      )
      .describe("実行するコマンドの配列"),
  },
  async ({ commands, placement }) => {
    try {
      // 各アクションを内部形式に正規化
      const normalized = commands.map((cmd) => {
        const n = normalizeCommand(cmd);
        if (n.action === "addDimension" && n.dimension) {
          // dimension オブジェクトに type: "dimension" を強制付与
          return {
            ...n,
            action: "addShape",
            shape: {
              type: "dimension",
              ...parseJsonField(n.dimension, "dimension"),
            },
          };
        }
        if (n.action === "updateDimension") {
          return { ...n, action: "updateShape" };
        }
        if (n.action === "addConstraint" && n.constraint) {
          return {
            ...n,
            constraint: parseJsonField(n.constraint, "constraint"),
          };
        }
        return n;
      });
      const result = await call("applyCommands", {
        commands: normalized,
        placement,
      });
      return {
        content: [
          {
            type: "text",
            text: result.ok
              ? `✓ ${commands.length} 件実行しました`
              : `エラー: ${result.error}`,
          },
        ],
      };
    } catch (error) {
      return { content: [{ type: "text", text: `エラー: ${error.message}` }] };
    }
  },
);

// clear_canvas
server.tool(
  "clear_canvas",
  "現在のページのシェイプをすべて削除してキャンバスをクリアする。",
  {},
  async () => {
    await call("clearCanvas");
    return { content: [{ type: "text", text: "キャンバスをクリアしました" }] };
  },
);

// get_svg
server.tool(
  "get_svg",
  "現在のページを SVG 文字列として取得する。確認・参照用途に使う。",
  {},
  async () => {
    const result = await call("getSvg");
    return { content: [{ type: "text", text: result.svg }] };
  },
);

// align_shapes
server.tool(
  "align_shapes",
  "選択中のシェイプを整列する。1個選択時はページ基準、複数選択時は選択範囲基準。",
  {
    direction: z
      .enum(["left", "centerH", "right", "top", "centerV", "bottom"])
      .describe("整列方向: left/centerH/right/top/centerV/bottom"),
  },
  async ({ direction }) => {
    await call("alignShapes", { direction });
    return { content: [{ type: "text", text: `整列しました: ${direction}` }] };
  },
);

// distribute_shapes
server.tool(
  "distribute_shapes",
  "選択中のシェイプを均等分布する（3個以上必要）。",
  {
    axis: z.enum(["h", "v"]).describe("h = 水平, v = 垂直"),
  },
  async ({ axis }) => {
    await call("distributeShapes", { axis });
    return {
      content: [
        {
          type: "text",
          text: `均等分布しました: ${axis === "h" ? "水平" : "垂直"}`,
        },
      ],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
