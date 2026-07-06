"use strict";

// Z-order: move shape up (toward front) or down (toward back) within its layer
function moveShapeZOrder(id, direction) {
  const res = findShapeById(id);
  if (!res) return;
  const shapes = res.layer.shapes;
  const idx = shapes.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const newIdx = direction === "up" ? idx + 1 : idx - 1;
  if (newIdx < 0 || newIdx >= shapes.length) return;
  [shapes[idx], shapes[newIdx]] = [shapes[newIdx], shapes[idx]];
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("図形の重なり順変更");
}

function reorderSelectionZ(ids, mode) {
  if (!ids?.length) return false;
  const entries = ids
    .map((id) => findShapeById(id))
    .filter((r) => r && !r.isDimension && !r.layer?.locked);
  if (!entries.length) return false;

  const byLayer = new Map();
  for (const r of entries) {
    if (!byLayer.has(r.layer)) byLayer.set(r.layer, []);
    byLayer.get(r.layer).push(r.shape.id);
  }

  let changed = false;
  for (const [, layerIds] of byLayer) {
    const layer = entries.find((r) => layerIds.includes(r.shape.id))?.layer;
    if (!layer) continue;
    const shapes = layer.shapes;
    const idSet = new Set(layerIds);
    if (mode === "front" || mode === "back") {
      const extracted = shapes.filter((s) => idSet.has(s.id));
      if (!extracted.length) continue;
      const rest = shapes.filter((s) => !idSet.has(s.id));
      layer.shapes =
        mode === "front" ? [...rest, ...extracted] : [...extracted, ...rest];
      changed = true;
      continue;
    }
    if (mode === "up") {
      for (let i = shapes.length - 2; i >= 0; i--) {
        if (idSet.has(shapes[i].id) && !idSet.has(shapes[i + 1].id)) {
          [shapes[i], shapes[i + 1]] = [shapes[i + 1], shapes[i]];
          changed = true;
        }
      }
    } else if (mode === "down") {
      for (let i = 1; i < shapes.length; i++) {
        if (idSet.has(shapes[i].id) && !idSet.has(shapes[i - 1].id)) {
          [shapes[i], shapes[i - 1]] = [shapes[i - 1], shapes[i]];
          changed = true;
        }
      }
    }
  }
  if (changed) {
    if (typeof markDocumentDirty === "function") markDocumentDirty();
    pushHistory("図形の重なり順変更");
  }
  return changed;
}

// 縦/横寸法は計測軸に揃える。vertical は to.x = from.x、horizontal は to.y = from.y。
// 作図時のクリックずれや MCP からの非整列入力で寸法線が斜めにならないよう正規化する。
function normalizeDimensionGeometry(dim) {
  if (!dim || dim.type !== "dimension" || !dim.from || !dim.to) return dim;
  if (dim.dimensionType === "vertical") {
    dim.to.x = dim.from.x;
  } else if (dim.dimensionType === "horizontal") {
    dim.to.y = dim.from.y;
  }
  return dim;
}

function addShape(shape) {
  // 寸法線はページ直属の dimensions[] に格納する（layer.shapes には入れない）
  // これにより Profile抽出・boolean演算・3D生成が寸法線を自動的に無視できる
  if (shape.type === "dimension") {
    normalizeDimensionGeometry(shape);
    const page = getCurrentPage();
    if (!page.dimensions) page.dimensions = [];
    page.dimensions.push(shape);
    if (typeof markShapeDirty === "function") markShapeDirty(shape.id);
    pushHistory("寸法線追加");
    return true;
  }
  const layer = getCurrentLayer();
  if (layer.locked) return false;
  layer.shapes.push(shape);
  if (shape.type === "text") onTextShapeDocumentChanged(shape.id);
  if (typeof markShapeDirty === "function") markShapeDirty(shape.id);
  pushHistory(`図形追加 (${shape.type})`);
  return true;
}
// 図形単位のロック切替（updateShape のロックガードを迂回する専用ルート）
function setShapeLocked(id, locked) {
  const res = findShapeById(id);
  if (!res || res.isDimension) return false;
  res.shape.locked = !!locked;
  if (locked) {
    const sel = getState().selectedShapeIds;
    const idx = sel.indexOf(id);
    if (idx !== -1) sel.splice(idx, 1);
  }
  if (typeof markShapeDirty === "function") markShapeDirty(id);
  pushHistory(locked ? "図形ロック" : "図形ロック解除");
  return true;
}

function updateShape(id, values) {
  const res = findShapeById(id);
  if (!res) return false;
  if (!res.isDimension && res.layer?.locked) return false;
  if (!res.isDimension && res.shape.locked) return false;
  const trackTextPreview = res.shape.type === "text";
  const dimValueEdit =
    res.isDimension &&
    Object.prototype.hasOwnProperty.call(values, "value") &&
    typeof values.value === "number" &&
    !isNaN(values.value);
  const prevRealDistance = dimValueEdit ? dimensionRealDistance(res.shape) : 0;
  for (const [key, val] of Object.entries(values)) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let obj = res.shape;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = val;
    } else {
      res.shape[key] = val;
    }
  }
  if (res.isDimension) normalizeDimensionGeometry(res.shape);
  if (dimValueEdit) {
    _applyDimensionValueToGeometry(res.shape, res.page, prevRealDistance);
  }
  // 拘束を再適用して幾何的整合性を保つ
  applyConstraints(res.page);
  if (trackTextPreview) {
    onTextShapeDocumentChanged(id, Object.keys(values));
  }
  if (typeof markShapeDirty === "function") markShapeDirty(id);
  pushHistory("図形更新");
  return true;
}

// ── 寸法値ドリブン編集 ───────────────────────────────────────
// 寸法線のオーバーライド値を編集すると、その寸法の "to" 端点が実際の図形の
// 頂点と一致している場合に限り、その頂点を新しい距離に合わせて動かす。
// "from" 側は常にアンカーとして固定する。一致する頂点が見つからない場合は
// 従来どおり表示上の上書き値のままになる（幾何は変わらない）。
const DIM_GEOMETRY_MATCH_TOL = 0.5; // real units（≈0.05mm）

function _applyDimensionValueToGeometry(dim, page, prevRealDistance) {
  const newRealDistance = mmToReal(dim.value);
  if (!isFinite(newRealDistance)) return;
  const deltaDistance = newRealDistance - prevRealDistance;
  if (Math.abs(deltaDistance) < 1e-6) return;
  const axis = dim.dimensionType === "horizontal" ? "x" : "y";
  const sign = Math.sign(dim.to[axis] - dim.from[axis]) || 1;
  const deltaCoord = sign * deltaDistance;
  const targetPoint = { x: dim.to.x, y: dim.to.y };
  const anchorPoint = { x: dim.from.x, y: dim.from.y };
  const moved = _moveVertexNear(
    page,
    targetPoint,
    anchorPoint,
    axis,
    deltaCoord,
  );
  if (moved) dim.to[axis] += deltaCoord;
}

