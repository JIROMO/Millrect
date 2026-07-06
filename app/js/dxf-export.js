"use strict";

// 最小サブセットの DXF (R12 互換 / AC1009) エクスポート。
// LINE / CIRCLE / POLYLINE(+VERTEX) のみ対応（レーザーカッター・CNC・他 CAD 連携向け）。
// text / dimension / image は対象外。切り欠きは path 輪郭（穴付き polygon）として
// そのままポリライン出力する（3D 生成と同じく「切り欠きは 2D ジオメトリに焼き込む」方針）。

const DXF_BEZIER_SEGMENTS = 16;

function _dxfNum(n) {
  return Math.round(n * 10000) / 10000;
}

// 画面座標系（y-down）→ DXF/CAD の慣習（y-up）に合わせて Y を反転し、mm に変換する。
function _dxfCoord(x, y) {
  return [_dxfNum(realToMM(x)), _dxfNum(-realToMM(y))];
}

function _dxfSampleBezier(shape) {
  const N = DXF_BEZIER_SEGMENTS;
  const pts = [];
  const ns = shape.nodes;
  const segCount = shape.closed ? ns.length : ns.length - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = ns[i];
    const p1 = ns[(i + 1) % ns.length];
    const c1 = p0.h2 ?? p0;
    const c2 = p1.h1 ?? p1;
    for (let t = 0; t < N; t++) {
      const u = t / N;
      const uu = 1 - u;
      pts.push([
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
  if (!shape.closed) {
    const last = ns[ns.length - 1];
    pts.push([last.x, last.y]);
  }
  return pts;
}

function _dxfBuildEntities(page) {
  const lines = [];
  const push = (code, val) => {
    lines.push(String(code), String(val));
  };

  function emitLine(x1, y1, x2, y2) {
    push(0, "LINE");
    push(8, "0");
    push(10, x1);
    push(20, y1);
    push(30, 0);
    push(11, x2);
    push(21, y2);
    push(31, 0);
  }
  function emitCircle(cx, cy, r) {
    push(0, "CIRCLE");
    push(8, "0");
    push(10, cx);
    push(20, cy);
    push(30, 0);
    push(40, r);
  }
  function emitPolyline(points, closed) {
    if (points.length < 2) return;
    push(0, "POLYLINE");
    push(8, "0");
    push(66, 1);
    push(70, closed ? 1 : 0);
    for (const [x, y] of points) {
      push(0, "VERTEX");
      push(8, "0");
      push(10, x);
      push(20, y);
      push(30, 0);
    }
    push(0, "SEQEND");
  }

  function tp(x, y, shape, ancestors) {
    const [wx, wy] = applyWorldTransformReal(x, y, shape, ancestors);
    return _dxfCoord(wx, wy);
  }

  function emitShape(shape, ancestors) {
    switch (shape.type) {
      case "line": {
        const [x1, y1] = tp(shape.x1, shape.y1, shape, ancestors);
        const [x2, y2] = tp(shape.x2, shape.y2, shape, ancestors);
        emitLine(x1, y1, x2, y2);
        break;
      }
      case "rect": {
        const { x, y, width: w, height: h } = shape;
        const corners = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ].map(([px, py]) => tp(px, py, shape, ancestors));
        emitPolyline(corners, true);
        break;
      }
      case "circle": {
        // 回転・反転は中心位置にのみ適用する（アプリの変換は等方なので半径は不変）
        const [cx, cy] = tp(shape.cx, shape.cy, shape, ancestors);
        emitCircle(cx, cy, _dxfNum(realToMM(shape.r)));
        break;
      }
      case "ellipse": {
        const N = 64;
        const pts = [];
        for (let i = 0; i < N; i++) {
          const a = (2 * Math.PI * i) / N;
          pts.push(
            tp(
              shape.cx + shape.rx * Math.cos(a),
              shape.cy + shape.ry * Math.sin(a),
              shape,
              ancestors,
            ),
          );
        }
        emitPolyline(pts, true);
        break;
      }
      case "bezier": {
        if (!shape.nodes || shape.nodes.length < 2) break;
        const pts = _dxfSampleBezier(shape).map(([px, py]) =>
          tp(px, py, shape, ancestors),
        );
        emitPolyline(pts, !!shape.closed);
        break;
      }
      case "path": {
        for (const polygon of shape.contours || []) {
          for (const ring of polygon) {
            const pts = ring.map(([px, py]) => tp(px, py, shape, ancestors));
            emitPolyline(pts, true);
          }
        }
        break;
      }
      case "pencil": {
        const pts = (shape.points || []).map((pt) =>
          tp(pt.x, pt.y, shape, ancestors),
        );
        emitPolyline(pts, false);
        break;
      }
      default:
        break; // text / dimension / image は対象外
    }
  }

  function walk(shapes, ancestors) {
    for (const shape of shapes) {
      if (shape.ghost) continue;
      if (shape.type === "group" && Array.isArray(shape.children)) {
        walk(shape.children, [...ancestors, shape]);
        continue;
      }
      emitShape(shape, ancestors);
    }
  }

  for (const layer of page.layers) {
    if (!layer.visible) continue;
    walk(layer.shapes, []);
  }

  return lines;
}

function buildPageDXFString(page) {
  const header = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1009",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
  ];
  const entitiesHeader = ["0", "SECTION", "2", "ENTITIES"];
  const entities = _dxfBuildEntities(page);
  const footer = ["0", "ENDSEC", "0", "EOF"];
  return (
    [...header, ...entitiesHeader, ...entities, ...footer].join("\n") + "\n"
  );
}

function exportCurrentPageDxf() {
  const page = getCurrentPage();
  const dxf = buildPageDXFString(page);
  const title = (getState().projectName || "millrect").replace(/\s+/g, "_");
  dl(dxf, `${title}.dxf`, "application/dxf");
}
