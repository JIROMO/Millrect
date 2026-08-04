// registry.ts — registers all portable Millrect MCP tools on an McpServer instance for the
// Cloudflare Workers side. Tool names/descriptions/action-names come from the shared data module
// (../../../shared/mcp-tool-defs.js); the zod parameter shapes are written here by hand because
// @modelcontextprotocol/server (this package) depends on zod v4 while mcp/server.js (the Electron
// stdio server) is on zod v3 — see shared/mcp-tool-defs.js header for the rationale.
//
// Every tool here uses uniform JSON-stringified output (unlike mcp/server.js, which has some
// hand-formatted human-readable text per tool). That's a deliberate simplification for this first
// pass — richer formatting can be layered on later without touching the shared defs.

// @ts-check is intentionally not used here: this is a plain JS data file imported across a
// package boundary (worker/ importing from ../shared/). Typed as `any[]` below rather than
// spending time getting cross-project JS/TS interop perfectly typed for a static data module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { MCP_TOOL_DEFS } from "../../../shared/mcp-tool-defs.js";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

type ToolDef = { name: string; description: string; action: string };
const TOOL_DEFS = MCP_TOOL_DEFS as ToolDef[];

const dimensionPointMmSchema = z.object({
  x_mm: z.number().describe("X座標 mm"),
  y_mm: z.number().describe("Y座標 mm"),
});

const dimensionMmSchema = z.object({
  id: z.string().optional().describe("省略時は自動採番"),
  dimension_type: z.enum(["horizontal", "vertical"]),
  from: dimensionPointMmSchema,
  to: dimensionPointMmSchema,
  offset_mm: z.number().optional().describe("寸法線オフセット mm（既定 -8）"),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().int().min(0).max(6).optional(),
  text_size_mm: z
    .number()
    .min(1)
    .max(6)
    .optional()
    .describe("紙面上の文字サイズ mm（既定・推奨 3）"),
  line_width_mm: z
    .number()
    .positive()
    .max(2)
    .optional()
    .describe("紙面上の線幅 mm（既定 0.25）"),
  color: z.string().optional(),
  arrow_style: z.enum(["dot", "arrow", "slash", "open"]).optional(),
  label_bg: z.boolean().optional().describe("文字背面を白抜き（既定true）"),
});

const lowLevelDimensionSchema = z
  .object({
    id: z.string(),
    type: z.literal("dimension").optional(),
    dimensionType: z.enum(["horizontal", "vertical"]),
    from: z
      .object({ x: z.number(), y: z.number() })
      .describe("内部real units（1mm=10）"),
    to: z
      .object({ x: z.number(), y: z.number() })
      .describe("内部real units（1mm=10）"),
    offset: z.number().optional().describe("内部real units（1mm=10）"),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().min(0).max(6).optional(),
    textSize: z
      .number()
      .min(1)
      .max(6)
      .optional()
      .describe("紙面上のmm。既定・推奨3。pxではない"),
    lineWidth: z
      .number()
      .positive()
      .max(2)
      .optional()
      .describe("紙面上のmm。既定0.25"),
    color: z.string().optional(),
    arrowStyle: z.enum(["dot", "arrow", "slash", "open"]).optional(),
  })
  .passthrough();

function defOf(name: string): ToolDef {
  const found = TOOL_DEFS.find((d) => d.name === name);
  if (!found) {
    throw new Error(`registry.ts: no shared def found for tool "${name}" (check shared/mcp-tool-defs.js)`);
  }
  return found;
}