function _moveVertexNear(page, pt, anchorPt, axis, delta) {
  for (const layer of page.layers) {
    if (layer.locked) continue;
    for (const shape of layer.shapes) {
      if (shape.locked) continue;
      if (_tryMoveShapeVertex(shape, pt, anchorPt, axis, delta)) return true;
    }
  }
  return false;
}

// shape の "to" 側頂点を動かす。ただし移動後に "from"（アンカー）側が一致していた
// 頂点の位置がずれてしまう場合は、幾何的整合性が壊れるため何もしない（false を返す）。
// 例: 円の直径を両象限点で寸法指定している場合、半径だけを動かすと反対側の象限点が
// 動いてしまい "from" と食い違う → その場合は表示上の上書き値のままにフォールバックする。
function _tryMoveShapeVertex(shape, pt, anchorPt, axis, delta) {
  // アンカーがこの shape の頂点と(移動前から)一致していた場合のみ、移動後も
  // 一致し続けているかを検証する。無関係な shape ならチェック不要。
  const anchorWasCoincident = anchorPt
    ? _findVertexNear(shape, anchorPt)
    : false;
  const before = anchorWasCoincident ? JSON.stringify(shape) : null;
  const ok = _mutateShapeVertex(shape, pt, axis, delta);
  if (!ok) return false;
  if (anchorWasCoincident && !_findVertexNear(shape, anchorPt)) {
    Object.assign(shape, JSON.parse(before));
    return false;
  }
  return true;
}

// anchorPt 近傍に一致する頂点が現在の shape 上に存在するかを確認する
// （_tryMoveShapeVertex の整合性チェック用）。
function _findVertexNear(shape, anchorPt) {
  const near = (x, y) =>
    Math.hypot(x - anchorPt.x, y - anchorPt.y) <= DIM_GEOMETRY_MATCH_TOL;
  if (shape.type === "line") {
    return near(shape.x1, shape.y1) || near(shape.x2, shape.y2);
  }
  if (shape.type === "bezier" && shape.nodes?.length) {
    const first = shape.nodes[0];
    const last = shape.nodes[shape.nodes.length - 1];
    return near(first.x, first.y) || near(last.x, last.y);
  }
  if (shape.type === "rect") {
    const { x, y, width: w, height: h } = shape;
    return near(x, y) || near(x + w, y) || near(x, y + h) || near(x + w, y + h);
  }
  if (shape.type === "circle") {
    const { cx, cy, r } = shape;
    return (
      near(cx, cy) ||
      near(cx + r, cy) ||
      near(cx - r, cy) ||
      near(cx, cy - r) ||
      near(cx, cy + r)
    );
  }
  return false;
}

function _mutateShapeVertex(shape, pt, axis, delta) {
  const near = (x, y) =>
    Math.hypot(x - pt.x, y - pt.y) <= DIM_GEOMETRY_MATCH_TOL;
  if (shape.type === "line") {
    if (near(shape.x1, shape.y1)) {
      if (axis === "x") shape.x1 += delta;
      else shape.y1 += delta;
      return true;
    }
    if (near(shape.x2, shape.y2)) {
      if (axis === "x") shape.x2 += delta;
      else shape.y2 += delta;
      return true;
    }
    return false;
  }
  if (shape.type === "bezier" && shape.nodes?.length) {
    const first = shape.nodes[0];
    const last = shape.nodes[shape.nodes.length - 1];
    if (near(first.x, first.y)) {
      if (axis === "x") first.x += delta;
      else first.y += delta;
      return true;
    }
    if (near(last.x, last.y)) {
      if (axis === "x") last.x += delta;
      else last.y += delta;
      return true;
    }
    return false;
  }
  if (shape.type === "rect") {
    const { x, y, width: w, height: h } = shape;
    // アンカー角（x,y）: 常に平行移動として扱う
    if (near(x, y)) {
      if (axis === "x") shape.x += delta;
      else shape.y += delta;
      return true;
    }
    // 右上角: x 軸編集は幅、y 軸はアンカーと共有のため対象外
    if (near(x + w, y)) {
      if (axis === "x") shape.width = Math.max(0.01, w + delta);
      else return false;
      return true;
    }
    // 左下角: y 軸編集は高さ、x 軸はアンカーと共有のため対象外
    if (near(x, y + h)) {
      if (axis === "y") shape.height = Math.max(0.01, h + delta);
      else return false;
      return true;
    }
    // 右下角: 幅・高さともに編集可能
    if (near(x + w, y + h)) {
      if (axis === "x") shape.width = Math.max(0.01, w + delta);
      else shape.height = Math.max(0.01, h + delta);
      return true;
    }
    return false;
  }
  if (shape.type === "circle") {
    const { cx, cy, r } = shape;
    if (near(cx, cy)) {
      if (axis === "x") shape.cx += delta;
      else shape.cy += delta;
      return true;
    }
    // 象限点: 中心と共有しない軸のみ半径編集として扱う
    if (near(cx + r, cy)) {
      if (axis === "x") shape.r = Math.max(0.01, r + delta);
      else return false;
      return true;
    }
    if (near(cx - r, cy)) {
      if (axis === "x") shape.r = Math.max(0.01, r - delta);
      else return false;
      return true;
    }
    if (near(cx, cy - r)) {
      if (axis === "y") shape.r = Math.max(0.01, r - delta);
      else return false;
      return true;
    }
    if (near(cx, cy + r)) {
      if (axis === "y") shape.r = Math.max(0.01, r + delta);
      else return false;
      return true;
    }
    return false;
  }
  return false;
}

// path shape の全頂点にフィレット/チャンファーを焼き込む一発コマンド。
// radiusMm: mm 単位。mode: "round" | "chamfer"
function applyFilletToPath(id, radiusMm, mode) {
  const res = findShapeById(id);
  if (!res || res.isDimension || res.shape.type !== "path") return false;
  if (res.layer?.locked || res.shape.locked) return false;
  const radius = mmToReal(radiusMm);
  const ok = applyFilletToPathShape(res.shape, radius, mode);
  if (!ok) return false;
  if (typeof markShapeDirty === "function") markShapeDirty(id);
  pushHistory(mode === "chamfer" ? "面取り" : "フィレット");
  return true;
}

