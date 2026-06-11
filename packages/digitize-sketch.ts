"use strict";

type DigitizeType = "rect" | "circle" | "line";

interface DigitizeProposal {
  id?: string;
  type?: DigitizeType | string;
  stroke?: string;
  fill?: string;
  strokeWidth?: string;
  x_mm?: unknown;
  y_mm?: unknown;
  width_mm?: unknown;
  height_mm?: unknown;
  rx_mm?: unknown;
  cx_mm?: unknown;
  cy_mm?: unknown;
  r_mm?: unknown;
  x1_mm?: unknown;
  y1_mm?: unknown;
  x2_mm?: unknown;
  y2_mm?: unknown;
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  rx?: unknown;
  cx?: unknown;
  cy?: unknown;
  r?: unknown;
  x1?: unknown;
  y1?: unknown;
  x2?: unknown;
  y2?: unknown;
}

interface DigitizeOptions {
  genId?: () => string;
  stroke?: string;
}

interface DigitizeBaseShape {
  id: string;
  type: DigitizeType | string;
  ghost: true;
  stroke: string;
  fill: string;
  strokeWidth: string;
}

interface DigitizeRectShape extends DigitizeBaseShape {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
}

interface DigitizeCircleShape extends DigitizeBaseShape {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
}

interface DigitizeLineShape extends DigitizeBaseShape {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type DigitizeShape =
  | DigitizeRectShape
  | DigitizeCircleShape
  | DigitizeLineShape;

interface DigitizeError {
  index: number;
  error: string;
}

const DIGITIZE_TYPES = new Set<DigitizeType>(["rect", "circle", "line"]);

function _digitizeRealPerMm(): number {
  if (typeof require !== "undefined") {
    try {
      return require("./agent-intent").REAL_PER_MM;
    } catch {
      /* browser */
    }
  }
  return typeof window !== "undefined" ? ((window as any).REAL_PER_MM ?? 10) : 10;
}

function _mmToReal(mm: number): number {
  return mm * _digitizeRealPerMm();
}

function _digitizeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isDigitizeType(type: unknown): type is DigitizeType {
  return typeof type === "string" && DIGITIZE_TYPES.has(type as DigitizeType);
}

/** mm 値を real units に変換（proposal は mm 第一級） */
function proposalToShape(
  proposal: DigitizeProposal,
  opts: DigitizeOptions = {},
): DigitizeShape | null {
  if (!proposal?.type || !isDigitizeType(proposal.type)) return null;

  const id =
    proposal.id || (opts.genId ? opts.genId() : `digitize-${Date.now()}`);
  const stroke = proposal.stroke || opts.stroke || "#2563eb";
  const fill = proposal.fill ?? "none";
  const strokeWidth = proposal.strokeWidth || "medium";
  const base = {
    id,
    type: proposal.type,
    ghost: true as const,
    stroke,
    fill,
    strokeWidth,
  };
  const n = (v: number): number => _mmToReal(v);

  if (proposal.type === "rect") {
    const x = _digitizeNum(proposal.x_mm ?? proposal.x);
    const y = _digitizeNum(proposal.y_mm ?? proposal.y);
    const width = _digitizeNum(proposal.width_mm ?? proposal.width);
    const height = _digitizeNum(proposal.height_mm ?? proposal.height);
    if (x == null || y == null || width == null || height == null) return null;
    const shape: DigitizeRectShape = {
      ...base,
      type: "rect",
      x: n(x),
      y: n(y),
      width: n(width),
      height: n(height),
    };
    const rx = _digitizeNum(proposal.rx_mm ?? proposal.rx);
    if (rx != null && rx > 0) shape.rx = n(rx);
    return shape;
  }

  if (proposal.type === "circle") {
    const cx = _digitizeNum(proposal.cx_mm ?? proposal.cx);
    const cy = _digitizeNum(proposal.cy_mm ?? proposal.cy);
    const r = _digitizeNum(proposal.r_mm ?? proposal.r);
    if (cx == null || cy == null || r == null || r <= 0) return null;
    return { ...base, type: "circle", cx: n(cx), cy: n(cy), r: n(r) };
  }

  if (proposal.type === "line") {
    const x1 = _digitizeNum(proposal.x1_mm ?? proposal.x1);
    const y1 = _digitizeNum(proposal.y1_mm ?? proposal.y1);
    const x2 = _digitizeNum(proposal.x2_mm ?? proposal.x2);
    const y2 = _digitizeNum(proposal.y2_mm ?? proposal.y2);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
    return {
      ...base,
      type: "line",
      x1: n(x1),
      y1: n(y1),
      x2: n(x2),
      y2: n(y2),
    };
  }

  return null;
}

/**
 * Vision / エージェントから渡された primitive 提案を正規化する。
 * @returns {{ ok: boolean, shapes?: object[], errors?: object[], error?: string }}
 */
function normalizeDigitizeProposals(
  proposals: unknown,
  opts: DigitizeOptions = {},
) {
  if (!Array.isArray(proposals)) {
    return { ok: false, error: "proposals must be an array" };
  }
  const shapes: DigitizeShape[] = [];
  const errors: DigitizeError[] = [];
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
  Object.assign(window, {
    DIGITIZE_TYPES,
    proposalToShape,
    normalizeDigitizeProposals,
  });
}
