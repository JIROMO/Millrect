"use strict";

/**
 * Taste Memory — Project + Global API
 * Global は IndexedDB `tasteGlobal` ストア（プロジェクト JSON とは別）
 * @see docs/TASTE-MEMORY.md
 */

let _globalTasteCache = null;
let _globalTasteLoadPromise = null;

const REQUIRE_BRIEF_STORAGE_KEY = "millrect-require-brief-before-make";

function getRequireBriefBeforeMake() {
  try {
    return localStorage.getItem(REQUIRE_BRIEF_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setRequireBriefBeforeMake(enabled) {
  try {
    localStorage.setItem(REQUIRE_BRIEF_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function checkBriefBeforeMake() {
  return evaluateBriefBeforeMake(
    getState().projectBrief,
    getRequireBriefBeforeMake(),
  );
}

async function ensureGlobalTasteLoaded() {
  if (_globalTasteCache) return _globalTasteCache;
  if (!_globalTasteLoadPromise) {
    _globalTasteLoadPromise = dbLoadTasteGlobal().then((data) => {
      _globalTasteCache = data || createEmptyGlobalTaste();
      return _globalTasteCache;
    });
  }
  return _globalTasteLoadPromise;
}

async function initTasteMemory() {
  await ensureGlobalTasteLoaded();
}

function _applyProjectBrief(state, brief, options) {
  state.projectBrief = brief;
  if (options.pushHistory !== false) {
    pushHistory(options.historyLabel || "Update project brief");
  }
  if (typeof onStateChanged === "function") onStateChanged();
  render();
  uiUpdate();
  return {
    ok: true,
    projectBrief: state.projectBrief,
    briefSummary: briefSummary(state.projectBrief),
  };
}

function updateProjectBrief(patch, options) {
  options = options || {};
  const state = getState();
  const merged = mergeProjectBrief(state.projectBrief, patch);
  return _applyProjectBrief(state, merged, options);
}

function recordDecision(partial, options) {
  options = options || {};
  const judgment = normalizeJudgment({
    ...partial,
    at: partial?.at || new Date().toISOString(),
  });
  if (!judgment) {
    return { ok: false, error: "Invalid judgment (reason required)" };
  }
  return updateProjectBrief({ decisions: [judgment] }, options);
}

function setProjectPhase(phase, options) {
  if (!BRIEF_PHASES.includes(phase)) {
    return { ok: false, error: "Invalid phase: " + phase };
  }
  return updateProjectBrief({ phase }, options);
}

async function getTasteContext() {
  const state = getState();
  const global = await ensureGlobalTasteLoaded();
  return {
    projectBrief: state.projectBrief,
    briefSummary: briefSummary(state.projectBrief),
    globalTaste: global,
    globalSummary: globalTasteSummary(global),
  };
}

async function listGlobalPrinciples() {
  const global = await ensureGlobalTasteLoaded();
  return {
    ok: true,
    principles: global.principles,
    pending: global.pending,
    antiPatterns: global.antiPatterns,
    summary: globalTasteSummary(global),
  };
}

async function promotePrinciple(input) {
  const global = await ensureGlobalTasteLoaded();
  const projectId =
    typeof getCurrentProjectId === "function" ? getCurrentProjectId() : null;
  const result = promoteStatementToGlobal(global, input || {}, projectId);
  if (!result.ok) return result;
  _globalTasteCache = await dbSaveTasteGlobal(result.global);
  return {
    ok: true,
    principle: result.principle,
    globalSummary: globalTasteSummary(_globalTasteCache),
  };
}

async function reinforceGlobalFromCurrentProject() {
  const global = await ensureGlobalTasteLoaded();
  const projectId = getCurrentProjectId();
  const brief = getState().projectBrief;
  const { global: next, promoted } = reinforceProjectPrinciplesIntoGlobal(
    global,
    brief,
    projectId,
  );
  _globalTasteCache = await dbSaveTasteGlobal(next);
  return {
    ok: true,
    promoted,
    globalSummary: globalTasteSummary(_globalTasteCache),
  };
}

function appendSessionLearnings(payload, options) {
  options = options || {};
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload required" };
  }
  const patch = {};
  if (Array.isArray(payload.designPrinciples)) {
    patch.designPrinciples = payload.designPrinciples;
  }
  if (Array.isArray(payload.decisions)) {
    patch.decisions = payload.decisions;
  }
  if (payload.phase && BRIEF_PHASES.includes(payload.phase)) {
    patch.phase = payload.phase;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No learnings to append" };
  }
  const result = updateProjectBrief(patch, {
    ...options,
    historyLabel: options.historyLabel || "Session learnings",
  });
  if (result.ok) {
    reinforceGlobalFromCurrentProject().catch((e) =>
      console.warn("[taste-memory] reinforce failed:", e),
    );
  }
  return result;
}

/** 新規プロジェクト: Global principles を projectBrief にコピー（スナップショット） */
async function seedProjectBriefFromGlobal() {
  const global = await ensureGlobalTasteLoaded();
  const copies = copyGlobalPrinciplesForProject(global);
  if (!copies.length) return { ok: true, seeded: 0 };
  const state = getState();
  const merged = mergeProjectBrief(state.projectBrief, {
    designPrinciples: copies,
  });
  state.projectBrief = merged;
  return { ok: true, seeded: copies.length };
}

function recordCaptureArtifactLog(captureResult, options) {
  options = options || {};
  if (!captureResult || captureResult.ok === false) {
    return { ok: false, skipped: true, reason: "capture failed" };
  }
  const meshStatus =
    typeof get3DSceneStatus === "function" ? get3DSceneStatus() : undefined;
  return appendArtifactLogEntry(
    {
      trigger: options.trigger || "ai_self_review",
      capturePath:
        captureResult.relativePath || captureResult.path || options.capturePath,
      meshStatus,
      outcome: options.outcome,
      evaluation: options.evaluation,
    },
    {
      pushHistory: options.pushHistory !== false,
      historyLabel: options.historyLabel || "Capture review",
    },
  );
}

function appendArtifactLogEntry(entry, options) {
  options = options || {};
  const normalized = normalizeArtifactEntry({
    ...entry,
    revision:
      entry?.revision ??
      (getState().projectBrief?.artifactLog?.length || 0) + 1,
    at: entry?.at || new Date().toISOString(),
  });
  if (!normalized) {
    return { ok: false, error: "Invalid artifact entry" };
  }
  return updateProjectBrief(
    { artifactLog: [normalized] },
    {
      ...options,
      historyLabel: options.historyLabel || "Artifact review",
    },
  );
}