function deleteShape(id) {
  invalidateTextNativePreview(id);
  const res = findShapeById(id);
  if (!res) return false;
  if (!res.isDimension && res.shape.locked) return false;
  if (res.isDimension) {
    const dims = res.page.dimensions;
    const idx = dims.indexOf(res.shape);
    if (idx !== -1) dims.splice(idx, 1);
  } else {
    const idx = res.layer.shapes.indexOf(res.shape);
    if (idx !== -1) res.layer.shapes.splice(idx, 1);
  }
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory(res.isDimension ? "寸法線削除" : "図形削除");
  return true;
}
function deleteSelectedShapes() {
  const ids = [...getState().selectedShapeIds];
  for (const id of ids) {
    const res = findShapeById(id);
    if (!res) continue;
    if (res.isDimension) {
      const dims = res.page.dimensions;
      const idx = dims.indexOf(res.shape);
      if (idx !== -1) dims.splice(idx, 1);
    } else {
      if (res.shape.locked) continue;
      const idx = res.layer.shapes.indexOf(res.shape);
      if (idx !== -1) res.layer.shapes.splice(idx, 1);
    }
  }
  getState().selectedShapeIds = [];
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory();
}

let _clipboard = [];

function hasClipboard() {
  return _clipboard.length > 0;
}

function cutShapes() {
  if (!getState().selectedShapeIds.length) return;
  copyShapes();
  deleteSelectedShapes();
}

function shiftShape(shape, dx, dy) {
  if (shape.type === "line") {
    shape.x1 += dx;
    shape.y1 += dy;
    shape.x2 += dx;
    shape.y2 += dy;
  } else if (
    shape.type === "rect" ||
    shape.type === "image" ||
    shape.type === "text" ||
    shape.type === "rawpath"
  ) {
    shape.x += dx;
    shape.y += dy;
    if (shape.type === "rawpath") {
      shape.bx += dx;
      shape.by += dy;
    }
  } else if (shape.type === "circle") {
    shape.cx += dx;
    shape.cy += dy;
  } else if (shape.type === "ellipse") {
    shape.cx += dx;
    shape.cy += dy;
  } else if (shape.type === "dimension") {
    shape.from = { x: shape.from.x + dx, y: shape.from.y + dy };
    shape.to = { x: shape.to.x + dx, y: shape.to.y + dy };
  } else if (shape.type === "bezier") {
    shape.nodes = shape.nodes.map((n) => ({
      ...n,
      x: n.x + dx,
      y: n.y + dy,
      h1: n.h1 ? { x: n.h1.x + dx, y: n.h1.y + dy } : null,
      h2: n.h2 ? { x: n.h2.x + dx, y: n.h2.y + dy } : null,
    }));
  } else if (shape.type === "path") {
    shape.contours = shape.contours.map((poly) =>
      poly.map((ring) => ring.map(([x, y]) => [x + dx, y + dy])),
    );
  } else if (shape.type === "pencil") {
    shape.points = (shape.points || []).map((pt) => ({
      x: pt.x + dx,
      y: pt.y + dy,
    }));
  } else if (shape.type === "group") {
    for (const child of shape.children) shiftShape(child, dx, dy);
  }
}

function cloneSelectedShapes(dx, dy) {
  const state = getState();
  if (!state.selectedShapeIds.length) return [];
  const layer = getCurrentLayer();
  const page = getCurrentPage();
  const newIds = [];
  for (const id of state.selectedShapeIds) {
    const res = findShapeById(id);
    if (!res) continue;
    const clone = JSON.parse(JSON.stringify(res.shape));
    clone.id = genId("shape");
    if (dx || dy) shiftShape(clone, dx, dy);
    // 寸法線クローンは dimensions[] へ、それ以外は layer.shapes[] へ
    if (res.isDimension) {
      if (!page.dimensions) page.dimensions = [];
      page.dimensions.push(clone);
    } else {
      layer.shapes.push(clone);
    }
    newIds.push(clone.id);
  }
  return newIds;
}

// 直前の複製オフセット（real units）。Alt+ドラッグ複製の確定時に記録され、
// ⌘D が同じ変位を繰り返す（Illustrator の「変形の繰り返し」相当）。
let _lastDuplicateOffset = null;

function setLastDuplicateOffset(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if (dx === 0 && dy === 0) return;
  _lastDuplicateOffset = { dx, dy };
}

function duplicateShapes() {
  const dx = _lastDuplicateOffset ? _lastDuplicateOffset.dx : mmToReal(10);
  const dy = _lastDuplicateOffset ? _lastDuplicateOffset.dy : mmToReal(10);
  const newIds = cloneSelectedShapes(dx, dy);
  if (!newIds.length) return;
  getState().selectedShapeIds = newIds;
  pushHistory();
}

// ── 配列複製 ─────────────────────────────────────────────────
//
// options.mode: "linear" | "polar" | "grid"
//
// linear: 直線配列
//   count: 複製数（元を含まない）
//   dx, dy: 各ステップの移動量 (real units)
//
// polar: 円形配列
//   count: 複製数（元を含まない）
//   cx, cy: 回転中心 (real units)
//   angle: ステップ角度 (度)。省略すると 360/count で等分
//
// grid: グリッド配列
//   cols: 列数（X方向）
//   rows: 行数（Y方向）
//   dx, dy: セル間隔 (real units)
//   ※ 元の位置が (0,0) セルになる
//
function arrayDuplicate(options = {}) {
  const state = getState();
  const srcIds = [...state.selectedShapeIds];
  if (!srcIds.length) return [];

  const layer = getCurrentLayer();
  const page = getCurrentPage();
  const allNewIds = [];

  // 元 shapes のスナップショットを取得
  const srcShapes = srcIds
    .map((id) => {
      const res = findShapeById(id);
      return res
        ? { ...res, snapshot: JSON.parse(JSON.stringify(res.shape)) }
        : null;
    })
    .filter(Boolean);

  const {
    mode = "linear",
    count = 3,
    dx = 0,
    dy = 0,
    cx = 0,
    cy = 0,
    angle,
    cols = 3,
    rows = 3,
  } = options;

  function placeClones(transforms) {
    // transforms: [{ dx, dy, rot? }] — 元位置からの変位リスト（元は含まない）
    for (const tr of transforms) {
      for (const src of srcShapes) {
        const clone = JSON.parse(JSON.stringify(src.snapshot));
        clone.id = genId("shape");

        if (tr.rot !== undefined) {
          // 極座標回転: 中心 (cx,cy) まわりに回転してから移動
          _rotateShapeAround(clone, cx, cy, tr.rot);
        } else {
          shiftShape(clone, tr.dx, tr.dy);
        }

        if (src.isDimension) {
          if (!page.dimensions) page.dimensions = [];
          page.dimensions.push(clone);
        } else {
          layer.shapes.push(clone);
        }
        allNewIds.push(clone.id);
      }
    }
  }

  if (mode === "linear") {
    const transforms = [];
    for (let i = 1; i <= count; i++) {
      transforms.push({ dx: dx * i, dy: dy * i });
    }
    placeClones(transforms);
  } else if (mode === "polar") {
    const stepAngle = angle !== undefined ? angle : 360 / (count + 1);
    const transforms = [];
    for (let i = 1; i <= count; i++) {
      transforms.push({ rot: (stepAngle * i * Math.PI) / 180, dx: 0, dy: 0 });
    }
    placeClones(transforms);
  } else if (mode === "grid") {
    const transforms = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 0 && c === 0) continue; // 元の位置はスキップ
        transforms.push({ dx: dx * c, dy: dy * r });
      }
    }
    placeClones(transforms);
  }

  if (allNewIds.length) {
    state.selectedShapeIds = allNewIds;
    pushHistory();
  }
  return allNewIds;
}

