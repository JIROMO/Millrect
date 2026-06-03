"use strict";

// ── Part 種別ごとの state 生成（Emitter 内部）────────────────────

const PART_STYLES = {
  panel: {
    shapeId: "part-panel-rect",
    fill: "#c9e4ff",
    stroke: "#14213d",
  },
  l_bracket: {
    topShapeId: "part-lbracket-top",
    frontShapeId: "part-lbracket-front",
    top: { fill: "#8fb7ff", stroke: "#14213d" },
    front: { fill: "#ffb347", stroke: "#14213d" },
  },
  enclosure: MULTIVIEW_STARTER_BOX,
};

function _makeShapePage(name, viewType, shape, paper, orientation, scale) {
  return createPage({
    name,
    paper,
    orientation,
    scale: { ...scale },
    viewDefinition: { type: viewType, normal: null, up: null },
    layers: [
      {
        id: genId("layer"),
        name: typeof t === "function" ? t("default.bodyLayer") : "本体",
        visible: true,
        locked: false,
        shapes: [shape],
      },
    ],
  });
}

/** 単板 panel — 上面 1 ページ */
function buildPanelPartState(projectName, options = {}) {
  const paper = options.paper ?? "A4";
  const orientation = options.orientation ?? "landscape";
  const scale = options.scale ?? { numerator: 1, denominator: 10 };
  const mmW = options.sizeMm?.width ?? 200;
  const mmH = options.sizeMm?.height ?? 150;
  const style = PART_STYLES.panel;

  const geom = _starterRectGeom(mmW, mmH, paper, orientation, scale, {
    fill: style.fill,
    stroke: style.stroke,
  });

  const page = _makeShapePage(
    typeof t === "function" ? t("default.topPage") : "上面図",
    "top",
    {
      id: style.shapeId,
      type: "rect",
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      stroke: geom.stroke,
      fill: geom.fill,
      strokeWidth: "medium",
    },
    paper,
    orientation,
    scale,
  );

  const state = initState();
  state.projectName = (projectName || "Untitled").trim() || "Untitled";
  state.pages = [page];
  state.currentPageId = page.id;
  state.currentLayerId = page.layers[0].id;
  state.selectedShapeIds = [];
  return state;
}

/** L 字ブラケット — 上面 L path + 正面 rect */
function buildLBracketPartState(projectName, options = {}) {
  const paper = options.paper ?? "A4";
  const orientation = options.orientation ?? "landscape";
  const scale = options.scale ?? { numerator: 1, denominator: 10 };
  const mm = options.sizeMm ?? {};
  const A = mm.A ?? 80;
  const B = mm.B ?? 60;
  const T = mm.T ?? 5;
  const H = mm.height ?? mm.H ?? 40;
  const styles = PART_STYLES.l_bracket;

  const outer = lBracketTopOuterRing(A, B, T);
  const paperMm = getPaperDimensions({ paper, orientation });
  const [topRing] = centerRingsOnPaper([outer], paperMm, scale);

  const topShape = {
    id: styles.topShapeId,
    type: "path",
    contours: [[topRing]],
    stroke: styles.top.stroke,
    fill: styles.top.fill,
    strokeWidth: "medium",
  };

  const frontGeom = _starterRectGeom(
    A,
    H,
    paper,
    orientation,
    scale,
    styles.front,
  );

  const topPage = _makeShapePage(
    typeof t === "function" ? t("default.topPage") : "上面図",
    "top",
    topShape,
    paper,
    orientation,
    scale,
  );
  const frontPage = _makeShapePage(
    typeof t === "function" ? t("default.frontPage") : "正面図",
    "front",
    {
      id: styles.frontShapeId,
      type: "rect",
      x: frontGeom.x,
      y: frontGeom.y,
      width: frontGeom.width,
      height: frontGeom.height,
      stroke: frontGeom.stroke,
      fill: frontGeom.fill,
      strokeWidth: "medium",
    },
    paper,
    orientation,
    scale,
  );

  const state = initState();
  state.projectName = (projectName || "Untitled").trim() || "Untitled";
  state.pages = [topPage, frontPage];
  state.currentPageId = topPage.id;
  state.currentLayerId = topPage.layers[0].id;
  state.selectedShapeIds = [];
  return state;
}

/** enclosure — 多ビュー box（壁厚 T は manufacturing メタ） */
function buildEnclosurePartState(projectName, options = {}) {
  const sizeMm = options.sizeMm ?? {};
  return buildMultiviewStarterState(
    (projectName || "Untitled").trim() || "Untitled",
    {
      paper: options.paper ?? "A4",
      orientation: options.orientation ?? "landscape",
      scale: options.scale ?? { numerator: 1, denominator: 10 },
      includeSideView: options.includeSideView !== false,
      sizeMm: {
        width: sizeMm.width ?? 120,
        depth: sizeMm.depth ?? 80,
        height: sizeMm.height ?? 50,
      },
      styles: options.styles ?? MULTIVIEW_STARTER_BOX,
    },
  );
}

function buildPartStateFromPlan(compiled, runtimeOpts = {}) {
  const projectName =
    (runtimeOpts.projectName ?? getState()?.projectName ?? "Untitled").trim() ||
    "Untitled";
  const opts = {
    ...compiled.buildOptions,
    ...runtimeOpts,
    projectName,
  };

  switch (compiled.dsl.part) {
    case "panel":
      return {
        newState: buildPanelPartState(projectName, opts),
        sizeMm: opts.sizeMm,
        includeSideView: false,
      };
    case "l_bracket":
      return {
        newState: buildLBracketPartState(projectName, opts),
        sizeMm: opts.sizeMm,
        includeSideView: false,
      };
    case "enclosure":
      return {
        newState: buildEnclosurePartState(projectName, opts),
        sizeMm: opts.sizeMm,
        includeSideView: opts.includeSideView,
      };
    case "box":
    default:
      return _buildMultiviewBoxState(opts);
  }
}

/** part 種別ごとに更新可能な param 名 */
function partParamKeys(part) {
  switch (part) {
    case "panel":
      return ["W", "H"];
    case "l_bracket":
      return ["A", "B", "T", "H"];
    case "enclosure":
      return ["W", "D", "H", "T"];
    case "box":
    default:
      return ["W", "D", "H"];
  }
}
