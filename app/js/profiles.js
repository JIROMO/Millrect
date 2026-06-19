"use strict";

// ── Profile Layer ──────────────────────────────────────────────
//
// Profile = 閉じた輪郭（平面図形）から計算される派生データ。
//
// 設計思想:
//   - Profile は DrawingObject から計算されるが、State には保存しない（派生データ）
//   - 2D図面を編集する。Profile は「3D生成・STL出力・Feature適用の入口」に過ぎない
//   - extractProfilesFromPage() が唯一の入口
//   - 3D生成・STL出力は必ずこのレイヤーを経由する
//   - AIは Profile を「提案」するが、確定はプログラムが行う
//
// Profile スキーマ:
// {
//   id: string,           // "profile-{shapeId}"
//   sourceId: string,     // 元になった DrawingObject の ID
//   pageId: string,
//   rings: [              // polygon-clipping 形式: rings[0]=外周, rings[1..]=ホール
//     [[x,y], [x,y], ...],
//     ...
//   ],
//   bbox: { x, y, w, h }, // 実座標（shape 座標系）
//   area: number,         // 外周の符号付き面積（正=CCW, 正値で面積を示す）
// }
//
// 対応する DrawingObject タイプ:
//   rect / circle / ellipse / bezier(closed) / path
//
// 非対応（Profile にならない）:
//   line / text / dimension / bezier(open)
// group は単体では Profile にならないが、extractProfilesFromPage / 3D 生成では子を再帰展開する
// ──────────────────────────────────────────────────────────────

// ── 内部ユーティリティ ────────────────────────────────────────

/** 符号付き面積（Shoelace）。正値 = CCW */
function _signedArea(ring) {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  return area / 2;
}

/** 単純な ring の BBOX */
function _ringBBox(ring) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/** 複数 ring の合成 BBOX */
function _ringsBBox(rings) {
  const bboxes = rings.map(_ringBBox);
  const minX = Math.min(...bboxes.map((b) => b.minX));
  const minY = Math.min(...bboxes.map((b) => b.minY));
  const maxX = Math.max(...bboxes.map((b) => b.maxX));
  const maxY = Math.max(...bboxes.map((b) => b.maxY));
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/**
 * 丸角矩形を頂点リングへ変換（commands.js の roundedRectToRing と同等だが独立実装）
 */
function _roundedRectRing(x, y, w, h, tl, tr, br, bl, N = 32) {
  const arc = (cx, cy, r, a0, a1) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / N;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  const pts = [];
  if (tl > 0) pts.push(...arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5));
  else pts.push([x, y]);
  if (tr > 0)
    pts.push(...arc(x + w - tr, y + tr, tr, Math.PI * 1.5, Math.PI * 2));
  else pts.push([x + w, y]);
  if (br > 0) pts.push(...arc(x + w - br, y + h - br, br, 0, Math.PI * 0.5));
  else pts.push([x + w, y + h]);
  if (bl > 0) pts.push(...arc(x + bl, y + h - bl, bl, Math.PI * 0.5, Math.PI));
  else pts.push([x, y + h]);
  return pts;
}

/**
 * group を再帰展開し、Profile 生成対象の leaf 図形を列挙する。
 * @param {object|object[]} shapes
 * @returns {object[]}
 */
function iterProfileSourceShapes(shapes) {
  const out = [];
  function walk(shape) {
    if (!shape || typeof shape !== "object") return;
    if (shape.type === "group" && Array.isArray(shape.children)) {
      for (const child of shape.children) walk(child);
      return;
    }
    out.push(shape);
  }
  const list = Array.isArray(shapes) ? shapes : [shapes];
  for (const shape of list) walk(shape);
  return out;
}

// ── Shape → rings 変換 ────────────────────────────────────────

/**
 * DrawingObject を polygon-clipping 形式の rings に変換する。
 * 変換できない（開いた輪郭・非対応タイプ）場合は null を返す。
 *
 * @param {object} shape
 * @returns {Array<Array<[number,number]>>|null}  rings or null
 */