// 点 (cx, cy) を中心に shape を角度 angleRad だけ回転する
function _rotateShapeAround(shape, cx, cy, angleRad) {
  const cos = Math.cos(angleRad),
    sin = Math.sin(angleRad);
  function rot(x, y) {
    const nx = cx + (x - cx) * cos - (y - cy) * sin;
    const ny = cy + (x - cx) * sin + (y - cy) * cos;
    return { x: nx, y: ny };
  }
  if (
    shape.type === "rect" ||
    shape.type === "image" ||
    shape.type === "text"
  ) {
    const p = rot(shape.x, shape.y);
    shape.x = p.x;
    shape.y = p.y;
    shape.rotation = ((shape.rotation || 0) + (angleRad * 180) / Math.PI) % 360;
  } else if (shape.type === "circle") {
    const p = rot(shape.cx, shape.cy);
    shape.cx = p.x;
    shape.cy = p.y;
  } else if (shape.type === "ellipse") {
    const p = rot(shape.cx, shape.cy);
    shape.cx = p.x;
    shape.cy = p.y;
  } else if (shape.type === "line") {
    const p1 = rot(shape.x1, shape.y1),
      p2 = rot(shape.x2, shape.y2);
    shape.x1 = p1.x;
    shape.y1 = p1.y;
    shape.x2 = p2.x;
    shape.y2 = p2.y;
  } else if (shape.type === "bezier" && shape.nodes) {
    shape.nodes = shape.nodes.map((n) => {
      const p = rot(n.x, n.y);
      return {
        ...n,
        x: p.x,
        y: p.y,
        h1: n.h1 ? rot(n.h1.x, n.h1.y) : null,
        h2: n.h2 ? rot(n.h2.x, n.h2.y) : null,
      };
    });
  } else {
    // fallback: shift+rotation プロパティ
    const bb = getShapeBBox(shape, { numerator: 1, denominator: 1 });
    if (bb) {
      const center = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
      const p = rot(center.x, center.y);
      shiftShape(shape, p.x - center.x, p.y - center.y);
    }
    shape.rotation = ((shape.rotation || 0) + (angleRad * 180) / Math.PI) % 360;
  }
}

function copyShapes() {
  const state = getState();
  _clipboard = [];
  for (const id of state.selectedShapeIds) {
    const res = findShapeById(id);
    if (res) _clipboard.push(JSON.parse(JSON.stringify(res.shape)));
  }
}

function pasteShapes() {
  if (!_clipboard.length) return;
  const layer = getCurrentLayer();
  const offset = mmToReal(10);
  const newIds = [];
  for (const shape of _clipboard) {
    const clone = JSON.parse(JSON.stringify(shape));
    clone.id = genId("shape");
    shiftShape(clone, offset, offset);
    layer.shapes.push(clone);
    newIds.push(clone.id);
  }
  _clipboard = newIds
    .map((id) => {
      const res = findShapeById(id);
      return res ? JSON.parse(JSON.stringify(res.shape)) : null;
    })
    .filter(Boolean);
  getState().selectedShapeIds = newIds;
  pushHistory();
}

function arcPoints(cx, cy, r, startAngle, endAngle, N = 32) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const a = startAngle + ((endAngle - startAngle) * i) / N;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function roundedRectToRing(x, y, w, h, tl, tr, br, bl) {
  const N = 32;
  tl = Math.min(tl, w / 2, h / 2);
  tr = Math.min(tr, w / 2, h / 2);
  br = Math.min(br, w / 2, h / 2);
  bl = Math.min(bl, w / 2, h / 2);
  const pts = [];
  if (tl > 0)
    pts.push(...arcPoints(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5, N));
  else pts.push([x, y]);
  if (tr > 0)
    pts.push(
      ...arcPoints(x + w - tr, y + tr, tr, Math.PI * 1.5, Math.PI * 2, N),
    );
  else pts.push([x + w, y]);
  if (br > 0)
    pts.push(...arcPoints(x + w - br, y + h - br, br, 0, Math.PI * 0.5, N));
  else pts.push([x + w, y + h]);
  if (bl > 0)
    pts.push(...arcPoints(x + bl, y + h - bl, bl, Math.PI * 0.5, Math.PI, N));
  else pts.push([x, y + h]);
  return pts;
}

function shapeToPolygon(shape) {
  if (shape.type === "rect") {
    const { x, y, width: w, height: h } = shape;
    if (shape.rxMode === "individual") {
      const tl = shape.rxTL ?? 0,
        tr = shape.rxTR ?? 0,
        br = shape.rxBR ?? 0,
        bl = shape.rxBL ?? 0;
      if (tl || tr || br || bl)
        return roundedRectToRing(x, y, w, h, tl, tr, br, bl);
    } else if (shape.rx) {
      const r = shape.rx;
      return roundedRectToRing(x, y, w, h, r, r, r, r);
    }
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  if (shape.type === "circle") {
    const { cx, cy, r } = shape;
    const N = 128;
    return Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i) / N;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  }
  if (shape.type === "ellipse") {
    const { cx, cy, rx, ry } = shape;
    const N = 128;
    return Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i) / N;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });
  }
  if (shape.type === "path") {
    return shape.contours[0]?.[0] ?? null;
  }
  return null;
}

