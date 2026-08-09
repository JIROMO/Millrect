"use strict";

// WebMCP progressive enhancement.
//
// This adapter intentionally exposes only a small, reviewable subset of the
// existing MCP bridge. Chrome versions without document.modelContext simply
// skip registration, while the remote /mcp transport continues to work.
globalThis.MillrectWebMcp = (() => {
  const EMPTY_SCHEMA = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  function jsonResult(value) {
    return JSON.stringify(value ?? null, null, 2);
  }

  function tool({
    name,
    description,
    inputSchema = EMPTY_SCHEMA,
    action,
    mapInput = (input) => input ?? {},
    readOnly = false,
  }) {
    return {
      name,
      description,
      inputSchema,
      annotations: {
        readOnlyHint: readOnly,
        untrustedContentHint: readOnly,
      },
      async execute(input = {}) {
        return jsonResult(await action(mapInput(input)));
      },
    };
  }

  function createTools(dispatch) {
    if (typeof dispatch !== "function") {
      throw new TypeError("WebMCP dispatch must be a function");
    }

    const call = (action) => (params) => dispatch(action, params);
    const positiveMm = {
      type: "number",
      exclusiveMinimum: 0,
      description: "Millimeters",
    };
    const viewNames = ["top", "front", "right", "left"];

    return [
      tool({
        name: "get_project_context",
        description:
          "Inspect the active Millrect project before editing it. Returns whether it is blank, page counts, shape counts, and the current view.",
        action: call("getProjectContext"),
        readOnly: true,
      }),
      tool({
        name: "get_state",
        description:
          "Read the current Millrect page, shapes, dimensions, profiles, scale, and selection. Call this before changing an existing drawing.",
        action: call("getState"),
        readOnly: true,
      }),
      tool({
        name: "validate_3d_readiness",
        description:
          "Check whether the current orthographic views and closed profiles are ready to generate a 3D model. Does not modify the project.",
        action: call("validate3DReadiness"),
        readOnly: true,
      }),
      tool({
        name: "get_svg",
        description:
          "Return the current Millrect page as an SVG string for inspection. Does not modify the project.",
        action: call("getSvg"),
        readOnly: true,
      }),
      tool({
        name: "create_part",
        description:
          "Create a parametric box part in Millrect from millimeter dimensions and orthographic views. The change is visible in the open tab and can be undone.",
        inputSchema: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["box"], default: "box" },
            project_name: { type: "string" },
            width_mm: positiveMm,
            depth_mm: positiveMm,
            height_mm: positiveMm,
            views: {
              type: "array",
              items: { type: "string", enum: viewNames },
              uniqueItems: true,
            },
            features: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["hole_grid"] },
                  view: {
                    type: "string",
                    enum: [...viewNames, "bottom", "back"],
                  },
                  diameter_mm: positiveMm,
                  inset_mm: { type: "number", minimum: 0 },
                  count: {
                    type: "array",
                    items: { type: "integer", minimum: 1 },
                    minItems: 2,
                    maxItems: 2,
                  },
                },
                required: ["type"],
                additionalProperties: false,
              },
            },
            add_dimensions: { type: "boolean", default: false },
            update_3d: { type: "boolean", default: true },
          },
          additionalProperties: false,
        },
        action: call("createPart"),
        mapInput: (input) => ({
          options: {
            kind: input.kind ?? "box",
            projectName: input.project_name,
            sizeMm: {
              width: input.width_mm ?? 120,
              depth: input.depth_mm ?? 80,
              height: input.height_mm ?? 50,
            },
            views: input.views ?? ["top", "front", "right"],
            features: input.features ?? [],
            addDimensions: input.add_dimensions ?? false,
            update3d: input.update_3d ?? true,
          },
        }),
      }),
      tool({
        name: "update_part_param",
        description:
          "Update one parameter of the current parametric part in millimeters. Typical box parameters are W, D, and H. The change can be undone.",
        inputSchema: {
          type: "object",
          properties: {
            param: {
              type: "string",
              description: "Parameter name, for example W, D, or H for a box",
            },
            value_mm: positiveMm,
            project_name: { type: "string" },
          },
          required: ["param", "value_mm"],
          additionalProperties: false,
        },
        action: call("updatePartParam"),
        mapInput: (input) => ({
          param: input.param,
          valueMm: input.value_mm,
          runtimeOpts: { projectName: input.project_name },
        }),
      }),
      tool({
        name: "undo",
        description:
          "Undo the last Millrect project operation. Returns whether an operation was undone and the remaining history availability.",
        action: call("undo"),
      }),
      tool({
        name: "redo",
        description:
          "Redo the last undone Millrect project operation. Returns whether an operation was redone and the remaining history availability.",
        action: call("redo"),
      }),
    ];
  }

  async function register(dispatch, options = {}) {
    const targetDocument =
      options.document ??
      (typeof document === "undefined" ? null : document);
    const modelContext = targetDocument?.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      return { supported: false, registered: [], failed: [] };
    }

    const controller = options.controller ?? new AbortController();
    const registered = [];
    const failed = [];

    for (const definition of createTools(dispatch)) {
      try {
        await modelContext.registerTool(definition, {
          signal: controller.signal,
        });
        registered.push(definition.name);
      } catch (error) {
        failed.push({
          name: definition.name,
          error: String(error?.message ?? error),
        });
      }
    }

    const targetWindow =
      options.window ?? (typeof window === "undefined" ? null : window);
    targetWindow?.addEventListener?.("pagehide", () => controller.abort(), {
      once: true,
    });

    return { supported: true, registered, failed, controller };
  }

  return { createTools, register };
})();