function shapeToProfileRings(shape, ancestorGroups = []) {
  let rings;
  switch (shape.type) {
    case "rect": {
      const { x, y, width: w, height: h } = shape;
      let ring;
      if (shape.rxMode === "individual") {
        const tl = shape.rxTL ?? 0,
          tr = shape.rxTR ?? 0;
        const br = shape.rxBR ?? 0,
          bl = shape.rxBL ?? 0;
        if (tl || tr || br || bl)
          ring = _roundedRectRing(x, y, w, h, tl, tr, br, bl);
        else
          ring = [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ];
      } else if (shape.rx) {
        const r = shape.rx;
        ring = _roundedRectRing(x, y, w, h, r, r, r, r);
      } else {
        ring = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
      }
      rings = [ring];
      break;
    }

    case "circle": {
      const { cx, cy, r } = shape;
      const N = 128;
      const ring = Array.from({ length: N }, (_, i) => {
        const a = (2 * Math.PI * i) / N;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      rings = [ring];
      break;
    }

    case "ellipse": {
      const { cx, cy, rx, ry } = shape;
      const N = 128;
      const ring = Array.from({ length: N }, (_, i) => {
        const a = (2 * Math.PI * i) / N;
        return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
      });
      rings = [ring];
      break;
    }

    case "bezier": {
      if (!shape.closed || !shape.nodes || shape.nodes.length < 3) return null;
      // ベジェ曲線をポリラインに近似（セグメントあたり16分割）
      const N = 16;
      const ring = [];
      const ns = shape.nodes;
      for (let i = 0; i < ns.length; i++) {
        const p0 = ns[i];
        const p1 = ns[(i + 1) % ns.length];
        const c1 = p0.h2 ?? p0;
        const c2 = p1.h1 ?? p1;
        for (let t = 0; t < N; t++) {
          const u = t / N;
          const uu = 1 - u;
          ring.push([
            uu ** 3 * p0.x +
              3 * uu ** 2 * u * c1.x +
              3 * uu * u ** 2 * c2.x +
              u ** 3 * p1.x,
            uu ** 3 * p0.y +
              3 * uu ** 2 * u * c1.y +
              3 * uu * u ** 2 * c2.y +
              u ** 3 * p1.y,
          ]);
        }
      }
      rings = [ring];
      break;
    }

    case "path": {
      // path.contours は polygon-clipping 形式と同じ構造
      // [[outerRing, holeRing, ...], ...]
      if (!shape.contours || shape.contours.length === 0) return null;
      // 最外周 polygon の rings として返す
      rings = shape.contours[0] || null;
      break;
    }

    default:
      return null; // line / text / dimension / bezier(open) / group（単体）は非対応
  }

  if (!rings || rings.length === 0) return null;
  const hasTransform =
    hasVisualTransform(shape) ||
    ancestorGroups.some((g) => hasVisualTransform(g));
  if (!hasTransform) return rings;
  return transformRingsReal(rings, shape, ancestorGroups);
}

/**
 * DrawingObject が Profile（閉じた輪郭）になれるかを判定する。
 */
function canBeProfile(shape) {
  return shapeToProfileRings(shape) !== null;
}

// ── Profile 生成 ──────────────────────────────────────────────

const _profileEntriesCache = new Map();

function _profilePageSignature(page) {
  const docv =
    typeof getDocumentRenderVersion === "function"
      ? getDocumentRenderVersion()
      : 0;
  const layers = (page.layers || [])
    .map((layer) => {
      const shapes = (layer.shapes || [])
        .map((shape) => {
          const rv =
            typeof getShapeRenderVersion === "function"
              ? getShapeRenderVersion(shape.id)
              : 0;
          const childSig =
            shape.type === "group"
              ? `:${(shape.children || [])
                  .map((child) => {
                    const crv =
                      typeof getShapeRenderVersion === "function"
                        ? getShapeRenderVersion(child.id)
                        : 0;
                    return `${child.id}@${crv}`;
                  })
                  .join(",")}`
              : "";
          return `${shape.id}@${rv}${childSig}`;
        })
        .join(",");
      return `${layer.id}:${layer.visible ? 1 : 0}:${layer.locked ? 1 : 0}:${shapes}`;
    })
    .join("|");
  return `${page.id}|${docv}|${layers}`;
}

/**
 * DrawingObject から Profile を生成する。
 * 変換できない場合は null を返す。
 *
 * @param {object} shape
 * @param {string} pageId
 * @returns {object|null}  Profile or null
 */
function shapeToProfile(shape, pageId, ancestorGroups = []) {
  const rings = shapeToProfileRings(shape, ancestorGroups);
  if (!rings || rings.length === 0) return null;
  const outerRing = rings[0];
  const area = Math.abs(_signedArea(outerRing));
  if (area < 1e-6) return null; // 面積ゼロは除外

  return {
    id: `profile-${shape.id}`,
    sourceId: shape.id,
    pageId,
    rings,
    bbox: _ringsBBox(rings),
    area,
  };
}

function getProfileEntriesFromPage(page) {
  const sig = _profilePageSignature(page);
  const cached = _profileEntriesCache.get(page.id);
  if (cached?.sig === sig) return cached.entries;

  const entries = [];
  for (const { shape, ancestorGroups } of iterProfileSourcesFromPage(page)) {
    const profile = shapeToProfile(shape, page.id, ancestorGroups);
    if (profile) entries.push({ shape, ancestorGroups, profile });
  }
  _profileEntriesCache.set(page.id, { sig, entries });
  return entries;
}

/**
 * ページ上の全 DrawingObject から Profile を抽出して返す。
 *
 * - dimensions[] は除外（アノテーションのため）
 * - locked レイヤーの図形は除外
 * - feature が設定されていない図形も含む（Profile として使える形なら常に返す）
 *
 * @param {object} page
 * @returns {object[]}  Profile[]
 */
function extractProfilesFromPage(page) {
  return getProfileEntriesFromPage(page).map((entry) => entry.profile);
}

/**
 * 特定 shape ID に対応する Profile を取得する。
 *
 * @param {string} shapeId
 * @param {object} page
 * @returns {object|null}  Profile or null
 */
function getProfileForShape(shapeId, page) {
  const res = findShapeById(shapeId);
  if (!res || res.isDimension) return null;
  const ancestors =
    typeof findAncestorGroups === "function" ? findAncestorGroups(shapeId) : [];
  return shapeToProfile(res.shape, page.id, ancestors);
}

/**
 * Profile の rings を Three.js Shape に変換する。
 * （3d-view.js が使う。直接 shape を渡すのではなく Profile 経由にする）
 *
 * scaleFactor: page.scale.denominator / page.scale.numerator
 *
 * @param {object} profile
 * @param {number} scaleFactor
 * @returns {THREE.Shape[]}
 */
function profileToThreeShapes(profile, scaleFactor) {
  // Profile の rings は実座標（real units, 1mm = 10）
  // Three.js は mm 単位で扱うため realToMM = v / 10 を適用
  const m = (v) => (v / 10) * scaleFactor;

  const result = [];
  const rings = profile.rings;
  if (!rings || rings.length === 0) return result;

  const outer = rings[0];
  if (!outer || outer.length < 3) return result;

  const s = new THREE.Shape();
  s.moveTo(m(outer[0][0]), m(outer[0][1]));
  for (let i = 1; i < outer.length; i++) {
    s.lineTo(m(outer[i][0]), m(outer[i][1]));
  }
  s.closePath();

  // ホール（rings[1..])
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h];
    if (!hole || hole.length < 3) continue;
    const hp = new THREE.Path();
    hp.moveTo(m(hole[0][0]), m(hole[0][1]));
    for (let i = 1; i < hole.length; i++) {
      hp.lineTo(m(hole[i][0]), m(hole[i][1]));
    }
    hp.closePath();
    s.holes.push(hp);
  }

  result.push(s);
  return result;
}