function shapeToClipPolygon(shape) {
  let multipoly = null;
  // shapeToProfileRings は rotation/flipH/flipV を輪郭に適用済みで返すため、
  // その経路の図形は二重変換しない（path の生 contours のみ明示変換が要る）。
  let alreadyTransformed = false;
  if (shape.type === "path") {
    multipoly = shape.contours?.length ? shape.contours : null;
  } else if (shape.type === "group") {
    return null;
  } else {
    const rings = shapeToProfileRings(shape);
    if (rings?.length) {
      multipoly = [rings];
      alreadyTransformed = true;
    }
  }
  if (!multipoly) return null;
  // rotation / flipH / flipV は描画上の見た目だけの変換だが、ブール演算は
  // 実ジオメトリ（未変換の輪郭）で行うため、回転した図形を結合すると結果が
  // 0°（未回転）に戻ってしまう。見た目どおりの結果にするため、描画と同じ
  // ピボット・順序（rotate → flip）で変換を輪郭へ焼き込む。元配列は壊さない。
  if (alreadyTransformed || !hasVisualTransform(shape)) return multipoly;
  return multipoly.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([x, y]) => applyShapeTransformReal(x, y, shape)),
    ),
  );
}

function _booleanStyleFromShape(refShape) {
  return {
    stroke: refShape?.stroke || refShape?.color || "#1a1a2e",
    strokeWidth: refShape?.strokeWidth || refShape?.lineWidth || "thin",
    fill: refShape?.fill ?? "none",
  };
}

function _ringSignedArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

function _normalizePolygonRings(polygon) {
  if (!polygon?.length) return polygon;
  const outerSign = Math.sign(_ringSignedArea(polygon[0])) || 1;
  return polygon.map((ring, i) => {
    const sign = Math.sign(_ringSignedArea(ring)) || 1;
    const wantSign = i === 0 ? outerSign : -outerSign;
    return sign === wantSign ? ring : ring.slice().reverse();
  });
}

function _normalizeContours(contours) {
  return contours.map((polygon) => _normalizePolygonRings(polygon));
}

function _expandBooleanEntries(entries) {
  const expanded = [];
  for (const entry of entries) {
    if (entry.shape.type === "group") {
      for (const child of entry.shape.children) {
        if (child.type === "group") {
          expanded.push(..._expandBooleanEntries([{ ...entry, shape: child }]));
          continue;
        }
        const poly = shapeToClipPolygon(child);
        if (poly) expanded.push({ ...entry, shape: child, poly });
      }
      continue;
    }
    const poly = shapeToClipPolygon(entry.shape);
    if (poly) expanded.push({ ...entry, poly });
  }
  return expanded;
}

function _unionEntryPolys(entries) {
  const polys = entries.map((entry) => entry.poly).filter(Boolean);
  if (!polys.length) return null;
  if (polys.length === 1) return polys[0];
  return polygonClipping.union(...polys);
}

function _runBooleanClip(op, polys) {
  if (!polys.length) return null;
  if (op === "union") return polygonClipping.union(...polys);
  if (op === "intersection") return polygonClipping.intersection(...polys);
  if (op === "exclude") {
    if (polys.length === 1) return polys[0];
    return polygonClipping.xor(...polys);
  }
  return null;
}

function _findSelectedShapeEntries(ids, page) {
  const entries = [];
  for (const layer of page.layers) {
    for (let i = 0; i < layer.shapes.length; i++) {
      const shape = layer.shapes[i];
      if (ids.includes(shape.id)) {
        entries.push({ shape, layer, index: i });
      }
    }
  }
  return entries;
}

function _lowestZOrderEntry(entries) {
  let best = null;
  let bestIdx = Infinity;
  for (const entry of entries) {
    if (entry.index < bestIdx) {
      bestIdx = entry.index;
      best = entry;
    }
  }
  return best;
}

function _replaceSelectedWithPath(ids, page, contours, refShape, anchorEntry) {
  const insertLayer = anchorEntry.layer;
  let insertIdx = anchorEntry.index;
  for (const id of ids) {
    for (const layer of page.layers) {
      const idx = layer.shapes.findIndex((s) => s.id === id);
      if (idx !== -1) {
        if (layer === insertLayer && idx < insertIdx) insertIdx--;
        layer.shapes.splice(idx, 1);
        break;
      }
    }
  }
  if (insertLayer.locked) return null;
  const newShape = {
    id: genId("path"),
    type: "path",
    contours,
    ..._booleanStyleFromShape(refShape),
  };
  insertLayer.shapes.splice(insertIdx, 0, newShape);
  if (typeof markShapeDirty === "function") markShapeDirty(newShape.id);
  return newShape;
}

function booleanSelectedShapes(op) {
  const state = getState();
  const ids = [...state.selectedShapeIds];
  if (ids.length < 2) return false;
  const page = getCurrentPage();

  const entries = _findSelectedShapeEntries(ids, page);
  const expanded = _expandBooleanEntries(entries);
  if (expanded.length < 2) return false;

  const polys = expanded.map((entry) => entry.poly);
  let result;
  try {
    if (op === "subtract") {
      const base = _lowestZOrderEntry(entries);
      let basePoly;
      let cuts;
      if (base.shape.type === "group") {
        const childIds = new Set(base.shape.children.map((child) => child.id));
        basePoly = _unionEntryPolys(
          expanded.filter((entry) => childIds.has(entry.shape.id)),
        );
        cuts = expanded
          .filter((entry) => !childIds.has(entry.shape.id))
          .map((entry) => entry.poly);
      } else {
        basePoly = shapeToClipPolygon(base.shape);
        cuts = expanded
          .filter((entry) => entry.shape.id !== base.shape.id)
          .map((entry) => entry.poly);
      }
      if (!basePoly) return false;
      if (!cuts.length) return false;
      result = polygonClipping.difference(basePoly, ...cuts);
    } else {
      result = _runBooleanClip(op, polys);
    }
  } catch (e) {
    console.error(`boolean ${op} failed`, e);
    return false;
  }
  if (!result?.length) return false;
  result = _normalizeContours(result);

  const anchorEntry = _lowestZOrderEntry(entries);
  const refShape = expanded[0]?.shape || anchorEntry.shape;
  const newShape = _replaceSelectedWithPath(
    ids,
    page,
    result,
    refShape,
    anchorEntry,
  );
  if (!newShape) return false;
  state.selectedShapeIds = [newShape.id];
  pushHistory();
  return true;
}

function mergeSelectedShapes() {
  return booleanSelectedShapes("union");
}

function unionSelectedShapes() {
  return mergeSelectedShapes();
}

function subtractSelectedShapes() {
  return booleanSelectedShapes("subtract");
}

function intersectSelectedShapes() {
  return booleanSelectedShapes("intersection");
}

function excludeSelectedShapes() {
  return booleanSelectedShapes("exclude");
}