// Per-tool zod parameter shapes, mirroring mcp/server.js's server.tool() calls one-for-one.
// Keys must match every non-excluded tool name in shared/mcp-tool-defs.js.
const PARAM_SHAPES: Record<string, z.ZodRawShape> = {
  get_project_context: {},
  get_state: {},
  undo: {},
  redo: {},
  set_selected_shapes: {
    ids: z.array(z.string()).describe("選択する shape ID の配列"),
  },
  group_shapes: {},
  ungroup_shapes: {},
  boolean_subtract: {},
  boolean_union: {},
  boolean_intersect: {},
  boolean_exclude: {},
  boolean_flatten: {},
  add_constraint: {
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
  remove_constraint: {
    id: z.string().describe("削除する拘束の ID"),
  },
  get_constraints: {},
  update_3d_scene: {},
  get_3d_scene_status: {},
  validate_3d_readiness: {},
  create_multiview_box: {
    project_name: z.string().optional().describe("プロジェクト名"),
    width_mm: z.number().optional().describe("幅 mm（デフォルト 120）"),
    depth_mm: z.number().optional().describe("奥行 mm（デフォルト 80）"),
    height_mm: z.number().optional().describe("高さ mm（デフォルト 50）"),
    views: z
      .array(z.enum(["top", "front", "right", "left"]))
      .optional()
      .describe('生成ビュー（デフォルト ["top","front"]）'),
    add_dimensions: z.boolean().optional().describe("各ビューに外周寸法線を追加"),
    update_3d: z.boolean().optional().describe("生成後に 3D を再生成（デフォルト true）"),
  },
  create_part: {
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
  layout_rect_mm: {
    width_mm: z.number().describe("幅 mm"),
    height_mm: z.number().describe("高さ mm"),
    add_dimensions: z.boolean().optional().describe("外周寸法線を追加"),
    fill: z.string().optional().describe("塗り色（例: #8fb7ff）"),
    stroke: z.string().optional().describe("線色"),
  },
  add_dimensions: {
    dimensions: z
      .array(dimensionMmSchema)
      .min(1)
      .describe("追加する寸法線。全座標・offsetはmm"),
  },
  list_docs_scenarios: {},
  run_docs_scenario: {
    scenario: z.string().describe("シナリオ ID（list_docs_scenarios で確認）"),
    locale: z.enum(["ja", "en"]).optional().describe("UI 言語"),
    update_3d: z.boolean().optional().describe("3D 再生成"),
  },
  set_reference_scale_anchor: {
    from_x: z.number().describe("起点 X（real units）"),
    from_y: z.number().describe("起点 Y"),
    to_x: z.number().describe("終点 X"),
    to_y: z.number().describe("終点 Y"),
    length_mm: z.number().describe("2 点間の実長 mm"),
    page_id: z.string().optional(),
  },
  digitize_sketch: {
    proposals: z
      .array(
        z.object({
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
        }),
      )
      .describe("rect / circle / line の mm 座標提案"),
    page_id: z.string().optional(),
    layer_id: z.string().optional(),
    clear_existing: z.boolean().optional().describe("既存ゴーストを削除してから配置（デフォルト true）"),
    confirm: z.boolean().optional().describe("配置後に ghost フラグを解除して確定"),
  },
  confirm_digitize_proposals: {
    page_id: z.string().optional(),
    shape_ids: z.array(z.string()).optional(),
  },
  compile_part_dsl: {
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
  apply_part_dsl: {
    dsl: z.object({}).passthrough().describe("Part DSL v1"),
    project_name: z.string().optional(),
    update_3d: z.boolean().optional(),
  },
  update_part_param: {
    param: z.string().describe("W/D/H（box）, W/H（panel）, A/B/T/H（l_bracket）等"),
    value_mm: z.number().describe("新しい値 mm"),
    project_name: z.string().optional(),
  },
  validate_manufacturability: {
    dsl: z.object({}).passthrough().describe("Part DSL v1"),
  },
  apply_commands: {
    placement: z
      .enum(["auto", "center", "none"])
      .optional()
      .describe("追加図形の自動配置。auto=空なら中央/重なれば回避（既定）, center=常に中央, none=座標そのまま"),
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
            .union([lowLevelDimensionSchema, z.string()])
            .optional()
            .describe(
              "addDimension用。座標/offsetは内部real units（1mm=10）。textSizeは紙面mm（1〜6、推奨3）。通常はadd_dimensionsを使用",
            ),
          id: z.string().optional().describe("updateShape / deleteShape / updateDimension 用 ID"),
          values: z.any().optional().describe("updateShape / updateDimension 用更新値"),
          ids: z.array(z.string()).optional().describe("selectShapes 用 ID 配列"),
          constraint: z.any().optional().describe("addConstraint 用拘束オブジェクト { type, shapeIds, params? }"),
          paper: z.string().optional().describe("setPagePaper: 'A4'|'A3'|'A2'|'A1'"),
          orientation: z.string().optional().describe("setPagePaper: 'landscape'|'portrait'"),
          scale: z.any().optional().describe("setPageScale: {numerator, denominator}"),
          name: z.string().optional().describe("setProjectName 用プロジェクト名"),
        }),
      )
      .describe("実行するコマンドの配列"),
  },
  clear_canvas: {},
  get_svg: {},
  align_shapes: {
    direction: z
      .enum(["left", "centerH", "right", "top", "centerV", "bottom"])
      .describe("整列方向: left/centerH/right/top/centerV/bottom"),
  },
  distribute_shapes: {
    axis: z.enum(["h", "v"]).describe("h = 水平, v = 垂直"),
  },
};

