"use strict";

/**
 * Module Joint 1 — real product specimen.
 * Units: mm. Internal Millrect coordinates use 10 real units per mm.
 */
const MODULE_JOINT_1_REAL_PER_MM = 10;
const MODULE_JOINT_1_SCALE = { numerator: 1, denominator: 1 };
const MODULE_JOINT_1_MM = {
  width: 24,
  height: 100,
  thickness: 2,
  holeDiameter: 6,
  radius: 2,
  notchDiameter: 6,
  pitch: 10,
  rows: 9,
};

function moduleJoint1R(mm) {
  return mm * MODULE_JOINT_1_REAL_PER_MM;
}

function moduleJoint1Layout() {
  const paper = { width: 210, height: 297 };
  const w = moduleJoint1R(MODULE_JOINT_1_MM.width);
  const h = moduleJoint1R(MODULE_JOINT_1_MM.height);
  const ox = moduleJoint1R((paper.width - MODULE_JOINT_1_MM.width) / 2);
  const oy = moduleJoint1R((paper.height - MODULE_JOINT_1_MM.height) / 2);
  return { ox, oy, w, h };
}

function moduleJoint1Arc(pts, cx, cy, r, a0, a1, segments) {
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
}

function moduleJoint1CircleRing(cx, cy, r, segments = 128) {
  return Array.from({ length: segments }, (_, i) => {
    const a = (2 * Math.PI * i) / segments;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function moduleJoint1OutlineRing() {
  const { ox, oy, w, h } = moduleJoint1Layout();
  const r = moduleJoint1R(MODULE_JOINT_1_MM.radius);
  const nr = moduleJoint1R(MODULE_JOINT_1_MM.notchDiameter / 2);
  const n1 = ox + moduleJoint1R(6);
  const n2 = ox + moduleJoint1R(18);
  const right = ox + w;
  const bottom = oy + h;
  const arcSegments = 24;
  const pts = [];

  pts.push([ox + r, oy]);
  pts.push([n1 - nr, oy]);
  moduleJoint1Arc(pts, n1, oy, nr, Math.PI, 0, arcSegments);
  pts.push([n2 - nr, oy]);
  moduleJoint1Arc(pts, n2, oy, nr, Math.PI, 0, arcSegments);
  pts.push([right - r, oy]);
  moduleJoint1Arc(pts, right - r, oy + r, r, -Math.PI / 2, 0, arcSegments);
  pts.push([right, bottom - r]);
  moduleJoint1Arc(pts, right - r, bottom - r, r, 0, Math.PI / 2, arcSegments);
  pts.push([n2 + nr, bottom]);
  moduleJoint1Arc(pts, n2, bottom, nr, 0, -Math.PI, arcSegments);
  pts.push([n1 + nr, bottom]);
  moduleJoint1Arc(pts, n1, bottom, nr, 0, -Math.PI, arcSegments);
  pts.push([ox + r, bottom]);
  moduleJoint1Arc(
    pts,
    ox + r,
    bottom - r,
    r,
    Math.PI / 2,
    Math.PI,
    arcSegments,
  );
  pts.push([ox, oy + r]);
  moduleJoint1Arc(pts, ox + r, oy + r, r, Math.PI, Math.PI * 1.5, arcSegments);
  return pts;
}

function moduleJoint1HoleCenters() {
  const { ox, oy } = moduleJoint1Layout();
  const xs = [6, 18].map((x) => ox + moduleJoint1R(x));
  return Array.from({ length: MODULE_JOINT_1_MM.rows }, (_, i) => {
    const y = oy + moduleJoint1R(10 + i * MODULE_JOINT_1_MM.pitch);
    return xs.map((x, col) => ({ id: `r${i + 1}c${col + 1}`, cx: x, cy: y }));
  }).flat();
}

// polygon-clipping: ブラウザはグローバル、node は vendor UMD を require。
function moduleJoint1PolyClip() {
  if (typeof polygonClipping !== "undefined") return polygonClipping;
  if (typeof require !== "undefined") {
    try {
      return require("../app/vendor/polygon-clipping.umd.js");
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 端部の切り込み（キーホール）を表す矩形スロット。各穴から最寄りの長辺へ
// 幅 1mm のスロットを伸ばす（左列→左辺、右列→右辺）。polygon-clipping の clip 用。
function moduleJoint1SlotRects() {
  const { ox, w } = moduleJoint1Layout();
  const halfW = moduleJoint1R(0.5); // 切り込み幅 1mm
  const over = moduleJoint1R(0.5); // 端を少しはみ出させ確実に開口
  const midX = ox + w / 2;
  return moduleJoint1HoleCenters().map((h) => {
    const leftCol = h.cx < midX;
    const x1 = leftCol ? ox - over : h.cx;
    const x2 = leftCol ? h.cx : ox + w + over;
    return [
      [
        [x1, h.cy - halfW],
        [x2, h.cy - halfW],
        [x2, h.cy + halfW],
        [x1, h.cy + halfW],
      ],
    ];
  });
}

function moduleJoint1PathShape(id = "module-joint-1-outline") {
  const holeR = moduleJoint1R(MODULE_JOINT_1_MM.holeDiameter / 2);
  const base = [
    moduleJoint1OutlineRing(),
    ...moduleJoint1HoleCenters().map((h) =>
      moduleJoint1CircleRing(h.cx, h.cy, holeR).reverse(),
    ),
  ];
  // 切り込み（キーホール）を 2D ジオメトリそのものに焼き込む。3D はこの輪郭を
  // そのまま押し出すだけ（暗黙の cut 処理は持たない）。
  let contours = [base];
  const pc = moduleJoint1PolyClip();
  const slots = moduleJoint1SlotRects();
  if (pc && slots.length) {
    try {
      const diff = pc.difference([base], ...slots);
      if (diff && diff.length) {
        const stripClose = (ring) => {
          const n = ring.length;
          if (
            n > 1 &&
            ring[0][0] === ring[n - 1][0] &&
            ring[0][1] === ring[n - 1][1]
          )
            return ring.slice(0, -1);
          return ring;
        };
        contours = diff.map((poly) => poly.map(stripClose));
      }
    } catch (e) {
      /* フォールバック: 焼き込みなし（穴のみ） */
    }
  }
  return {
    id,
    type: "path",
    contours,
    fill: "#eef6ff",
    stroke: "#14213d",
    strokeWidth: "medium",
  };
}

function moduleJoint1DimensionShapes() {
  const { ox, oy, w, h } = moduleJoint1Layout();
  const holes = moduleJoint1HoleCenters();
  const first = holes[0];
  const second = holes[2];
  const r = moduleJoint1R(MODULE_JOINT_1_MM.holeDiameter / 2);
  return [
    {
      id: "module-joint-1-dim-w",
      type: "dimension",
      dimensionType: "horizontal",
      from: { x: ox, y: oy },
      to: { x: ox + w, y: oy },
      offset: -180,
      textSize: 3,
      suffix: " mm",
    },
    {
      id: "module-joint-1-dim-h",
      type: "dimension",
      dimensionType: "vertical",
      from: { x: ox, y: oy },
      to: { x: ox, y: oy + h },
      offset: -260,
      textSize: 3,
      suffix: " mm",
    },
    {
      id: "module-joint-1-dim-pitch",
      type: "dimension",
      dimensionType: "vertical",
      from: { x: first.cx, y: first.cy },
      to: { x: second.cx, y: second.cy },
      offset: -120,
      textSize: 2.3,
      suffix: " mm pitch",
    },
    {
      id: "module-joint-1-dim-hole",
      type: "dimension",
      dimensionType: "horizontal",
      from: { x: first.cx - r, y: first.cy },
      to: { x: first.cx + r, y: first.cy },
      offset: -150,
      textSize: 2.3,
      prefix: "Ø",
      suffix: " mm",
    },
  ];
}

function moduleJoint1NoteShapes() {
  const { ox, oy, w, h } = moduleJoint1Layout();
  return [
    {
      id: "module-joint-1-title",
      type: "text",
      x: ox + w / 2,
      y: oy - moduleJoint1R(30),
      text: "Module Joint 1 / t=2mm / units:mm",
      fontSize: 3.4,
      fontFamily: "Gen Interface JP",
      fontWeight: "bold",
      textAlign: "center",
      stroke: "#14213d",
    },
    {
      id: "module-joint-1-note",
      type: "text",
      x: ox + w / 2,
      y: oy + h + moduleJoint1R(18),
      text: "R2 / Ø6 / 端部の横線は切り込み",
      fontSize: 3,
      fontFamily: "Gen Interface JP",
      textAlign: "center",
      stroke: "#334155",
    },
  ];
}

function buildModuleJoint1ProjectState(projectName = "Module Joint 1") {
  const { ox, oy, w, h } = moduleJoint1Layout();
  const sectionY = moduleJoint1R((297 - 2) / 2);
  const sectionX = moduleJoint1R((210 - 24) / 2);
  return {
    projectName,
    unit: "mm",
    fonts: [],
    currentPageId: "module-joint-1-top-page",
    currentLayerId: "module-joint-1-layer-outline",
    selectedShapeIds: ["module-joint-1-outline"],
    pages: [
      {
        id: "module-joint-1-top-page",
        name: "上面図",
        paper: "A4",
        orientation: "portrait",
        scale: { ...MODULE_JOINT_1_SCALE },
        viewDefinition: { type: "top", normal: null, up: null },
        dimensions: moduleJoint1DimensionShapes(),
        constraints: [],
        referenceImage: null,
        layers: [
          {
            id: "module-joint-1-layer-outline",
            name: "輪郭・穴・切り込み",
            visible: true,
            locked: false,
            shapes: [moduleJoint1PathShape()],
          },
          {
            id: "module-joint-1-layer-notes",
            name: "注記",
            visible: true,
            locked: false,
            shapes: moduleJoint1NoteShapes(),
          },
        ],
      },
      {
        id: "module-joint-1-section-page",
        name: "正面図",
        paper: "A4",
        orientation: "portrait",
        scale: { ...MODULE_JOINT_1_SCALE },
        viewDefinition: { type: "front", normal: null, up: null },
        dimensions: [
          {
            id: "module-joint-1-section-dim-w",
            type: "dimension",
            dimensionType: "horizontal",
            from: { x: sectionX, y: sectionY },
            to: { x: sectionX + w, y: sectionY },
            offset: -80,
            textSize: 3,
            suffix: " mm",
          },
          {
            id: "module-joint-1-section-dim-t",
            type: "dimension",
            dimensionType: "vertical",
            from: { x: sectionX + w, y: sectionY },
            to: { x: sectionX + w, y: sectionY + moduleJoint1R(2) },
            offset: 80,
            textSize: 3,
            suffix: " mm",
          },
        ],
        constraints: [],
        referenceImage: null,
        layers: [
          {
            id: "module-joint-1-section-layer",
            name: "板厚",
            visible: true,
            locked: false,
            shapes: [
              {
                id: "module-joint-1-section",
                type: "rect",
                x: sectionX,
                y: sectionY,
                width: w,
                height: moduleJoint1R(2),
                // 上面図の輪郭（#eef6ff）と同じ塗り色にして高さを板厚から取る
                fill: "#eef6ff",
                stroke: "#14213d",
                strokeWidth: "medium",
              },
            ],
          },
        ],
      },
    ],
    partIntent: {
      id: "module_joint_1",
      kind: "flat_module_joint",
      units: "mm",
      params: {
        W: MODULE_JOINT_1_MM.width,
        H: MODULE_JOINT_1_MM.height,
        T: MODULE_JOINT_1_MM.thickness,
        holeDiameter: MODULE_JOINT_1_MM.holeDiameter,
        radius: MODULE_JOINT_1_MM.radius,
        pitch: MODULE_JOINT_1_MM.pitch,
      },
    },
    projectBrief: null,
  };
}

function applyModuleJoint1Scenario() {
  const state = buildModuleJoint1ProjectState("Module Joint 1");
  if (typeof replaceState === "function") {
    replaceState(state);
    if (typeof render === "function") render();
    if (typeof uiUpdate === "function") uiUpdate();
  }
  return {
    topPageId: "module-joint-1-top-page",
    sectionPageId: "module-joint-1-section-page",
    shapeId: "module-joint-1-outline",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MODULE_JOINT_1_MM,
    MODULE_JOINT_1_SCALE,
    buildModuleJoint1ProjectState,
    moduleJoint1Layout,
    moduleJoint1PathShape,
    moduleJoint1SlotRects,
    moduleJoint1DimensionShapes,
  };
}

if (typeof window !== "undefined") {
  window.MODULE_JOINT_1_MM = MODULE_JOINT_1_MM;
  window.MODULE_JOINT_1_SCALE = MODULE_JOINT_1_SCALE;
  window.buildModuleJoint1ProjectState = buildModuleJoint1ProjectState;
  window.applyModuleJoint1Scenario = applyModuleJoint1Scenario;
}
