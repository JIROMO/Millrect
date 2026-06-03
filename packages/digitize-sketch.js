"use strict";

const DIGITIZE_TYPES = new Set(["rect", "circle", "line"]);

function _digitizeRealPerMm() {
  if (typeof require !== "undefined") {
    try {
      return require("./agent-intent").REAL_PER_MM;
    } catch {
      /* browser */
    }
  }
  return typeof window !== "undefined" ? (window.REAL_PER_MM ?? 10) : 10;
}

function _mmToReal(mm) {
  return mm * _digitizeRealPerMm();
}

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** mm 値を real units に変換（proposal は mm 第一級） */
function proposalToShape(proposal, opts = {}) {
  if (!proposal?.type || !DIGITIZE_TYPES.has(proposal.type)) return null;

  const id =
    proposal.id || (opts.genId ? opts.genId() : `digitize-${Date.now()}`);
  const stroke = proposal.stroke || opts.stroke || "#2563eb";
  const fill = proposal.fill ?? "none";
  const strokeWidth = proposal.strokeWidth || "medium";
  const base = {
    id,
    type: proposal.type,
    ghost: true,
    stroke,
    fill,
    strokeWidth,
  };
  const n = (v) => _mmToReal(v);

  if (proposal.type === "rect") {
    const x = _num(proposal.x_mm ?? proposal.x);
    const y = _num(proposal.y_mm ?? proposal.y);
    const width = _num(proposal.width_mm ?? proposal.width);
    const height = _num(proposal.height_mm ?? proposal.height);
    if (x == null || y == null || width == null || height == null) return null;
    const shape = {
      ...base,
      x: n(x),
      y: n(y),
      width: n(width),
      height: n(height),
    };
    const rx = _num(proposal.rx_mm ?? proposal.rx);
    if (rx != null && rx > 0) shape.rx = n(rx);
    return shape;
  }

  if (proposal.type === "circle") {
    const cx = _num(proposal.cx_mm ?? proposal.cx);
    const cy = _num(proposal.cy_mm ?? proposal.cy);
    const r = _num(proposal.r_mm ?? proposal.r);
    if (cx == null || cy == null || r == null || r <= 0) return null;
    return { ...base, cx: n(cx), cy: n(cy), r: n(r) };
  }

  if (proposal.type === "line") {
    const x1 = _num(proposal.x1_mm ?? proposal.x1);
    const y1 = _num(proposal.y1_mm ?? proposal.y1);
    const x2 = _num(proposal.x2_mm ?? proposal.x2);
    const y2 = _num(proposal.y2_mm ?? proposal.y2);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
    return { ...base, x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2) };
  }

  return null;
}

/**
 * Vision / エージェントから渡された primitive 提案を正規化する。
 * @returns {{ ok: boolean, shapes?: object[], errors?: object[], error?: string }}
 */
function normalizeDigitizeProposals(proposals, opts = {}) {
  if (!Array.isArray(proposals)) {
    return { ok: false, error: "proposals must be an array" };
  }
  const shapes = [];
  const errors = [];
  for (let i = 0; i < proposals.length; i++) {
    const shape = proposalToShape(proposals[i], opts);
    if (!shape) {
      errors.push({
        index: i,
        error: `invalid or unsupported proposal: ${proposals[i]?.type ?? "?"}`,
      });
      continue;
    }
    shapes.push(shape);
  }
  if (!shapes.length && errors.length) {
    return { ok: false, error: "No valid proposals", errors };
  }
  return { ok: true, shapes, errors };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DIGITIZE_TYPES,
    proposalToShape,
    normalizeDigitizeProposals,
  };
}

if (typeof window !== "undefined") {
  window.normalizeDigitizeProposals = normalizeDigitizeProposals;
  window.proposalToShape = proposalToShape;
}
