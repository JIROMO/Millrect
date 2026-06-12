"use strict";

// ── Part DSL → Millrect state（Compiler / Emitter / Solver 接続）────────

function validatePartManufacturing(compiled) {
  if (typeof validateManufacturingRules !== "function") {
    return { ok: true, violations: [] };
  }
  return validateManufacturingRules(compiled.dsl);
}

function _applyPartParamSolver(state, partIntent, compiled) {
  const solverResult = applyParamBindSolver(state, partIntent, {
    getShapeBBox: typeof getShapeBBox === "function" ? getShapeBBox : null,
  });
  if (!solverResult.ok) return solverResult;

  const appliedFeatures = _applyPartFeatures(state, partIntent.features || []);
  const featureErrors = appliedFeatures.filter((f) => f.ok === false);
  if (featureErrors.length) {
    return {
      ok: false,
      error: featureErrors.map((f) => f.error).join("; "),
      appliedFeatures,
    };
  }

  for (const page of state.pages) {
    if (page.constraints?.length && typeof applyConstraints === "function") {
      applyConstraints(page);
    }
  }

  return { ok: true, mode: "solver", solverResult, appliedFeatures };
}

function _attachPartIntent(newState, compiled, options) {
  const partIntent = buildPartIntentRecord(
    compiled.dsl,
    compiled,
    newState,
    options,
  );
  newState.partIntent = partIntent;

  installDslConstraints(
    newState,
    compiled.constraints,
    partIntent.bindings,
    genId,
  );

  return partIntent;
}

/** DSL をコンパイルして state を組み立て（コミットなし） */
function buildPartDslState(raw, runtimeOpts = {}) {
  const compiled = compilePartDsl(raw);
  if (!compiled.ok) return compiled;

  const mfg = validatePartManufacturing(compiled);
  if (!mfg.ok && runtimeOpts.allowManufacturingViolations !== true) {
    return {
      ok: false,
      error: "Manufacturing rule violations",
      violations: mfg.violations,
      manufacturing: mfg.manufacturing,
      compilePlan: compiled,
    };
  }

  const options = {
    ...compiled.buildOptions,
    ...runtimeOpts,
    features: compiled.features,
  };

  const built = buildPartStateFromPlan(compiled, options);
  const { newState, sizeMm, includeSideView } = built;

  const appliedFeatures = _applyPartFeatures(newState, compiled.features);
  const featureErrors = appliedFeatures.filter((f) => f.ok === false);
  if (featureErrors.length) {
    return {
      ok: false,
      dsl: compiled.dsl,
      compilePlan: compiled,
      appliedFeatures,
      error: featureErrors.map((f) => f.error).join("; "),
    };
  }

  const partIntent = _attachPartIntent(newState, compiled, options);

  for (const page of newState.pages) {
    if (page.constraints?.length && typeof applyConstraints === "function") {
      applyConstraints(page);
    }
  }

  return {
    ok: true,
    state: newState,
    dsl: compiled.dsl,
    partIntent,
    manufacturing: mfg,
    compilePlan: {
      buildOptions: compiled.buildOptions,
      constraints: compiled.constraints,
      solver: compiled.solver,
    },
    kind: compiled.dsl.part,
    sizeMm,
    includeSideView,
    views: newState.pages.map((p) => p.viewDefinition?.type).filter(Boolean),
    pageIds: newState.pages.map((p) => p.id),
    appliedFeatures,
  };
}

/**
 * DSL をコンパイルして state に適用
 */
function applyPartDsl(raw, runtimeOpts = {}) {
  if (typeof checkBriefBeforeMake === "function") {
    const gate = checkBriefBeforeMake();
    if (!gate.allowed) {
      return { ok: false, error: gate.warning, code: gate.code };
    }
  }
  const built = buildPartDslState(raw, runtimeOpts);
  if (!built.ok) return built;

  _commitAgentState(built.state, runtimeOpts);
  const readiness = validate3DReadiness();

  return {
    ok: true,
    mode: "full",
    dsl: built.dsl,
    partIntent: built.partIntent,
    manufacturing: built.manufacturing,
    compilePlan: built.compilePlan,
    kind: built.kind,
    sizeMm: built.sizeMm,
    views: built.views,
    pageIds: built.pageIds,
    appliedFeatures: built.appliedFeatures,
    readiness,
    sceneStatus:
      typeof get3DSceneStatus === "function" ? get3DSceneStatus() : null,
  };
}

