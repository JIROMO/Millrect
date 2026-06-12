"use strict";

/** real units: 1 mm = 10 paper units */
const MULTIVIEW_STARTER_MM = { width: 120, depth: 80, height: 50 };
const MULTIVIEW_STARTER_UNIT = 10;

const MULTIVIEW_STARTER_BOX = {
  topShapeId: "starter-top-rect",
  frontShapeId: "starter-front-rect",
  sideShapeId: "starter-side-rect",
  top: {
    fill: "#8fb7ff",
    stroke: "#14213d",
  },
  front: {
    fill: "#ffb347",
    stroke: "#14213d",
  },
  side: {
    fill: "#7bc896",
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