function flattenSelectedShapes() {
  const state = getState();
  const ids = [...state.selectedShapeIds];
  if (!ids.length) return false;
  const page = getCurrentPage();

  const entries = _findSelectedShapeEntries(ids, page);
  if (!entries.length) return false;

  const polys = [];
  let refShape = null;
  for (const entry of entries) {
    if (!refShape) refShape = entry.shape;
    if (entry.shape.type === "group") {
      for (const child of entry.shape.children) {
        const poly = shapeToClipPolygon(child);
        if (poly) polys.push(poly);
      }
    } else {
      const poly = shapeToClipPolygon(entry.shape);
      if (poly) polys.push(poly);
    }
  }
  if (!polys.length) return false;

  let result;
  try {
    result = polys.length === 1 ? polys[0] : polygonClipping.union(...polys);
  } catch (e) {
    console.error("flatten failed", e);
    return false;
  }
  if (!result?.length) return false;

  const anchorEntry = _lowestZOrderEntry(entries);
  const newShape = _replaceSelectedWithPath(
    ids,
    page,
    result,
    refShape || anchorEntry.shape,
    anchorEntry,
  );
  if (!newShape) return false;
  state.selectedShapeIds = [newShape.id];
  pushHistory();
  return true;
}

function addPage(page = createPage()) {
  const state = getState();
  state.pages.push(page);
  state.currentPageId = page.id;
  state.currentLayerId = page.layers[0]?.id || "";
  state.selectedShapeIds = [];
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory(`ページ追加: ${page.name || page.id}`);
}
function switchPage(id) {
  const state = getState();
  const page = state.pages.find((p) => p.id === id);
  if (!page) return false;
  state.currentPageId = page.id;
  state.currentLayerId = page.layers[0]?.id || "";
  state.selectedShapeIds = [];
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
  return true;
}
function deletePage(id) {
  const state = getState();
  if (state.pages.length <= 1) return false;
  const idx = state.pages.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  state.pages.splice(idx, 1);
  if (state.currentPageId === id)
    state.currentPageId = state.pages[Math.max(0, idx - 1)].id;
  state.selectedShapeIds = [];
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("ページ削除");
  return true;
}
function updatePage(id, values) {
  const page = getState().pages.find((p) => p.id === id);
  if (!page) return false;
  Object.assign(page, values);
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("ページ設定更新");
  return true;
}
function addLayer(pageId = getState().currentPageId, layer = createLayer()) {
  const page = getState().pages.find((p) => p.id === pageId);
  if (!page) return false;
  page.layers.push(layer);
  getState().currentLayerId = layer.id;
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory(`レイヤー追加: ${layer.name || layer.id}`);
  return true;
}
function deleteLayer(pageId, layerId) {
  const state = getState();
  const page = state.pages.find((p) => p.id === pageId);
  if (!page || page.layers.length <= 1) return false;
  const idx = page.layers.findIndex((l) => l.id === layerId);
  if (idx === -1) return false;
  page.layers.splice(idx, 1);
  if (state.currentLayerId === layerId)
    state.currentLayerId = page.layers[0].id;
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("レイヤー削除");
  return true;
}
function updateLayer(pageId, layerId, values) {
  const page = getState().pages.find((p) => p.id === pageId);
  if (!page) return false;
  const layer = page.layers.find((l) => l.id === layerId);
  if (!layer) return false;
  Object.assign(layer, values);
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("レイヤー更新");
  return true;
}
// ── 自動配置（MCP/エージェント作図向け） ─────────────────────
// エージェントは原点 (0,0) 起点で作図しがちで、毎回ページ左上に張り付く。
// applyDrawingCommands のバッチで「追加された」図形だけを一括シフトする。
//   auto   : ページが空 → 用紙中央。既存図形あり →
//            - バッチ全体が既存図形の bbox 内に完全に収まる（穴あけ・重ね）→ そのまま
//            - 既存図形から 20mm 以内に隣接（接続線・注記等の相対配置）→ そのまま
//            - それ以外（重なる / 遠く離れた原点起点など）→ 空きスペースへ再配置
//   center : 常に用紙中央へ。
//   none   : 座標そのまま（従来動作）。
// 3D 生成はページごとのプロファイル bbox 基準（_profileFrameForPage）なので、
// ページ内の一括シフトは 3D 出力に影響しない。
const AUTO_PLACE_MARGIN = 50; // real units（5mm）— 回避配置時の最小間隔
const AUTO_PLACE_PROXIMITY = 200; // real units（20mm）— これ以内なら意図的な隣接とみなす

function _shapeRealBBox(shape) {
  const pts = collectWorldPointsReal(shape);
  return pts.length ? aabbFromPoints(pts) : null;
}

function _boxesOverlap(a, b, margin = 0) {
  return (
    a.x < b.x + b.w + margin &&
    a.x + a.w + margin > b.x &&
    a.y < b.y + b.h + margin &&
    a.y + a.h + margin > b.y
  );
}

