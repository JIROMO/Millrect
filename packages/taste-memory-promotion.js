"use strict";

/** Project → Global 昇格（2 プロジェクト以上で確定） @see docs/TASTE-MEMORY.md */

const _tmDeps =
  typeof module !== "undefined" && module.exports
    ? require("./taste-memory")
    : {
        normalizePrinciple: window.normalizePrinciple,
        tasteGenId: window.tasteGenId,
        PRINCIPLE_POLARITIES: window.PRINCIPLE_POLARITIES,
      };

const {
  normalizePrinciple: normalizePrincipleBase,
  tasteGenId: tasteGenIdFn,
  PRINCIPLE_POLARITIES: principlePolarities,
} = _tmDeps;

const PROMOTE_PROJECT_THRESHOLD = 2;

function statementKey(statement) {
  return String(statement || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePendingPrinciple(entry) {
  if (!entry || typeof entry !== "object") return null;
  const statement =
    typeof entry.statement === "string" ? entry.statement.trim() : "";
  if (!statement) return null;
  const key = statementKey(statement);
  const projectIds = Array.isArray(entry.projectIds)
    ? [
        ...new Set(
          entry.projectIds.filter((id) => typeof id === "string" && id),
        ),
      ]
    : [];
  return {
    statementKey: key,
    statement,
    polarity: principlePolarities.includes(entry.polarity)
      ? entry.polarity
      : "prefer",
    scope: typeof entry.scope === "string" ? entry.scope : undefined,
    projectIds,
  };
}

function normalizeGlobalPrinciple(p) {
  const base = normalizePrincipleBase(p);
  if (!base) return null;
  const projectIds = Array.isArray(p.projectIds)
    ? [...new Set(p.projectIds.filter((id) => typeof id === "string" && id))]
    : [];
  return {
    ...base,
    evidenceCount: Math.max(
      projectIds.length,
      Number(p.evidenceCount) || projectIds.length || 1,
    ),
    projectIds,
    lastReinforced:
      typeof p.lastReinforced === "string"
        ? p.lastReinforced
        : new Date().toISOString(),
  };
}

function createEmptyGlobalTaste() {
  return {
    version: 1,
    principles: [],
    pending: [],
    antiPatterns: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeGlobalTaste(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyGlobalTaste();
  }
  const out = {
    version: 1,
    principles: [],
    pending: [],
    antiPatterns: Array.isArray(raw.antiPatterns)
      ? raw.antiPatterns.filter((s) => typeof s === "string" && s.trim())
      : [],
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
  if (Array.isArray(raw.principles)) {
    out.principles = raw.principles
      .map(normalizeGlobalPrinciple)
      .filter(Boolean);
  }
  if (Array.isArray(raw.pending)) {
    out.pending = raw.pending.map(normalizePendingPrinciple).filter(Boolean);
  }
  return out;
}

function globalTasteSummary(global) {
  const g = normalizeGlobalTaste(global);
  return {
    principleCount: g.principles.length,
    pendingCount: g.pending.length,
    antiPatternCount: g.antiPatterns.length,
    promotionCandidates: g.pending.filter(
      (p) => p.projectIds.length >= PROMOTE_PROJECT_THRESHOLD,
    ),
  };
}

/**
 * 案件の designPrinciples を Global pending / principles に反映
 * @returns {{ global: object, promoted: string[] }}
 */
function reinforceProjectPrinciplesIntoGlobal(global, projectBrief, projectId) {
  const g = normalizeGlobalTaste(global);
  const promoted = [];
  if (!projectBrief?.designPrinciples?.length || !projectId) {
    return { global: g, promoted };
  }

  for (const pp of projectBrief.designPrinciples) {
    if (pp.promoteBlocked) continue;
    const key = statementKey(pp.statement);
    if (!key) continue;

    const existing = g.principles.find(
      (x) => statementKey(x.statement) === key,
    );
    if (existing) {
      if (!existing.projectIds.includes(projectId)) {
        existing.projectIds.push(projectId);
        existing.evidenceCount = existing.projectIds.length;
        existing.lastReinforced = new Date().toISOString();
      }
      continue;
    }

    let pend = g.pending.find((x) => x.statementKey === key);
    if (!pend) {
      pend = normalizePendingPrinciple({
        statement: pp.statement,
        polarity: pp.polarity,
        scope: pp.scope,
        projectIds: [projectId],
      });
      if (pend) g.pending.push(pend);
    } else if (!pend.projectIds.includes(projectId)) {
      pend.projectIds.push(projectId);
    }

    if (pend && pend.projectIds.length >= PROMOTE_PROJECT_THRESHOLD) {
      const gp = normalizeGlobalPrinciple({
        id: tasteGenIdFn("gp"),
        statement: pend.statement,
        polarity: pend.polarity,
        scope: pend.scope,
        projectIds: pend.projectIds,
        evidenceCount: pend.projectIds.length,
        sources: pend.projectIds.map((id) => `project:${id}`),
      });
      if (gp) {
        g.principles.push(gp);
        g.pending = g.pending.filter((x) => x.statementKey !== key);
        promoted.push(gp.statement);
      }
    }
  }

  g.updatedAt = new Date().toISOString();
  return { global: g, promoted };
}

/** 手動で Global に 1 件追加（pending をスキップ） */
function promoteStatementToGlobal(global, input, projectId) {
  const g = normalizeGlobalTaste(global);
  const statement =
    typeof input.statement === "string" ? input.statement.trim() : "";
  if (!statement) return { global: g, ok: false, error: "statement required" };

  const key = statementKey(statement);
  const existing = g.principles.find((x) => statementKey(x.statement) === key);
  if (existing) {
    if (projectId && !existing.projectIds.includes(projectId)) {
      existing.projectIds.push(projectId);
      existing.evidenceCount = existing.projectIds.length;
    }
    existing.lastReinforced = new Date().toISOString();
    g.pending = g.pending.filter((x) => x.statementKey !== key);
    g.updatedAt = new Date().toISOString();
    return { global: g, ok: true, principle: existing };
  }

  const ids = projectId ? [projectId] : [];
  const gp = normalizeGlobalPrinciple({
    id: tasteGenIdFn("gp"),
    statement,
    polarity: input.polarity || "prefer",
    scope: input.scope,
    projectIds: ids,
    evidenceCount: Math.max(ids.length, 1),
    sources: projectId ? [`project:${projectId}`, "manual"] : ["manual"],
  });
  g.principles.push(gp);
  g.pending = g.pending.filter((x) => x.statementKey !== key);
  g.updatedAt = new Date().toISOString();
  return { global: g, ok: true, principle: gp };
}

function copyGlobalPrinciplesForProject(global) {
  const g = normalizeGlobalTaste(global);
  return g.principles
    .map((gp) =>
      normalizePrincipleBase({
        statement: gp.statement,
        polarity: gp.polarity,
        scope: gp.scope,
        sources: [`global:${gp.id}`],
      }),
    )
    .filter(Boolean);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROMOTE_PROJECT_THRESHOLD,
    statementKey,
    createEmptyGlobalTaste,
    normalizeGlobalTaste,
    normalizeGlobalPrinciple,
    globalTasteSummary,
    reinforceProjectPrinciplesIntoGlobal,
    promoteStatementToGlobal,
    copyGlobalPrinciplesForProject,
  };
} else if (typeof window !== "undefined") {
  window.PROMOTE_PROJECT_THRESHOLD = PROMOTE_PROJECT_THRESHOLD;
  window.statementKey = statementKey;
  window.createEmptyGlobalTaste = createEmptyGlobalTaste;
  window.normalizeGlobalTaste = normalizeGlobalTaste;
  window.normalizeGlobalPrinciple = normalizeGlobalPrinciple;
  window.globalTasteSummary = globalTasteSummary;
  window.reinforceProjectPrinciplesIntoGlobal =
    reinforceProjectPrinciplesIntoGlobal;
  window.promoteStatementToGlobal = promoteStatementToGlobal;
  window.copyGlobalPrinciplesForProject = copyGlobalPrinciplesForProject;
}
