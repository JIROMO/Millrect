"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadWebMcp() {
  const source = fs.readFileSync(
    path.join(__dirname, "../../app/js/webmcp.js"),
    "utf8",
  );
  const context = { AbortController };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "webmcp.js" });
  return context.MillrectWebMcp;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("WebMCP registers the intentionally limited public tool set", async () => {
  const definitions = [];
  const modelContext = {
    async registerTool(definition) {
      definitions.push(definition);
    },
  };
  const WebMcp = loadWebMcp();

  const result = await WebMcp.register(async () => ({ ok: true }), {
    document: { modelContext },
    window: { addEventListener() {} },
  });

  assert.equal(result.supported, true);
  assert.deepEqual(Array.from(result.registered), [
    "get_project_context",
    "get_state",
    "validate_3d_readiness",
    "get_svg",
    "create_part",
    "update_part_param",
    "undo",
    "redo",
  ]);
  assert.equal(definitions.length, 8);
  assert.equal(definitions.some((item) => item.name === "clear_canvas"), false);
  assert.equal(definitions.some((item) => item.name === "apply_commands"), false);
  assert.equal(
    definitions.find((item) => item.name === "get_state").annotations
      .readOnlyHint,
    true,
  );
});

test("WebMCP create_part maps public millimeter inputs to the browser action", async () => {
  const calls = [];
  const WebMcp = loadWebMcp();
  const createPart = WebMcp.createTools(async (action, params) => {
    calls.push({ action, params });
    return { ok: true, pageCount: 3 };
  }).find((item) => item.name === "create_part");

  const output = JSON.parse(
    await createPart.execute({
      project_name: "Bracket",
      width_mm: 80,
      depth_mm: 40,
      height_mm: 12,
      views: ["top", "front"],
      add_dimensions: true,
      update_3d: false,
    }),
  );

  assert.deepEqual(output, { ok: true, pageCount: 3 });
  assert.deepEqual(plain(calls), [
    {
      action: "createPart",
      params: {
        options: {
          kind: "box",
          projectName: "Bracket",
          sizeMm: { width: 80, depth: 40, height: 12 },
          views: ["top", "front"],
          features: [],
          addDimensions: true,
          update3d: false,
        },
      },
    },
  ]);
});

test("WebMCP update_part_param maps value_mm to the existing action contract", async () => {
  const calls = [];
  const WebMcp = loadWebMcp();
  const updateParam = WebMcp.createTools(async (action, params) => {
    calls.push({ action, params });
    return { ok: true };
  }).find((item) => item.name === "update_part_param");

  await updateParam.execute({ param: "W", value_mm: 95 });

  assert.deepEqual(plain(calls), [
    {
      action: "updatePartParam",
      params: {
        param: "W",
        valueMm: 95,
        runtimeOpts: {},
      },
    },
  ]);
});

test("WebMCP is a no-op in browsers without document.modelContext", async () => {
  const WebMcp = loadWebMcp();
  const result = await WebMcp.register(async () => null, {
    document: {},
  });

  assert.deepEqual(plain(result), {
    supported: false,
    registered: [],
    failed: [],
  });
});

test("WebMCP keeps registering other tools when one definition is rejected", async () => {
  const WebMcp = loadWebMcp();
  const modelContext = {
    async registerTool(definition) {
      if (definition.name === "get_state") {
        throw new Error("schema rejected");
      }
    },
  };

  const result = await WebMcp.register(async () => null, {
    document: { modelContext },
    window: { addEventListener() {} },
  });

  assert.equal(result.registered.length, 7);
  assert.deepEqual(plain(result.failed), [
    { name: "get_state", error: "schema rejected" },
  ]);
});
