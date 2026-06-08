"use strict";

/** Project → Global 昇格（2 プロジェクト以上で確定） @see docs/TASTE-MEMORY.md */

type TastePromotionRecord = Record<string, any>;

interface TasteMemoryDeps {
  normalizePrinciple: (p: unknown) => TastePromotionRecord | null;
  tasteGenId: (prefix: string) => string;
  PRINCIPLE_POLARITIES: string[];
}

const _tmDeps: TasteMemoryDeps =
  typeof module !== "undefined" && module.exports
    ? require("./taste-memory")
    : {
        normalizePrinciple: (window as any).normalizePrinciple,
        tasteGenId: (window as any).tasteGenId,
        PRINCIPLE_POLARITIES: (window as any).PRINCIPLE_POLARITIES,
      };

const {
  normalizePrinciple: normalizePrincipleBase,
  tasteGenId: tasteGenIdFn,
  PRINCIPLE_POLARITIES: principlePolarities,
} = _tmDeps;

const PROMOTE_PROJECT_THRESHOLD = 2;

function promotionIsRecord(value: unknown): value is TastePromotionRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function promotionStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === "string" && id))]
    : [];
}

function statementKey(statement: unknown): string {
  return String(statement || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePendingPrinciple(
  entry: unknown,
): TastePromotionRecord | null {
  if (!promotionIsRecord(entry)) return null;
  const statement =
    typeof entry.statement === "string" ? entry.statement.trim() : "";
  if (!statement) return null;
  const key = statementKey(statement);
  const projectIds = promotionStringList(entry.projectIds);
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

function normalizeGlobalPrinciple(p: unknown): TastePromotionRecord | null {
  if (!promotionIsRecord(p)) return null;
  const base = normalizePrincipleBase(p);
  if (!base) return null;
  const projectIds = promotionStringList(p.projectIds);
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

function normalizeGlobalTaste(raw: unknown): TastePromotionRecord {
  if (!promotionIsRecord(raw)) {
    return createEmptyGlobalTaste();
  }
  const out: TastePromotionRecord = {
    version: 1,
    principles: [],
    pending: [],
    antiPatterns: Array.isArray(raw.antiPatterns)
      ? raw.antiPatterns.filter((s: unknown) => typeof s === "string" && s.trim())
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

function globalTasteSummary(global: unknown) {
  const g = normalizeGlobalTaste(global);
  return {
    principleCount: g.principles.length,
    pendingCount: g.pending.length,
    antiPatternCount: g.antiPatterns.length,
    promotionCandidates: g.pending.filter(
      (p: TastePromotionRecord) =>
        p.projectIds.length >= PROMOTE_PROJECT_THRESHOLD,
    ),
  };
}

/**
 * 案件の designPrinciples を Global pending / principles に反映
 * @returns {{ global: object, promoted: string[] }}
 */
function reinforceProjectPrinciplesIntoGlobal(
  global: unknown,
  projectBrief: TastePromotionRecord | null,
  projectId: string,
) {
  const g = normalizeGlobalTaste(global);
  const promoted: string[] = [];
  if (!projectBrief?.designPrinciples?.length || !projectId) {
    return { global: g, promoted };
  }

  for (const pp of projectBrief.designPrinciples) {
    if (pp.promoteBlocked) continue;
    const key = statementKey(pp.statement);
    if (!key) continue;

    const existing = g.principles.find(
      (x: TastePromotionRecord) => statementKey(x.statement) === key,
    );
    if (existing) {
      if (!existing.projectIds.includes(projectId)) {
        existing.projectIds.push(projectId);
        existing.evidenceCount = existing.projectIds.length;
        existing.lastReinforced = new Date().toISOString();
      }
      continue;
    }

    let pend = g.pending.find((x: TastePromotionRecord) => x.statementKey === key);
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
        sources: pend.projectIds.map((id: string) => `project:${id}`),
      });
      if (gp) {
        g.principles.push(gp);
        g.pending = g.pending.filter(
          (x: TastePromotionRecord) => x.statementKey !== key,
        );
        promoted.push(gp.statement);
      }
    }
  }

  g.updatedAt = new Date().toISOString();
  return { global: g, promoted };
}

/** 手動で Global に 1 件追加（pending をスキップ） */
function promoteStatementToGlobal(
  global: unknown,
  input: TastePromotionRecord,
  projectId?: string,
) {
  const g = normalizeGlobalTaste(global);
  const statement =
    typeof input.statement === "string" ? input.statement.trim() : "";
  if (!statement) return { global: g, ok: false, error: "statement required" };

  const key = statementKey(statement);
  const existing = g.principles.find(
    (x: TastePromotionRecord) => statementKey(x.statement) === key,
  );
  if (existing) {
    if (projectId && !existing.projectIds.includes(projectId)) {
      existing.projectIds.push(projectId);
      existing.evidenceCount = existing.projectIds.length;
    }
    existing.lastReinforced = new Date().toISOString();
    g.pending = g.pending.filter(
      (x: TastePromotionRecord) => x.statementKey !== key,
    );
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
  g.pending = g.pending.filter((x: TastePromotionRecord) => x.statementKey !== key);
  g.updatedAt = new Date().toISOString();
  return { global: g, ok: true, principle: gp };
}

function copyGlobalPrinciplesForProject(global: unknown) {
  const g = normalizeGlobalTaste(global);
  return g.principles
    .map((gp: TastePromotionRecord) =>
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
  Object.assign(window, {
    PROMOTE_PROJECT_THRESHOLD,
    statementKey,
    createEmptyGlobalTaste,
    normalizeGlobalTaste,
    normalizeGlobalPrinciple,
    globalTasteSummary,
    reinforceProjectPrinciplesIntoGlobal,
    promoteStatementToGlobal,
    copyGlobalPrinciplesForProject,
  });
}
