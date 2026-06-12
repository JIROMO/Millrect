"use strict";

function _starterRectGeom(mmW, mmH, paper, orientation, scale, style) {
  const dims = getPaperDimensions({ paper, orientation });
  const wReal = mmToReal(mmW);
  const hReal = mmToReal(mmH);
  const wPaper = realToPaperDist(wReal, scale);
  const hPaper = realToPaperDist(hReal, scale);
  const xPaper = (dims.width - wPaper) / 2;
  const yPaper = (dims.height - hPaper) / 2;
  return {
    x: paperToRealDist(xPaper, scale),
    y: paperToRealDist(yPaper, scale),
    width: wReal,
    height: hReal,
    ...style,
  };
}

function buildMultiviewStarterState(
  projectName,
  {
    paper = "A4",
    orientation = "landscape",
    scale = { numerator: 1, denominator: 10 },
    includeSideView = false,
    sizeMm = MULTIVIEW_STARTER_MM,
    styles = MULTIVIEW_STARTER_BOX,
  } = {},
) {
  const box = styles;
  const mm = sizeMm;
  const topGeom = _starterRectGeom(
    mm.width,
    mm.depth,
    paper,
    orientation,
    scale,
    box.top,
  );
  const frontGeom = _starterRectGeom(
    mm.width,
    mm.height,
    paper,
    orientation,
    scale,
    box.front,
  );
  const sideGeom = includeSideView
    ? _starterRectGeom(mm.depth, mm.height, paper, orientation, scale, box.side)
    : null;

  function makePage(name, viewType, shapeId, geom) {
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
          shapes: [
            {
              id: shapeId,
              type: "rect",
              x: geom.x,
              y: geom.y,
              width: geom.width,
              height: geom.height,
              stroke: geom.stroke,
              fill: geom.fill,
              strokeWidth: "medium",
            },
          ],
        },
      ],
    });
  }

  const topPage = makePage(
    typeof t === "function" ? t("default.topPage") : "上面図",
    "top",
    box.topShapeId,
    topGeom,
  );
  const frontPage = makePage(
    typeof t === "function" ? t("default.frontPage") : "正面図",
    "front",
    box.frontShapeId,
    frontGeom,
  );
  const pages = [topPage, frontPage];
  if (includeSideView && sideGeom) {
    pages.push(
      makePage(
        typeof t === "function" ? t("default.rightPage") : "右側面図",
        "right",
        box.sideShapeId,
        sideGeom,
      ),
    );
  }
  const state = initState();
  state.projectName = (projectName || "Untitled").trim() || "Untitled";
  state.pages = pages;
  state.currentPageId = topPage.id;
  state.currentLayerId = topPage.layers[0].id;
  state.selectedShapeIds = [];
  return state;
}

function fitMultiviewStarterView() {
  const page = getCurrentPage();
  const shapeId = MULTIVIEW_STARTER_BOX.topShapeId;
  const found = findShapeById(shapeId);
  if (!found?.shape) {
    fitPage?.();
    return false;
  }

  const bb = getShapeBBox(found.shape, page.scale);
  const state = getState();
  const toolbarH = 44;
  const statusH = 24;
  const sidebar = document.getElementById("sidebar-right");
  const leftOff = 72;
  const rightOff = (sidebar?.offsetWidth || 260) + 16;
  const margin = 48;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const availW = cw - leftOff - rightOff - margin * 2;
  const availH = ch - toolbarH - statusH - margin * 2;
  const zoom = Math.min(availW / bb.w, availH / bb.h) * 0.82;
  state.zoom = Math.max(0.2, Math.min(zoom, 15));
  state.panX =
    leftOff + margin + (availW - bb.w * state.zoom) / 2 - bb.x * state.zoom;
  state.panY =
    toolbarH + margin + (availH - bb.h * state.zoom) / 2 - bb.y * state.zoom;
  return true;
}

function openMultiviewStarterProject() {
  if (
    !confirm(
      typeof t === "function"
        ? t("multiview.replaceConfirm")
        : "現在の図面を 3D サンプル（上面図・正面図）に置き換えますか？\nUndo で元に戻せます。",
    )
  ) {
    return;
  }
  const page = getCurrentPage();
  replaceState(
    buildMultiviewStarterState(getState().projectName, {
      paper: page.paper,
      orientation: page.orientation,
      scale: { ...page.scale },
    }),
  );
  if (typeof onStateChanged === "function") onStateChanged();
  fitMultiviewStarterView();
  render();
  uiUpdate();
  if (typeof update3DScene === "function") update3DScene();
}
