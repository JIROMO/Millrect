"use strict";

/**
 * Part DSL v1 — 宣言的 Part 定義（Solver + DSL）
 * Tier 3: panel, l_bracket, enclosure + slot, fillet, pattern_linear
 */

const PART_DSL_VERSION = 1;
const DEFAULT_BOX_PARAMS = { W: 120, D: 80, H: 50 };
const DEFAULT_PANEL_PARAMS = { W: 200, H: 150 };
const DEFAULT_L_BRACKET_PARAMS = { A: 80, B: 60, T: 5, H: 40 };
const DEFAULT_ENCLOSURE_PARAMS = { W: 120, D: 80, H: 50, T: 3 };

const SUPPORTED_PARTS = new Set(["box", "panel", "l_bracket", "enclosure"]);
const SUPPORTED_FEATURES = new Set([
  "hole_grid",
  "slot",
  "fillet",
  "pattern_linear",
]);

let _normalizeManufacturing;
let _validateManufacturingRules;
if (typeof require !== "undefined") {
  try {
    const mfg = require("./manufacturing-rules");
    _normalizeManufacturing = mfg.normalizeManufacturing;
    _validateManufacturingRules = mfg.validateManufacturingRules;
  } catch {
    /* browser loads manufacturing-rules.js separately */
  }
}

function _num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function legacyOptionsToPartDsl(options = {}) {
  const size = options.sizeMm ?? options.params ?? {};
  const part = options.kind ?? options.part ?? "box";
  const params = { ...size };
  if (size.width != null) params.W = size.width;
  if (size.depth != null) params.D = size.depth;
  if (size.height != null) params.H = size.height;
  return {
    version: PART_DSL_VERSION,
    part,
    params,
    views: options.views,
    features: options.features ?? [],
    constraints: options.constraints ?? [],
    manufacturing: options.manufacturing,
    meta: options.meta ?? {},
  };
}

function normalizePanelParams(params = {}) {
  return {
    W: _num(params.W ?? params.width ?? params.w, DEFAULT_PANEL_PARAMS.W),
    H: _num(
      params.H ?? params.height ?? params.h ?? params.D ?? params.depth,
      DEFAULT_PANEL_PARAMS.H,
    ),
  };
}

function normalizeLBracketParams(params = {}) {
  return {
    A: _num(params.A ?? params.a ?? params.leg_a, DEFAULT_L_BRACKET_PARAMS.A),
    B: _num(params.B ?? params.b ?? params.leg_b, DEFAULT_L_BRACKET_PARAMS.B),
    T: _num(
      params.T ?? params.t ?? params.thickness,
      DEFAULT_L_BRACKET_PARAMS.T,
    ),
    H: _num(params.H ?? params.h ?? params.height, DEFAULT_L_BRACKET_PARAMS.H),
  };
}

function normalizeBoxParams(params = {}) {
  return {
    W: _num(params.W ?? params.width ?? params.w, DEFAULT_BOX_PARAMS.W),
    D: _num(params.D ?? params.depth ?? params.d, DEFAULT_BOX_PARAMS.D),
    H: _num(params.H ?? params.height ?? params.h, DEFAULT_BOX_PARAMS.H),
  };
}

function normalizeEnclosureParams(params = {}) {
  const box = normalizeBoxParams(params);
  return {
    ...box,
    T: _num(
      params.T ?? params.t ?? params.thickness,
      DEFAULT_ENCLOSURE_PARAMS.T,
    ),
  };
}

function normalizePartParams(part, params = {}) {
  switch (part) {
    case "panel":
      return normalizePanelParams(params);
    case "l_bracket":
      return normalizeLBracketParams(params);
    case "enclosure":
      return normalizeEnclosureParams(params);
    case "box":
    default:
      return normalizeBoxParams(params);
  }
}

