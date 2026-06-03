"use strict";

// ── 拘束システム (constraints.js) ────────────────────────────
//
// 設計原則:
//   - 拘束は page.constraints[] に格納する（layer.shapes[] には混入しない）
//   - 拘束は派生的な強制力であり、shape の座標を直接書き換える
//   - Undo/Redo は pages ごとスナップショットされるため自動対応
//   - ソルバー: 軽量な反復緩和法（最大 20 イテレーション）
//
// 拘束スキーマ:
//   { id, type, shapeIds: [id, ...], params?: {} }
//
// 拘束タイプ:
//   horizontal   — line を水平にする (y1 === y2)
//   vertical     — line を垂直にする (x1 === x2)
//   parallel     — 2本の line を平行にする
//   equal_length — 2本の line を等長にする
//   fixed        — shape の位置を固定する（移動不可）
//   coincident   — 2つの端点を一致させる
//   symmetric    — 2点を指定軸に対して対称にする

// ── 拘束の追加・削除 ─────────────────────────────────────────

function addConstraint(constraint) {
  const page = getCurrentPage();
  if (!page.constraints) page.constraints = [];
  if (!constraint.id) constraint.id = genId("cst");
  page.constraints.push(constraint);
  pushHistory();
  return constraint.id;
}

function removeConstraint(id) {
  const page = getCurrentPage();
  if (!page.constraints) return false;
  const idx = page.constraints.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  page.constraints.splice(idx, 1);
  pushHistory();
  return true;
}

function getConstraintsForShape(shapeId) {
  const page = getCurrentPage();
  return (page.constraints || []).filter((c) => c.shapeIds.includes(shapeId));
}

function getAllConstraints() {
  const page = getCurrentPage();
  return page.constraints || [];
}

// ── 拘束ソルバー (反復緩和法) ─────────────────────────────────
//
// 使用方法:
//   applyConstraints()                 — 現在ページに適用
//   applyConstraints(page)             — 指定ページに適用
//
// 各イテレーションで全拘束を1回ずつ処理する。
// 残差が収束するか最大イテレーション数に達したら終了。
//
const MAX_CONSTRAINT_ITERS = 20;
const CONSTRAINT_TOL = 0.01; // real 座標の許容誤差

function applyConstraints(page) {
  if (!page) page = getCurrentPage();
  const constraints = page.constraints || [];
  if (!constraints.length) return;

  for (let iter = 0; iter < MAX_CONSTRAINT_ITERS; iter++) {
    let maxResidual = 0;

    for (const c of constraints) {
      const residual = _applyOneConstraint(c, page);
      if (residual > maxResidual) maxResidual = residual;
    }

    if (maxResidual < CONSTRAINT_TOL) break;
  }
}

// ── 個別拘束の適用 ────────────────────────────────────────────
// 戻り値: 残差（修正量の大きさ）

function _applyOneConstraint(c, page) {
  const shapes = c.shapeIds
    .map((id) => _findShapeOnPage(id, page))
    .filter(Boolean);

  switch (c.type) {
    case "horizontal":
      return _cstHorizontal(shapes[0]);
    case "vertical":
      return _cstVertical(shapes[0]);
    case "parallel":
      return _cstParallel(shapes[0], shapes[1]);
    case "equal_length":
      return _cstEqualLength(shapes[0], shapes[1]);
    case "fixed":
      return _cstFixed(shapes[0], c.params);
    case "coincident":
      return _cstCoincident(shapes[0], shapes[1], c.params);
    case "symmetric":
      return _cstSymmetric(shapes[0], shapes[1], c.params, page);
    default:
      return 0;
  }
}

// ── ページ内 shape 検索（constraints.js 内部用） ─────────────
function _findShapeOnPage(id, page) {
  for (const layer of page.layers) {
    const s = layer.shapes.find((sh) => sh.id === id);
    if (s) return s;
  }
  return null;
}

// ── 拘束実装 ─────────────────────────────────────────────────

// horizontal: line を水平にする（y1, y2 の平均に揃える）
function _cstHorizontal(s) {
  if (!s || s.type !== "line") return 0;
  const avg = (s.y1 + s.y2) / 2;
  const residual = Math.abs(s.y1 - avg) + Math.abs(s.y2 - avg);
  s.y1 = avg;
  s.y2 = avg;
  return residual;
}