function compilePartDslPlan(raw) {
  return compilePartDsl(raw);
}

/** 製造ルール検証のみ（state 不変） */
function validatePartManufacturability(raw) {
  const compiled = compilePartDsl(raw);
  if (!compiled.ok) return compiled;
  const mfg = validatePartManufacturing(compiled);
  return {
    ok: mfg.ok,
    dsl: compiled.dsl,
    manufacturing: mfg.manufacturing,
    violations: mfg.violations,
    compilePlan: {
      buildOptions: compiled.buildOptions,
      features: compiled.features,
    },
  };
}

function updatePartParam(param, valueMm, runtimeOpts = {}) {
  const key = String(param).toUpperCase();
  const state = getState();
  const existingIntent = runtimeOpts.dsl ? null : state.partIntent;
  const allowed =
    existingIntent?.dsl?.part != null
      ? partParamKeys(existingIntent.dsl.part)
      : ["W", "D", "H"];

  if (!allowed.includes(key)) {
    return {
      ok: false,
      error: `Unknown param: ${param}. Use ${allowed.join(", ")}.`,
    };
  }

  if (existingIntent?.dsl && existingIntent.bindings) {
    const newParams = { ...existingIntent.dsl.params, [key]: valueMm };
    const compiled = compilePartDsl({
      ...existingIntent.dsl,
      params: newParams,
    });
    if (!compiled.ok) return compiled;

    existingIntent.dsl.params = compiled.dsl.params;
    existingIntent.paramConstraints = syncParamBindConstraints(
      existingIntent.paramConstraints,
      compiled.dsl.params,
    );

    const solverOutcome = _applyPartParamSolver(
      state,
      existingIntent,
      compiled,
    );
    if (!solverOutcome.ok) {
      return applyPartDsl(
        { ...existingIntent.dsl, params: newParams },
        runtimeOpts,
      );
    }

    state.partIntent = existingIntent;
    pushHistory(`Part ${key}=${valueMm}mm`);
    if (typeof onStateChanged === "function") onStateChanged();
    render();
    uiUpdate();

    if (runtimeOpts.update3d !== false && typeof update3DScene === "function") {
      update3DScene();
    }

    const p = existingIntent.dsl.params;
    const sizeMm =
      existingIntent.dsl.part === "panel"
        ? { width: p.W, height: p.H }
        : existingIntent.dsl.part === "l_bracket"
          ? { A: p.A, B: p.B, T: p.T, height: p.H }
          : {
              width: p.W,
              depth: p.D,
              height: p.H,
              ...(p.T != null ? { thickness: p.T } : {}),
            };

    const readiness = validate3DReadiness();
    return {
      ok: true,
      mode: "solver",
      param: key,
      valueMm,
      dsl: existingIntent.dsl,
      sizeMm,
      appliedFeatures: solverOutcome.appliedFeatures,
      readiness,
      sceneStatus:
        typeof get3DSceneStatus === "function" ? get3DSceneStatus() : null,
    };
  }

  const base = runtimeOpts.dsl ?? legacyOptionsToPartDsl(runtimeOpts);
  const params = { ...base.params, [key]: valueMm };
  return applyPartDsl({ ...base, params }, runtimeOpts);
}

function importPartDslJson(jsonStr, runtimeOpts = {}) {
  let parsed;
  try {
    parsed = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }

  const payload =
    parsed.part != null ? parsed : parsed.dsl != null ? parsed.dsl : parsed;
  if (!payload.part && !payload.kind) {
    return { ok: false, error: "Not a Part DSL file (missing part/kind)" };
  }

  const opts = {
    ...runtimeOpts,
    projectName:
      runtimeOpts.projectName ??
      parsed.projectName ??
      parsed.meta?.projectName ??
      undefined,
  };

  return applyPartDsl(payload, opts);
}