function _boxContains(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

// 2 つの bbox 間のギャップ（重なり・接触なら 0）
function _boxGap(a, b) {
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(gx, gy);
}

// 空きスペース探索: 既存コンテンツの右→下→左→上の順に試し、
// だめなら粗いグリッド走査。用紙に収まらなければ null（動かさない）。
function _findFreePlacement(bb, existingBoxes, paperW, paperH) {
  const m = AUTO_PLACE_MARGIN;
  const fits = (x, y) =>
    x >= 0 &&
    y >= 0 &&
    x + bb.w <= paperW &&
    y + bb.h <= paperH &&
    !existingBoxes.some((e) => _boxesOverlap({ x, y, w: bb.w, h: bb.h }, e, m));

  const ex = {
    x: Math.min(...existingBoxes.map((b) => b.x)),
    y: Math.min(...existingBoxes.map((b) => b.y)),
  };
  ex.w = Math.max(...existingBoxes.map((b) => b.x + b.w)) - ex.x;
  ex.h = Math.max(...existingBoxes.map((b) => b.y + b.h)) - ex.y;

  const candidates = [
    [(paperW - bb.w) / 2, (paperH - bb.h) / 2], // 中央（空いていれば最優先）
    [ex.x + ex.w + m, ex.y], // 既存コンテンツの右
    [ex.x, ex.y + ex.h + m], // 下
    [ex.x - bb.w - m, ex.y], // 左
    [ex.x, ex.y - bb.h - m], // 上
  ];
  for (const [x, y] of candidates) {
    if (fits(x, y)) return { x, y };
  }
  const step = Math.max(100, Math.min(bb.w, bb.h) / 2 || 100);
  for (let y = 0; y + bb.h <= paperH; y += step) {
    for (let x = 0; x + bb.w <= paperW; x += step) {
      if (fits(x, y)) return { x, y };
    }
  }
  return null;
}

function _placeAddedBatch(page, addedShapes, addedDims, placement) {
  if (placement === "none") return;
  // 寸法線だけのバッチは既存図形への注記なので動かさない
  if (!addedShapes.length) return;

  const boxes = addedShapes.map(_shapeRealBBox).filter(Boolean);
  for (const d of addedDims) {
    boxes.push(
      aabbFromPoints([
        [d.from.x, d.from.y],
        [d.to.x, d.to.y],
      ]),
    );
  }
  if (!boxes.length) return;
  const bb = aabbFromPoints(
    boxes.flatMap((b) => [
      [b.x, b.y],
      [b.x + b.w, b.y + b.h],
    ]),
  );

  // ページが表す実世界の範囲（real units）— getPageCanvasMM は state.js の既存ヘルパー
  const paper = getPageCanvasMM(page);
  const centerX = (paper.w - bb.w) / 2;
  const centerY = (paper.h - bb.h) / 2;

  let target = null;
  if (placement === "center") {
    target = { x: centerX, y: centerY };
  } else {
    // auto
    const addedSet = new Set(addedShapes);
    const existingBoxes = [];
    for (const layer of page.layers) {
      for (const sh of layer.shapes) {
        if (addedSet.has(sh)) continue;
        const b = _shapeRealBBox(sh);
        if (b) existingBoxes.push(b);
      }
    }
    if (!existingBoxes.length) {
      target = { x: centerX, y: centerY };
    } else {
      // 意図的な重ね（穴あけ・ブーリアン用）→ そのまま
      if (existingBoxes.some((e) => _boxContains(e, bb))) return;
      // 既存図形に近接（接続線・注記などの相対配置）→ そのまま
      const overlaps = existingBoxes.some((e) => _boxesOverlap(bb, e));
      if (
        !overlaps &&
        existingBoxes.some((e) => _boxGap(bb, e) <= AUTO_PLACE_PROXIMITY)
      ) {
        return;
      }
      // 重なっている / 既存から遠く離れている（原点起点の描き直し等）→ 空きへ
      target = _findFreePlacement(bb, existingBoxes, paper.w, paper.h);
      if (!target) return; // 置き場がない → そのまま
    }
  }

  const dx = target.x - bb.x;
  const dy = target.y - bb.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
  for (const sh of addedShapes) {
    shiftShape(sh, dx, dy);
    if (typeof markShapeDirty === "function") markShapeDirty(sh.id);
  }
  for (const d of addedDims) {
    d.from.x += dx;
    d.from.y += dy;
    d.to.x += dx;
    d.to.y += dy;
    if (typeof markShapeDirty === "function") markShapeDirty(d.id);
  }
}

function applyDrawingCommands(commands, options = {}) {
  const state = getState();
  const placement = options.placement || "auto";
  const addedShapes = [];
  const addedDims = [];
  for (const cmd of commands) {
    if (cmd.action === "addShape") {
      // ID重複チェック
      if (cmd.shape?.id && findShapeById(cmd.shape.id)) {
        console.warn(
          `[applyDrawingCommands] ID衝突を検出・再生成: ${cmd.shape.id}`,
        );
        cmd.shape.id = genId("shape");
      }
      // 寸法線は dimensions[] へ、それ以外は layer.shapes[] へ
      if (cmd.shape?.type === "dimension") {
        normalizeDimensionGeometry(cmd.shape);
        const page = getCurrentPage();
        if (!page.dimensions) page.dimensions = [];
        page.dimensions.push(cmd.shape);
        addedDims.push(cmd.shape);
      } else {
        const l = getCurrentLayer();
        if (!l.locked && cmd.shape) {
          l.shapes.push(cmd.shape);
          addedShapes.push(cmd.shape);
        }
      }
    } else if (cmd.action === "addDimension") {
      // MCP の addDimension アクション（意味的に明示）
      const dim = cmd.dimension || cmd.shape;
      if (dim) {
        if (dim.id && findShapeById(dim.id)) {
          console.warn(
            `[applyDrawingCommands] 寸法ID衝突を検出・再生成: ${dim.id}`,
          );
          dim.id = genId("dim");
        }
        const page = getCurrentPage();
        if (!page.dimensions) page.dimensions = [];
        const newDim = { type: "dimension", ...dim };
        normalizeDimensionGeometry(newDim);
        page.dimensions.push(newDim);
        addedDims.push(newDim);
      }
    } else if (
      cmd.action === "updateShape" ||
      cmd.action === "updateDimension"
    ) {
      const r = findShapeById(cmd.id);
      if (r && cmd.values) {
        Object.assign(r.shape, cmd.values);
        if (r.isDimension) normalizeDimensionGeometry(r.shape);
      }
    } else if (cmd.action === "deleteShape") {
      const r = findShapeById(cmd.id);
      if (r) {
        if (r.isDimension) {
          const dims = r.page.dimensions;
          const i = dims.indexOf(r.shape);
          if (i !== -1) dims.splice(i, 1);
        } else {
          const i = r.layer.shapes.indexOf(r.shape);
          if (i !== -1) r.layer.shapes.splice(i, 1);
        }
      }
    } else if (cmd.action === "setPageScale") {
      const p =
        state.pages.find((p) => p.id === cmd.pageId) || getCurrentPage();
      if (cmd.scale) p.scale = cmd.scale;
    } else if (cmd.action === "setPagePaper") {
      const p =
        state.pages.find((p) => p.id === cmd.pageId) || getCurrentPage();
      if (cmd.paper) p.paper = cmd.paper;
      if (cmd.orientation) p.orientation = cmd.orientation;
    } else if (cmd.action === "addPage") {
      if (cmd.page) state.pages.push(cmd.page);
    } else if (cmd.action === "setProjectName") {
      if (cmd.name) state.projectName = cmd.name;
    } else if (cmd.action === "selectShapes") {
      if (Array.isArray(cmd.ids)) state.selectedShapeIds = cmd.ids;
    } else if (cmd.action === "addConstraint") {
      if (cmd.constraint) {
        const page = getCurrentPage();
        if (!page.constraints) page.constraints = [];
        if (!cmd.constraint.id) cmd.constraint.id = genId("cst");
        page.constraints.push(cmd.constraint);
      }
    } else if (cmd.action === "removeConstraint") {
      if (cmd.id) {
        const page = getCurrentPage();
        if (page.constraints) {
          const i = page.constraints.findIndex((c) => c.id === cmd.id);
          if (i !== -1) page.constraints.splice(i, 1);
        }
      }
    } else if (cmd.action === "applyConstraints") {
      applyConstraints();
    } else if (cmd.action === "replaceState") {
      if (cmd.state) replaceState(cmd.state);
    }
  }
  _placeAddedBatch(getCurrentPage(), addedShapes, addedDims, placement);
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("コマンド適用");
}

function groupSelectedShapes() {
  const state = getState();
  const ids = [...state.selectedShapeIds];
  if (ids.length < 2) return false;
  const page = getCurrentPage();

  // collect shapes in layer order (preserve z-order)
  const children = [];
  for (const layer of page.layers) {
    for (const shape of [...layer.shapes]) {
      if (ids.includes(shape.id)) children.push(shape);
    }
  }
  if (children.length < 2) return false;

  // remove children from their layers
  for (const child of children) {
    const res = findShapeById(child.id);
    if (res) {
      const idx = res.layer.shapes.indexOf(res.shape);
      if (idx !== -1) res.layer.shapes.splice(idx, 1);
    }
  }

  const group = { id: genId("group"), type: "group", children };
  getCurrentLayer().shapes.push(group);
  state.selectedShapeIds = [group.id];
  if (typeof markShapeDirty === "function") markShapeDirty(group.id);
  pushHistory("グループ化");
  return true;
}

function ungroupSelectedShapes() {
  const state = getState();
  if (state.selectedShapeIds.length !== 1) return false;
  const res = findShapeById(state.selectedShapeIds[0]);
  if (!res || res.shape.type !== "group") return false;
  const { shape, layer } = res;
  const idx = layer.shapes.indexOf(shape);
  const newIds = shape.children.map((c) => c.id);
  layer.shapes.splice(idx, 1, ...shape.children);
  state.selectedShapeIds = newIds;
  if (typeof markDocumentDirty === "function") markDocumentDirty();
  pushHistory("グループ解除");
  return true;
}

// identity scale for align/distribute — bbox in real units (same as shape coordinates)
const _ID_SCALE = { numerator: REAL_PER_MM, denominator: 1 };

function _selectedBBoxes() {
  return getState()
    .selectedShapeIds.map((id) => {
      const res = findShapeById(id);
      if (!res) return null;
      const bb = getShapeBBox(res.shape, _ID_SCALE);
      return bb ? { id, shape: res.shape, bb } : null;
    })
    .filter(Boolean);
}

function alignShapes(dir) {
  const items = _selectedBBoxes();
  if (!items.length) return false;
  let minX, maxX, minY, maxY;
  if (items.length === 1) {
    // 単一選択時は用紙（ページ実寸）を基準に揃える
    const { w: pw, h: ph } = getPageCanvasMM(getCurrentPage());
    minX = 0;
    maxX = pw;
    minY = 0;
    maxY = ph;
  } else {
    const all = items.map((i) => i.bb);
    minX = Math.min(...all.map((b) => b.x));
    maxX = Math.max(...all.map((b) => b.x + b.w));
    minY = Math.min(...all.map((b) => b.y));
    maxY = Math.max(...all.map((b) => b.y + b.h));
  }
  const cX = (minX + maxX) / 2;
  const cY = (minY + maxY) / 2;
  for (const { shape, bb } of items) {
    let dx = 0,
      dy = 0;
    if (dir === "left") dx = minX - bb.x;
    else if (dir === "centerH") dx = cX - (bb.x + bb.w / 2);
    else if (dir === "right") dx = maxX - (bb.x + bb.w);
    else if (dir === "top") dy = minY - bb.y;
    else if (dir === "centerV") dy = cY - (bb.y + bb.h / 2);
    else if (dir === "bottom") dy = maxY - (bb.y + bb.h);
    if (dx || dy) shiftShape(shape, dx, dy);
  }
  pushHistory();
  return true;
}

function distributeShapes(axis) {
  const items = _selectedBBoxes();
  if (items.length < 3) return false;
  if (axis === "h") {
    items.sort((a, b) => a.bb.x - b.bb.x);
    const totalW = items.reduce((s, i) => s + i.bb.w, 0);
    const span =
      items[items.length - 1].bb.x +
      items[items.length - 1].bb.w -
      items[0].bb.x;
    const gap = (span - totalW) / (items.length - 1);
    let cursor = items[0].bb.x + items[0].bb.w + gap;
    for (let i = 1; i < items.length - 1; i++) {
      shiftShape(items[i].shape, cursor - items[i].bb.x, 0);
      cursor += items[i].bb.w + gap;
    }
  } else {
    items.sort((a, b) => a.bb.y - b.bb.y);
    const totalH = items.reduce((s, i) => s + i.bb.h, 0);
    const span =
      items[items.length - 1].bb.y +
      items[items.length - 1].bb.h -
      items[0].bb.y;
    const gap = (span - totalH) / (items.length - 1);
    let cursor = items[0].bb.y + items[0].bb.h + gap;
    for (let i = 1; i < items.length - 1; i++) {
      shiftShape(items[i].shape, 0, cursor - items[i].bb.y);
      cursor += items[i].bb.h + gap;
    }
  }
  pushHistory();
  return true;
}

function moveShapeToPosition(id, newX, newY) {
  const res = findShapeById(id);
  if (!res) return;
  const bb = getShapeBBox(res.shape, _ID_SCALE);
  if (!bb) return;
  shiftShape(res.shape, newX - bb.x, newY - bb.y);
  // 拘束を再適用して幾何的整合性を保つ
  applyConstraints(res.page);
  pushHistory();
}

// ── Visual transforms ────────────────────────────────────────
//
// rotation / flipH / flipV は座標値を変えず SVG transform でも描画する。
// 幾何計算（getShapeBBox / Profile / 3D）は js/transform.js で同じ変換を適用する。

function flipShapes(axis) {
  const state = getState();
  for (const id of state.selectedShapeIds) {
    const res = findShapeById(id);
    if (!res) continue;
    const sh = res.shape;
    if (axis === "h") sh.flipH = !sh.flipH;
    else sh.flipV = !sh.flipV;
  }
  pushHistory();
}

function normalizeRotationDeg(deg) {
  let d = Math.round(deg);
  if (!Number.isFinite(d)) d = 0;
  while (d > 360) d -= 360;
  while (d < -360) d += 360;
  if (d === 360 || d === -360) d = 0;
  return d;
}

function rotateShapes(deg) {
  const state = getState();
  const normalized = normalizeRotationDeg(deg);
  for (const id of state.selectedShapeIds) {
    const res = findShapeById(id);
    if (!res) continue;
    res.shape.rotation = normalized;
  }
  pushHistory();
}

function rotateShapesBy(deltaDeg) {
  const state = getState();
  for (const id of state.selectedShapeIds) {
    const res = findShapeById(id);
    if (!res) continue;
    res.shape.rotation = normalizeRotationDeg(
      (res.shape.rotation || 0) + deltaDeg,
    );
  }
  pushHistory();
}