// vertical: line を垂直にする（x1, x2 の平均に揃える）
function _cstVertical(s) {
  if (!s || s.type !== "line") return 0;
  const avg = (s.x1 + s.x2) / 2;
  const residual = Math.abs(s.x1 - avg) + Math.abs(s.x2 - avg);
  s.x1 = avg;
  s.x2 = avg;
  return residual;
}

// parallel: 2本の line を平行にする
// s2 の向きを s1 の向きに合わせる（長さは保持）
function _cstParallel(s1, s2) {
  if (!s1 || !s2 || s1.type !== "line" || s2.type !== "line") return 0;
  const dx1 = s1.x2 - s1.x1,
    dy1 = s1.y2 - s1.y1;
  const len1 = Math.hypot(dx1, dy1);
  if (len1 < 1e-6) return 0;
  const nx = dx1 / len1,
    ny = dy1 / len1;

  // s2 の長さを保持しながら方向を s1 に合わせる
  const len2 = Math.hypot(s2.x2 - s2.x1, s2.y2 - s2.y1);
  const cx2 = (s2.x1 + s2.x2) / 2;
  const cy2 = (s2.y1 + s2.y2) / 2;

  const newX1 = cx2 - (nx * len2) / 2;
  const newY1 = cy2 - (ny * len2) / 2;
  const newX2 = cx2 + (nx * len2) / 2;
  const newY2 = cy2 + (ny * len2) / 2;

  const residual =
    Math.hypot(s2.x1 - newX1, s2.y1 - newY1) +
    Math.hypot(s2.x2 - newX2, s2.y2 - newY2);
  s2.x1 = newX1;
  s2.y1 = newY1;
  s2.x2 = newX2;
  s2.y2 = newY2;
  return residual;
}

// equal_length: 2本の line を等長にする
// 両者の長さの平均に揃える（中心は変えない）
function _cstEqualLength(s1, s2) {
  if (!s1 || !s2 || s1.type !== "line" || s2.type !== "line") return 0;
  const len1 = Math.hypot(s1.x2 - s1.x1, s1.y2 - s1.y1);
  const len2 = Math.hypot(s2.x2 - s2.x1, s2.y2 - s2.y1);
  const avg = (len1 + len2) / 2;

  let residual = 0;
  residual += _setLineLength(s1, avg);
  residual += _setLineLength(s2, avg);
  return residual;
}

function _setLineLength(s, targetLen) {
  const dx = s.x2 - s.x1,
    dy = s.y2 - s.y1;
  const cur = Math.hypot(dx, dy);
  if (cur < 1e-6) return 0;
  const scale = targetLen / cur;
  const cx = (s.x1 + s.x2) / 2,
    cy = (s.y1 + s.y2) / 2;
  const prevX1 = s.x1,
    prevY1 = s.y1;
  s.x1 = cx - (dx * scale) / 2;
  s.y1 = cy - (dy * scale) / 2;
  s.x2 = cx + (dx * scale) / 2;
  s.y2 = cy + (dy * scale) / 2;
  return Math.hypot(s.x1 - prevX1, s.y1 - prevY1);
}

// fixed: shape の位置を固定する
// params: { x, y } は real units（shape 座標系）
function _cstFixed(s, params) {
  if (!s) return 0;
  if (params && params.x !== undefined && params.y !== undefined) {
    const bb = getShapeBBox(s, { numerator: REAL_PER_MM, denominator: 1 });
    if (!bb) return 0;
    const residual = Math.hypot(bb.x - params.x, bb.y - params.y);
    shiftShape(s, params.x - bb.x, params.y - bb.y);
    return residual;
  }
  return 0;
}

// coincident: 2つの端点を一致させる
// params: { point1: "start"|"end", point2: "start"|"end" }
// デフォルト: s1 の end と s2 の start を一致
function _cstCoincident(s1, s2, params) {
  if (!s1 || !s2) return 0;
  const p1key = params?.point1 || "end";
  const p2key = params?.point2 || "start";

  const pt1 = _getEndpoint(s1, p1key);
  const pt2 = _getEndpoint(s2, p2key);
  if (!pt1 || !pt2) return 0;

  // 2点の中点に移動
  const mx = (pt1.x + pt2.x) / 2;
  const my = (pt1.y + pt2.y) / 2;
  const residual = Math.hypot(pt1.x - mx, pt1.y - my) * 2;

  _setEndpoint(s1, p1key, mx, my);
  _setEndpoint(s2, p2key, mx, my);
  return residual;
}