export type CallBrowser = (action: string, params?: Record<string, unknown>) => Promise<unknown>;

/**
 * Registers every tool in shared/mcp-tool-defs.js onto `server`, wiring each handler to call
 * `callBrowser(def.action, params)` and returning uniform JSON text content.
 */
function toBrowserParams(name: string, params: Record<string, unknown>): Record<string, unknown> {
  switch (name) {
    case "add_constraint": {
      const { type, shapeIds, params: constraintParams } = params;
      return {
        constraint: {
          type,
          shapeIds,
          ...(constraintParams === undefined ? {} : { params: constraintParams }),
        },
      };
    }
    case "create_multiview_box":
      return {
        options: {
          projectName: params.project_name,
          sizeMm: {
            width: params.width_mm ?? 120,
            depth: params.depth_mm ?? 80,
            height: params.height_mm ?? 50,
          },
          views: params.views ?? ["top", "front"],
          addDimensions: params.add_dimensions ?? false,
          update3d: params.update_3d ?? true,
        },
      };
    case "create_part":
      return {
        options: {
          kind: params.kind ?? "box",
          projectName: params.project_name,
          sizeMm: {
            width: params.width_mm ?? 120,
            depth: params.depth_mm ?? 80,
            height: params.height_mm ?? 50,
          },
          views: params.views ?? ["top", "front", "right"],
          features: params.features ?? [],
          addDimensions: params.add_dimensions ?? false,
          update3d: params.update_3d ?? true,
        },
      };
    case "layout_rect_mm":
      return {
        mmW: params.width_mm,
        mmH: params.height_mm,
        style: {
          addDimensions: params.add_dimensions ?? false,
          ...(params.fill ? { fill: params.fill } : {}),
          ...(params.stroke ? { stroke: params.stroke } : {}),
        },
      };
    case "add_dimensions":
      return { specs: params.dimensions };
    case "run_docs_scenario":
      return {
        scenarioId: params.scenario,
        options: { locale: params.locale, update3d: params.update_3d },
      };
    case "set_reference_scale_anchor":
      return {
        pageId: params.page_id ?? null,
        from: { x: params.from_x, y: params.from_y },
        to: { x: params.to_x, y: params.to_y },
        lengthMm: params.length_mm,
      };
    case "digitize_sketch":
      return {
        pageId: params.page_id ?? null,
        proposals: params.proposals,
        opts: {
          layerId: params.layer_id ?? null,
          clearExisting: params.clear_existing !== false,
        },
      };
    case "confirm_digitize_proposals":
      return { pageId: params.page_id ?? null, shapeIds: params.shape_ids ?? null };
    case "apply_part_dsl":
      return {
        dsl: params.dsl,
        runtimeOpts: {
          projectName: params.project_name,
          update3d: params.update_3d ?? true,
        },
      };
    case "update_part_param":
      return {
        param: params.param,
        valueMm: params.value_mm,
        runtimeOpts: { projectName: params.project_name },
      };
    case "apply_commands":
      return {
        commands: params.commands,
        options: { placement: params.placement ?? "auto" },
      };
    default:
      return params;
  }
}

export function registerAllTools(server: McpServer, callBrowser: CallBrowser): void {
  for (const def of TOOL_DEFS) {
    const shape = PARAM_SHAPES[def.name];
    if (!shape) {
      throw new Error(`registry.ts: no zod shape defined for tool "${def.name}"`);
    }
    server.registerTool(
      def.name,
      { description: def.description, inputSchema: z.object(shape) },
      async (params: Record<string, unknown>) => {
        try {
          const browserParams = toBrowserParams(def.name, params ?? {});
          const result = await callBrowser(def.action, browserParams);

          if (def.name === "digitize_sketch" && params.confirm && isOkResult(result)) {
            const confirm = await callBrowser("confirmDigitizeProposals", {
              pageId: params.page_id ?? null,
              shapeIds: result.shapeIds ?? null,
            });
            return jsonToolResult({ apply: result, confirm });
          }

          return jsonToolResult(result);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: error instanceof Error ? error.message : String(error),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}

function isOkResult(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (!("ok" in value) || value.ok !== false)
  );
}

function jsonToolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

// Sanity check at module load: every def must have a shape and vice versa isn't required
// (PARAM_SHAPES may include tools not present if defs change), but catch the common drift.
for (const def of TOOL_DEFS) {
  if (!(def.name in PARAM_SHAPES)) {
    throw new Error(`registry.ts: PARAM_SHAPES is missing an entry for "${def.name}"`);
  }
}

void defOf; // keep helper referenced; useful for future per-tool overrides