function normalizeFeature(feature) {
  if (!feature || typeof feature !== "object") {
    return { ok: false, error: "Feature must be an object" };
  }
  const type = feature.type;
  if (!SUPPORTED_FEATURES.has(type)) {
    return { ok: false, error: `Unsupported feature type: ${type}` };
  }

  if (type === "hole_grid") {
    const count = feature.count ?? [2, 2];
    return {
      ok: true,
      feature: {
        type: "hole_grid",
        view: feature.view ?? "top",
        diameter_mm: _num(feature.diameter_mm ?? feature.diameterMm, 3),
        inset_mm: _num(feature.inset_mm ?? feature.insetMm, 5),
        count: [Math.max(1, count[0] | 0), Math.max(1, count[1] | 0)],
      },
    };
  }

  if (type === "slot") {
    return {
      ok: true,
      feature: {
        type: "slot",
        view: feature.view ?? "top",
        width_mm: _num(feature.width_mm ?? feature.widthMm, 10),
        height_mm: _num(feature.height_mm ?? feature.heightMm, 4),
        x_mm: _num(feature.x_mm ?? feature.xMm, 20),
        y_mm: _num(feature.y_mm ?? feature.yMm, 20),
      },
    };
  }

  if (type === "fillet") {
    return {
      ok: true,
      feature: {
        type: "fillet",
        view: feature.view ?? "top",
        radius_mm: _num(feature.radius_mm ?? feature.radiusMm, 3),
      },
    };
  }

  if (type === "pattern_linear") {
    const start = feature.start_mm ?? feature.startMm ?? { x: 10, y: 10 };
    return {
      ok: true,
      feature: {
        type: "pattern_linear",
        view: feature.view ?? "top",
        count: Math.max(1, feature.count | 0 || 3),
        pitch_mm: _num(feature.pitch_mm ?? feature.pitchMm, 20),
        diameter_mm: _num(feature.diameter_mm ?? feature.diameterMm, 3),
        axis: feature.axis === "y" ? "y" : "x",
        start_mm: { x: _num(start.x, 10), y: _num(start.y, 10) },
      },
    };
  }

  return { ok: false, error: `Unknown feature: ${type}` };
}

function defaultViewsForPart(part) {
  switch (part) {
    case "panel":
      return ["top"];
    case "l_bracket":
      return ["top", "front"];
    case "enclosure":
      return ["top", "front", "right"];
    case "box":
    default:
      return ["top", "front"];
  }
}

function normalizePartDsl(raw = {}) {
  const part = raw.part ?? raw.kind ?? "box";
  if (!SUPPORTED_PARTS.has(part)) {
    return { ok: false, error: `Unsupported part: ${part}` };
  }

  const params = normalizePartParams(part, raw.params);
  const views = Array.isArray(raw.views)
    ? raw.views
    : defaultViewsForPart(part);

  const features = [];
  for (const f of raw.features ?? []) {
    const norm = normalizeFeature(f);
    if (!norm.ok) return norm;
    features.push(norm.feature);
  }

  const manufacturing = (_normalizeManufacturing ?? normalizeManufacturing)(
    raw.manufacturing ?? raw.meta?.manufacturing,
  );

  return {
    ok: true,
    dsl: {
      version: PART_DSL_VERSION,
      part,
      params,
      views,
      features,
      constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
      manufacturing,
      meta: raw.meta && typeof raw.meta === "object" ? raw.meta : {},
    },
  };
}

function _compileBoxParamConstraints(params) {
  return [
    {
      id: "dsl-param-W",
      kind: "param_bind",
      param: "W",
      value: params.W,
      binds: [
        { view: "top", axis: "width", mm: params.W },
        { view: "front", axis: "width", mm: params.W },
      ],
    },
    {
      id: "dsl-param-D",
      kind: "param_bind",
      param: "D",
      value: params.D,
      binds: [
        { view: "top", axis: "depth", mm: params.D },
        { view: "right", axis: "width", mm: params.D },
      ],
    },
    {
      id: "dsl-param-H",
      kind: "param_bind",
      param: "H",
      value: params.H,
      binds: [
        { view: "front", axis: "height", mm: params.H },
        { view: "right", axis: "height", mm: params.H },
      ],
    },
  ];
}

