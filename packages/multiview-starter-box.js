"use strict";

/** real units: 1 mm = 10 paper units */
const MULTIVIEW_STARTER_MM = { width: 120, depth: 80, height: 50 };
const MULTIVIEW_STARTER_UNIT = 10;

const MULTIVIEW_STARTER_BOX = {
  topShapeId: "starter-top-rect",
  frontShapeId: "starter-front-rect",
  sideShapeId: "starter-side-rect",
  // 3D の高さは直交ビューの「同じ fill 色」の輪郭から決まるため、
  // 全ビューで同じ塗り色を使う（色を変えると全高近似 + 警告になる）
  top: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
  front: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
  side: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MULTIVIEW_STARTER_MM,
    MULTIVIEW_STARTER_UNIT,
    MULTIVIEW_STARTER_BOX,
  };
}

if (typeof window !== "undefined") {
  window.MULTIVIEW_STARTER_MM = MULTIVIEW_STARTER_MM;
  window.MULTIVIEW_STARTER_UNIT = MULTIVIEW_STARTER_UNIT;
  window.MULTIVIEW_STARTER_BOX = MULTIVIEW_STARTER_BOX;
}