// symmetric: 2点を指定軸に対して対称にする
// params: { axis: "x"|"y", value: number } — value は real units
function _cstSymmetric(s1, s2, params, page) {
  if (!s1 || !s2) return 0;
  const realScale = { numerator: REAL_PER_MM, denominator: 1 };
  const axis = params?.axis || "y";
  const axisValue = params?.value ?? 0;

  const bb1 = getShapeBBox(s1, realScale);
  const bb2 = getShapeBBox(s2, realScale);
  if (!bb1 || !bb2) return 0;

  if (axis === "y") {
    const cy2 = bb2.y + bb2.h / 2;
    const target1 = 2 * axisValue - cy2;
    shiftShape(s1, 0, target1 - (bb1.y + bb1.h / 2));
    const bb1b = getShapeBBox(s1, realScale);
    const cy1 = bb1b.y + bb1b.h / 2;
    const target2 = 2 * axisValue - cy1;
    const residual = Math.abs(cy1 - target1) + Math.abs(cy2 - target2);
    shiftShape(s2, 0, target2 - cy2);
    return residual;
  } else {
    const cx2 = bb2.x + bb2.w / 2;
    const target1 = 2 * axisValue - cx2;
    shiftShape(s1, target1 - (bb1.x + bb1.w / 2), 0);
    const bb1b = getShapeBBox(s1, realScale);
    const cx1 = bb1b.x + bb1b.w / 2;
    const target2 = 2 * axisValue - cx1;
    const residual = Math.abs(cx1 - target1) + Math.abs(cx2 - target2);
    shiftShape(s2, target2 - cx2, 0);
    return residual;
  }
}

// ── 端点ヘルパー ─────────────────────────────────────────────

function _getEndpoint(s, which) {
  if (s.type === "line") {
    return which === "start" ? { x: s.x1, y: s.y1 } : { x: s.x2, y: s.y2 };
  }
  if (s.type === "rect") {
    return { x: s.x, y: s.y };
  }
  if (s.type === "circle") {
    return { x: s.cx, y: s.cy };
  }
  if (s.type === "ellipse") {
    return { x: s.cx, y: s.cy };
  }
  if (s.type === "bezier" && s.nodes?.length) {
    const node = which === "start" ? s.nodes[0] : s.nodes[s.nodes.length - 1];
    return { x: node.x, y: node.y };
  }
  return null;
}

function _setEndpoint(s, which, x, y) {
  if (s.type === "line") {
    if (which === "start") {
      s.x1 = x;
      s.y1 = y;
    } else {
      s.x2 = x;
      s.y2 = y;
    }
  } else if (s.type === "bezier" && s.nodes?.length) {
    const node = which === "start" ? s.nodes[0] : s.nodes[s.nodes.length - 1];
    node.x = x;
    node.y = y;
  }
}

// ── 拘束の検証（矛盾チェック） ────────────────────────────────
// 現在のページの拘束が全て満たされているか確認する
// 戻り値: [{ constraint, residual }] — 満たされていないもののリスト

function validateConstraints(page) {
  if (!page) page = getCurrentPage();
  const constraints = page.constraints || [];
  const violations = [];

  for (const c of constraints) {
    // 一時コピーに適用して残差を計算
    const shapes = c.shapeIds
      .map((id) => _findShapeOnPage(id, page))
      .filter(Boolean);
    if (!shapes.length) continue;

    // 残差を計算（実際には shape を変更してしまうため、適用後に測定）
    // 簡易チェック: 拘束適用前後の座標差
    const snapshots = shapes.map((s) => JSON.stringify(s));
    const residual = _applyOneConstraint(c, page);

    // 座標が動いていれば違反
    const moved = shapes.some((s, i) => JSON.stringify(s) !== snapshots[i]);
    if (moved || residual > CONSTRAINT_TOL) {
      violations.push({ constraint: c, residual });
    }
  }

  return violations;
}

// ── applyDrawingCommands 拡張用アクション ────────────────────
// commands.js の applyDrawingCommands から呼ばれる想定

function _handleConstraintCommand(cmd) {
  switch (cmd.action) {
    case "addConstraint":
      return addConstraint(cmd.constraint);
    case "removeConstraint":
      return removeConstraint(cmd.id);
    case "applyConstraints":
      applyConstraints();
      return true;
    default:
      return null;
  }
}