function _compilePanelParamConstraints(params) {
  return [
    {
      id: "dsl-param-W",
      kind: "param_bind",
      param: "W",
      value: params.W,
      binds: [{ view: "top", axis: "width", mm: params.W }],
    },
    {
      id: "dsl-param-H",
      kind: "param_bind",
      param: "H",
      value: params.H,
      binds: [{ view: "top", axis: "height", mm: params.H }],
    },
  ];
}

function _compileLBracketParamConstraints(params) {
  return [
    {
      id: "dsl-param-A",
      kind: "param_bind",
      param: "A",
      value: params.A,
      binds: [{ view: "front", axis: "width", mm: params.A }],
    },
    {
      id: "dsl-param-H",
      kind: "param_bind",
      param: "H",
      value: params.H,
      binds: [{ view: "front", axis: "height", mm: params.H }],
    },
  ];
}

function _compileParamConstraints(part, params) {
  switch (part) {
    case "panel":
      return _compilePanelParamConstraints(params);
    case "l_bracket":
      return _compileLBracketParamConstraints(params);
    case "enclosure":
      return [
        ..._compileBoxParamConstraints(params),
        {
          id: "dsl-param-T",
          kind: "param_bind",
          param: "T",
          value: params.T,
          binds: [],
          note: "wall thickness — manufacturing metadata",
        },
      ];
    case "box":
    default:
      return _compileBoxParamConstraints(params);
  }
}

function _buildOptionsForPart(dsl) {
  const { part, params, views } = dsl;
  const includeSideView = views.includes("right") || views.includes("left");

  switch (part) {
    case "panel":
      return {
        kind: part,
        sizeMm: { width: params.W, height: params.H },
        views,
        includeSideView: false,
      };
    case "l_bracket":
      return {
        kind: part,
        sizeMm: {
          A: params.A,
          B: params.B,
          T: params.T,
          height: params.H,
        },
        views,
        includeSideView: false,
      };
    case "enclosure":
      return {
        kind: part,
        sizeMm: {
          width: params.W,
          depth: params.D,
          height: params.H,
          thickness: params.T,
        },
        views,
        includeSideView,
        wallThicknessMm: params.T,
      };
    case "box":
    default:
      return {
        kind: "box",
        sizeMm: {
          width: params.W,
          depth: params.D,
          height: params.H,
        },
        views,
        includeSideView,
      };
  }
}

function compilePartDsl(raw = {}) {
  const normalized =
    raw.version != null && (raw.part != null || raw.kind != null)
      ? normalizePartDsl(raw)
      : normalizePartDsl(legacyOptionsToPartDsl(raw));

  if (!normalized.ok) return normalized;

  const { dsl } = normalized;
  const buildOptions = _buildOptionsForPart(dsl);
  const paramConstraints = _compileParamConstraints(dsl.part, dsl.params);

  const mfg = (_validateManufacturingRules ?? validateManufacturingRules)?.(
    dsl,
  ) ?? {
    ok: true,
    violations: [],
  };

  return {
    ok: true,
    dsl,
    buildOptions,
    features: dsl.features,
    constraints: [...paramConstraints, ...dsl.constraints],
    manufacturing: dsl.manufacturing,
    manufacturingCheck: mfg,
    solver: {
      phase: "apply",
      paramSolver: "part-solver.js:applyParamBindSolver",
      geometrySolver: "constraints.js:applyConstraints",
    },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PART_DSL_VERSION,
    DEFAULT_BOX_PARAMS,
    DEFAULT_PANEL_PARAMS,
    DEFAULT_L_BRACKET_PARAMS,
    SUPPORTED_PARTS,
    SUPPORTED_FEATURES,
    legacyOptionsToPartDsl,
    normalizePartParams,
    normalizePartDsl,
    compilePartDsl,
  };
}

if (typeof window !== "undefined") {
  window.PART_DSL_VERSION = PART_DSL_VERSION;
  window.SUPPORTED_PARTS = SUPPORTED_PARTS;
  window.legacyOptionsToPartDsl = legacyOptionsToPartDsl;
  window.normalizePartDsl = normalizePartDsl;
  window.compilePartDsl = compilePartDsl;
}
