"use strict";

/** @see docs/TASTE-MEMORY.md */
const PROJECT_BRIEF_VERSION = 1;

const BRIEF_PHASES = [
  "discover",
  "taste",
  "brief",
  "make",
  "review",
  "learn",
  "done",
];

/** requireBriefBeforeMake 時に Part 生成を許可するフェーズ */
const BRIEF_MAKE_PHASES = ["brief", "make", "review", "learn", "done"];

const PRINCIPLE_POLARITIES = ["prefer", "avoid"];
const JUDGMENT_OUTCOMES = ["accept", "reject", "revise", "note"];
const ARTIFACT_TRIGGERS = [
  "user_feedback",
  "ai_self_review",
  "export",
  "param_change",
  "other",
];
const ARTIFACT_OUTCOMES = ["accept", "reject", "partial"];

function tasteGenId(prefix) {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

function createEmptyProjectBrief(overrides) {
  const base = {
    version: PROJECT_BRIEF_VERSION,
    designPrinciples: [],
    decisions: [],
    artifactLog: [],
    updatedAt: new Date().toISOString(),
  };
  if (!overrides || typeof overrides !== "object") return base;
  return mergeProjectBrief(null, overrides);
}

function normalizeTasteRef(ref) {
  if (!ref || typeof ref !== "object") return null;
  const type = ref.type;
  if (type === "url" && typeof ref.url === "string" && ref.url) {
    return { type: "url", url: ref.url, note: ref.note ?? undefined };
  }
  if (type === "image" && typeof ref.path === "string" && ref.path) {
    return { type: "image", path: ref.path, note: ref.note ?? undefined };
  }
  if (type === "brand" && typeof ref.name === "string" && ref.name) {
    return { type: "brand", name: ref.name, note: ref.note ?? undefined };
  }
  return null;
}

function normalizePrinciple(p) {
  if (!p || typeof p !== "object") return null;
  const statement = typeof p.statement === "string" ? p.statement.trim() : "";
  if (!statement) return null;
  const polarity = PRINCIPLE_POLARITIES.includes(p.polarity)
    ? p.polarity
    : "prefer";
  return {
    id: typeof p.id === "string" && p.id ? p.id : tasteGenId("p"),
    statement,
    polarity,
    scope: typeof p.scope === "string" ? p.scope : undefined,
    confidence:
      typeof p.confidence === "number" && p.confidence >= 0 && p.confidence <= 1
        ? p.confidence
        : undefined,
    sources: Array.isArray(p.sources)
      ? p.sources.filter((s) => typeof s === "string")
      : undefined,
    promoteBlocked: p.promoteBlocked === true ? true : undefined,
  };
}

function normalizeJudgment(j) {
  if (!j || typeof j !== "object") return null;
  const reason = typeof j.reason === "string" ? j.reason.trim() : "";
  if (!reason) return null;
  const outcome = JUDGMENT_OUTCOMES.includes(j.outcome) ? j.outcome : "note";
  let target;
  if (j.target && typeof j.target === "object") {
    target = {
      kind: typeof j.target.kind === "string" ? j.target.kind : "other",
      id: typeof j.target.id === "string" ? j.target.id : undefined,
    };
  }
  return {
    id: typeof j.id === "string" && j.id ? j.id : tasteGenId("j"),
    at: typeof j.at === "string" ? j.at : new Date().toISOString(),
    outcome,
    target,
    reason,
    sessionId: typeof j.sessionId === "string" ? j.sessionId : undefined,
    promoteCandidate: j.promoteCandidate === false ? false : undefined,
  };
}

function normalizeArtifactEntry(e) {
  if (!e || typeof e !== "object") return null;
  const revision = Number(e.revision);
  if (!Number.isFinite(revision)) return null;
  const trigger = ARTIFACT_TRIGGERS.includes(e.trigger) ? e.trigger : "other";
  const outcome =
    e.outcome && ARTIFACT_OUTCOMES.includes(e.outcome) ? e.outcome : undefined;
  return {
    revision,
    at: typeof e.at === "string" ? e.at : new Date().toISOString(),
    trigger,
    capturePath: typeof e.capturePath === "string" ? e.capturePath : undefined,
    meshStatus:
      e.meshStatus && typeof e.meshStatus === "object"
        ? {
            meshCount: Number(e.meshStatus.meshCount) || 0,
            message:
              typeof e.meshStatus.message === "string"
                ? e.meshStatus.message
                : undefined,
          }
        : undefined,
    evaluation:
      e.evaluation && typeof e.evaluation === "object"
        ? {
            aligned: Array.isArray(e.evaluation.aligned)
              ? e.evaluation.aligned.filter((x) => typeof x === "string")
              : undefined,
            misaligned: Array.isArray(e.evaluation.misaligned)
              ? e.evaluation.misaligned.filter((x) => typeof x === "string")
              : undefined,
          }
        : undefined,
    outcome,
    linkedJudgmentIds: Array.isArray(e.linkedJudgmentIds)
      ? e.linkedJudgmentIds.filter((x) => typeof x === "string")
      : undefined,
  };
}

function normalizeProjectBrief(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const out = {
    version: PROJECT_BRIEF_VERSION,
    designPrinciples: [],
    decisions: [],
    artifactLog: [],
  };

  if (typeof raw.intent === "string" && raw.intent.trim()) {
    out.intent = raw.intent.trim();
  }
  if (raw.constraints && typeof raw.constraints === "object") {
    out.constraints = { ...raw.constraints };
  }
  if (BRIEF_PHASES.includes(raw.phase)) {
    out.phase = raw.phase;
  }
  if (typeof raw.updatedAt === "string") {
    out.updatedAt = raw.updatedAt;
  }

  if (Array.isArray(raw.tasteRefs)) {
    out.tasteRefs = raw.tasteRefs.map(normalizeTasteRef).filter(Boolean);
  }
  if (Array.isArray(raw.designPrinciples)) {
    out.designPrinciples = raw.designPrinciples
      .map(normalizePrinciple)
      .filter(Boolean);
  }
  if (Array.isArray(raw.decisions)) {
    out.decisions = raw.decisions.map(normalizeJudgment).filter(Boolean);
  }
  if (Array.isArray(raw.artifactLog)) {
    out.artifactLog = raw.artifactLog
      .map(normalizeArtifactEntry)
      .filter(Boolean);
  }

  if (isEmptyProjectBrief(out)) return null;
  if (!out.updatedAt) out.updatedAt = new Date().toISOString();
  return out;
}

function isEmptyProjectBrief(brief) {
  if (!brief || typeof brief !== "object") return true;
  return (
    !brief.intent &&
    (!brief.constraints || Object.keys(brief.constraints).length === 0) &&
    (!brief.tasteRefs || brief.tasteRefs.length === 0) &&
    (!brief.designPrinciples || brief.designPrinciples.length === 0) &&
    (!brief.decisions || brief.decisions.length === 0) &&
    (!brief.artifactLog || brief.artifactLog.length === 0) &&
    !brief.phase
  );
}

function mergeProjectBrief(existing, patch) {
  const base = normalizeProjectBrief(existing) || createEmptyProjectBrief();
  if (!patch || typeof patch !== "object") return base;

  const out = {
    ...base,
    version: PROJECT_BRIEF_VERSION,
    designPrinciples: [...(base.designPrinciples || [])],
    decisions: [...(base.decisions || [])],
    artifactLog: [...(base.artifactLog || [])],
    tasteRefs: [...(base.tasteRefs || [])],
  };

  if (patch.intent !== undefined) {
    out.intent =
      typeof patch.intent === "string" && patch.intent.trim()
        ? patch.intent.trim()
        : undefined;
  }
  if (patch.phase !== undefined) {
    out.phase = BRIEF_PHASES.includes(patch.phase) ? patch.phase : undefined;
  }
  if (patch.constraints !== undefined) {
    out.constraints =
      patch.constraints && typeof patch.constraints === "object"
        ? { ...patch.constraints }
        : undefined;
  }
  if (typeof patch.updatedAt === "string") {
    out.updatedAt = patch.updatedAt;
  } else {
    out.updatedAt = new Date().toISOString();
  }

  if (Array.isArray(patch.tasteRefs)) {
    for (const ref of patch.tasteRefs) {
      const n = normalizeTasteRef(ref);
      if (n) out.tasteRefs.push(n);
    }
  }
  if (Array.isArray(patch.designPrinciples)) {
    for (const p of patch.designPrinciples) {
      const n = normalizePrinciple(p);
      if (n) out.designPrinciples.push(n);
    }
  }
  if (Array.isArray(patch.decisions)) {
    for (const d of patch.decisions) {
      const n = normalizeJudgment(d);
      if (n) out.decisions.push(n);
    }
  }
  if (Array.isArray(patch.artifactLog)) {
    for (const a of patch.artifactLog) {
      const n = normalizeArtifactEntry(a);
      if (n) out.artifactLog.push(n);
    }
  }

  if (isEmptyProjectBrief(out)) return null;
  return out;
}

/** MCP / get_project_context 用の要約 */
function evaluateBriefBeforeMake(brief, required) {
  if (!required) return { allowed: true };
  const sum = briefSummary(brief);
  if (!sum) {
    return {
      allowed: false,
      code: "BRIEF_REQUIRED",
      warning:
        "Taste Memory: set phase to brief (or later) and add intent or design principles before generating.",
    };
  }
  const phaseOk = brief.phase && BRIEF_MAKE_PHASES.includes(brief.phase);
  const hasContent = Boolean(sum.intent) || (sum.designPrincipleCount || 0) > 0;
  if (phaseOk && hasContent) return { allowed: true };
  return {
    allowed: false,
    code: "BRIEF_REQUIRED",
    warning:
      "Taste Memory: set phase to brief (or later) and add intent or design principles before generating.",
  };
}

function briefSummary(brief) {
  if (!brief) return null;
  const decisions = brief.decisions || [];
  return {
    intent: brief.intent ?? null,
    phase: brief.phase ?? null,
    designPrincipleCount: (brief.designPrinciples || []).length,
    decisionCount: decisions.length,
    tasteRefCount: (brief.tasteRefs || []).length,
    artifactLogCount: (brief.artifactLog || []).length,
    recentDecisions: decisions.slice(-3).map((d) => ({
      id: d.id,
      outcome: d.outcome,
      reason: d.reason,
      at: d.at,
    })),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROJECT_BRIEF_VERSION,
    BRIEF_PHASES,
    BRIEF_MAKE_PHASES,
    PRINCIPLE_POLARITIES,
    evaluateBriefBeforeMake,
    createEmptyProjectBrief,
    normalizeProjectBrief,
    mergeProjectBrief,
    normalizePrinciple,
    normalizeJudgment,
    normalizeArtifactEntry,
    isEmptyProjectBrief,
    briefSummary,
    tasteGenId,
  };
} else if (typeof window !== "undefined") {
  window.PROJECT_BRIEF_VERSION = PROJECT_BRIEF_VERSION;
  window.BRIEF_PHASES = BRIEF_PHASES;
  window.BRIEF_MAKE_PHASES = BRIEF_MAKE_PHASES;
  window.PRINCIPLE_POLARITIES = PRINCIPLE_POLARITIES;
  window.evaluateBriefBeforeMake = evaluateBriefBeforeMake;
  window.createEmptyProjectBrief = createEmptyProjectBrief;
  window.normalizeProjectBrief = normalizeProjectBrief;
  window.mergeProjectBrief = mergeProjectBrief;
  window.normalizePrinciple = normalizePrinciple;
  window.normalizeJudgment = normalizeJudgment;
  window.normalizeArtifactEntry = normalizeArtifactEntry;
  window.isEmptyProjectBrief = isEmptyProjectBrief;
  window.briefSummary = briefSummary;
  window.tasteGenId = tasteGenId;
}
