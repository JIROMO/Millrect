"use strict";

// path 図形（polygon-clipping 形式の contours）の角に対する
// フィレット（丸め）/ 面取り（チャンファー）。角を選ぶ UI は持たず、
// 全頂点へ一括適用する一発焼き込みコマンド（rect の rx と違い、path は
// 任意多角形なので統一 API を持たない。CLAUDE.md の「切り欠きは 2D
// ジオメトリに焼き込む」原則に倣い、結果は shape.contours に直接反映する）。

const FILLET_ARC_SEGMENTS = 12;
const FILLET_MIN_EDGE_LEN = 1e-6;

function _vlen(x, y) {
  return Math.hypot(x, y);
}

// 1つの閉じたリングの全頂点にフィレット/チャンファーを適用する。
// mode: "round"（円弧フィレット） | "chamfer"（直線面取り）
function filletRing(ring, radius, mode) {
  if (!ring || ring.length < 3 || radius <= 0) return ring;
  const n = ring.length;
  const out = [];

  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];

    const v1x = prev[0] - cur[0],
      v1y = prev[1] - cur[1];
    const v2x = next[0] - cur[0],
      v2y = next[1] - cur[1];
    const len1 = _vlen(v1x, v1y),
      len2 = _vlen(v2x, v2y);
    if (len1 < FILLET_MIN_EDGE_LEN || len2 < FILLET_MIN_EDGE_LEN) {
      out.push(cur);
      continue;
    }
    const u1x = v1x / len1,
      u1y = v1y / len1;
    const u2x = v2x / len2,
      u2y = v2y / len2;

    // 内角（頂点で挟まれる角度）
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));
    const theta = Math.acos(dot);
    if (theta < 1e-6 || theta > Math.PI - 1e-6) {
      // ほぼ直線 or 退化 — 丸め不要
      out.push(cur);
      continue;
    }

    if (mode === "chamfer") {
      const t = Math.min(radius, len1 / 2, len2 / 2);
      out.push([cur[0] + u1x * t, cur[1] + u1y * t]);
      out.push([cur[0] + u2x * t, cur[1] + u2y * t]);
      continue;
    }

    // round: 接線長 = radius / tan(theta/2)。隣接辺の半分を超えないようクランプする
    // （クランプされた場合、実効半径も比例して縮む＝短辺での破綻を防ぐ）。
    const tanHalf = Math.tan(theta / 2);
    let tLen = tanHalf > 1e-9 ? radius / tanHalf : Math.min(len1, len2) / 2;
    const tMax = Math.min(len1 / 2, len2 / 2);
    let effRadius = radius;
    if (tLen > tMax) {
      effRadius = radius * (tMax / tLen);
      tLen = tMax;
    }
    const t1x = cur[0] + u1x * tLen,
      t1y = cur[1] + u1y * tLen;
    const t2x = cur[0] + u2x * tLen,
      t2y = cur[1] + u2y * tLen;

    // 円弧中心: 角の二等分線方向に distance = effRadius / sin(theta/2)
    const bx = u1x + u2x,
      by = u1y + u2y;
    const blen = _vlen(bx, by);
    if (blen < 1e-9 || effRadius < 1e-9) {
      out.push(cur);
      continue;
    }
    const bux = bx / blen,
      buy = by / blen;
    const dist = effRadius / Math.sin(theta / 2);
    const cx = cur[0] + bux * dist,
      cy = cur[1] + buy * dist;

    const a1 = Math.atan2(t1y - cy, t1x - cx);
    const a2 = Math.atan2(t2y - cy, t2x - cx);
    let delta = a2 - a1;
    // 頂点を通らない短い方の弧を選ぶ
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    for (let k = 0; k <= FILLET_ARC_SEGMENTS; k++) {
      const a = a1 + (delta * k) / FILLET_ARC_SEGMENTS;
      out.push([cx + effRadius * Math.cos(a), cy + effRadius * Math.sin(a)]);
    }
  }

  return out;
}

// path shape の全 contour（外周・穴）にフィレット/チャンファーを適用する。
// radius は real units。破壊的に shape.contours を書き換える。
function applyFilletToPathShape(shape, radius, mode) {
  if (!shape || shape.type !== "path" || !Array.isArray(shape.contours)) {
    return false;
  }
  if (!(radius > 0)) return false;
  shape.contours = shape.contours.map((polygon) =>
    polygon.map((ring) => filletRing(ring, radius, mode)),
  );
  return true;
}
