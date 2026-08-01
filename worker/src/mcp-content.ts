import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export type ReadPublishedText = (path: string) => Promise<string>;

const WORKFLOW = `# Millrect MCP 操作チェックリスト

1. Resource \`millrect://docs/agent-manual\` を読む
2. \`get_project_context\` → \`validate_3d_readiness\` で現状を確認
3. \`apply_part_dsl\` / \`create_multiview_box\` / \`layout_rect_mm\` を優先
4. 細部編集は \`apply_commands\` でまとめて適用
5. \`get_svg\` で結果を確認
6. 3D が必要なら \`update_3d_scene\` → \`get_3d_scene_status\`

2D 図面が唯一の正であり、3D は正投影図から再生成する。`;

const OPERATE_DRAWING_PROMPT = `Millrect の図面を操作してください。

手順:
1. Resource \`millrect://docs/agent-manual\` を読む
2. \`get_project_context\` → \`validate_3d_readiness\` で現状確認
3. Intent API（\`apply_part_dsl\` / \`create_multiview_box\` / \`layout_rect_mm\`）を優先
4. 細部編集は \`apply_commands\` を使う
5. \`get_svg\` で結果確認
6. 必要なら \`update_3d_scene\` → \`get_3d_scene_status\`

禁止: feature.depth による押し出し、dimension を layer.shapes に混ぜること。`;

export function registerResourcesAndPrompts(
  server: McpServer,
  readPublishedText: ReadPublishedText,
): void {
  server.registerResource(
    "agent-manual",
    "millrect://docs/agent-manual",
    {
      title: "Millrect AI Agent Manual",
      description: "図面操作のスキーマ・API・禁止事項。操作前に必ず読むこと。",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: await readPublishedText("/AGENT.md") }],
    }),
  );

  server.registerResource(
    "workflow",
    "millrect://docs/workflow",
    {
      title: "Millrect MCP Workflow",
      description: "図面操作の標準手順チェックリスト。",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, text: WORKFLOW }] }),
  );

  server.registerResource(
    "mcp-reference",
    "millrect://docs/mcp-reference",
    {
      title: "Millrect MCP Tool Reference",
      description: "MCPツール一覧と apply_commands アクション。",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await readPublishedText("/docs/MCP-REFERENCE.md"),
        },
      ],
    }),
  );

  server.registerPrompt(
    "operate_drawing",
    {
      title: "Millrect 図面操作",
      description: "2D図面の確認・追加・編集を標準ワークフローで行う。",
    },
    () => ({
      messages: [
        { role: "user", content: { type: "text", text: OPERATE_DRAWING_PROMPT } },
      ],
    }),
  );

  server.registerPrompt(
    "create_3d_model",
    {
      title: "Millrect 多ビュー 3D 生成",
      description: "複数の正投影ページからCSG交差で立体を生成する。",
      argsSchema: z.object({
        views: z.string().optional().describe("必要なビュー（例: top+front）"),
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

Resource \`millrect://docs/agent-manual\` を確認し、\`get_project_context\`、
\`validate_3d_readiness\`、図面操作、\`update_3d_scene\`、
\`get_3d_scene_status\` の順で進めてください。feature.depth は使いません。`,
          },
        },
      ],
    }),
  );
}
