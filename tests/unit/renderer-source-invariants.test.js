"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const rendererSource = fs.readFileSync(
  path.join(ROOT, "app/js/renderer.js"),
  "utf8",
);
const interactionSource = fs.readFileSync(
  path.join(ROOT, "app/js/interaction.js"),
  "utf8",
);

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const paramsStart = source.indexOf("(", start);
  assert.notEqual(paramsStart, -1, `${name} should have parameters`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = paramsStart; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    if (source[i] === ")") parenDepth -= 1;
    if (parenDepth === 0) {
      paramsEnd = i;
      break;
    }
  }
  assert.notEqual(paramsEnd, -1, `${name} parameters should close`);
  const brace = source.indexOf("{", paramsEnd);
  assert.notEqual(brace, -1, `${name} should have a body`);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(brace + 1, i);
  }
  assert.fail(`${name} body should close`);
}

test("transient canvas overlays live in dedicated render roots", () => {
  const renderRootOrder = rendererSource.match(
    /const RENDER_ROOT_ORDER = \[([\s\S]*?)\];/,
  );
  assert.ok(renderRootOrder, "RENDER_ROOT_ORDER should be declared");

  for (const id of ["selection-root", "preview-root", "snap-root"]) {
    assert.match(renderRootOrder[1], new RegExp(`"${id}"`));
  }

  assert.match(
    functionBody(rendererSource, "renderPreview"),
    /_appendToRenderRoot\("preview-root", el\)/,
  );
  assert.match(
    functionBody(rendererSource, "removePreview"),
    /_clearRenderRoot\("preview-root"\)/,
  );
  assert.match(
    functionBody(rendererSource, "removeSnapIndicator"),
    /_clearRenderRoot\("snap-root"\)/,
  );
  assert.doesNotMatch(
    functionBody(rendererSource, "renderSnapIndicator"),
    /_appendRenderNode\(/,
  );
});

test("selection move updates handles without drawing snap residue", () => {
  const liveUpdateBody = functionBody(rendererSource, "liveUpdateShapes");
  assert.match(
    rendererSource,
    /function liveUpdateShapes\(ids, options = \{\}\)/,
  );
  assert.match(liveUpdateBody, /_translateSelectionHandles/);
  assert.match(liveUpdateBody, /_replaceRenderRoot\("selection-root"/);
  assert.match(
    functionBody(rendererSource, "_canLiveTransformSelectionHandles"),
    /ids\?\.length > 0/,
  );
  assert.doesNotMatch(
    functionBody(rendererSource, "_canLiveTransformSelectionHandles"),
    /ids\?\.length === 1/,
  );

  const handleMoveBody = functionBody(interactionSource, "handleSelMove");
  assert.match(handleMoveBody, /liveUpdateShapes\(\s*state\.selectedShapeIds,/);
  // 複製ドラッグ中は translate 追従を使わず state から描き直す
  // （複製開始時のフル再描画でハンドルの基準がずれるため）
  assert.match(handleMoveBody, /_ds\.duplicated\s*\?\s*\{\}/);
  assert.match(handleMoveBody, /removeSnapIndicator\(\)/);
  assert.doesNotMatch(handleMoveBody, /renderSnapIndicator\(/);
});

test("selection move fast path is not limited to single groups", () => {
  const handleMoveBody = functionBody(interactionSource, "handleSelMove");
  const fastBlock = handleMoveBody.match(
    /const fast =([\s\S]*?)if \(fast\) \{/,
  );
  assert.ok(fastBlock, "fast move guard should exist");
  assert.match(fastBlock[1], /state\.selectedShapeIds\.length > 0/);
  assert.doesNotMatch(fastBlock[1], /state\.selectedShapeIds\.length === 1/);
  assert.doesNotMatch(fastBlock[1], /\.shape\.type === "group"/);
  assert.match(handleMoveBody, /liveDragByTransform\(state\.selectedShapeIds/);
});

test("fast selection move finalizes with a live update instead of full render", () => {
  const mouseUpBody = functionBody(interactionSource, "onMouseUp");
  assert.match(
    mouseUpBody,
    /const movedIds = \[\.\.\.getState\(\)\.selectedShapeIds\]/,
  );
  assert.match(mouseUpBody, /clearLiveDragTransforms\(\)/);
  assert.match(mouseUpBody, /liveUpdateShapes\(movedIds\)/);
  assert.doesNotMatch(mouseUpBody, /if \(_ds\.fastActive\) render\(\)/);
});

test("selection move and marquee drags auto-pan near every viewport edge", () => {
  assert.match(interactionSource, /const SELECTION_AUTO_PAN_EDGE_PX = 56/);
  assert.match(
    interactionSource,
    /const SELECTION_AUTO_PAN_MAX_PX_PER_SECOND = 720/,
  );

  const velocityBody = functionBody(
    interactionSource,
    "_selectionAutoPanVelocity",
  );
  assert.match(velocityBody, /value < min \+ edge/);
  assert.match(velocityBody, /value > max - edge/);

  const updateBody = functionBody(
    interactionSource,
    "_updateSelectionAutoPanPointer",
  );
  assert.match(updateBody, /state\.panX \+=/);
  assert.match(updateBody, /state\.panY \+=/);
  assert.match(updateBody, /applyViewportTransform\(\)/);
  assert.match(updateBody, /handleSelMove\(pt, autoPan\.shiftKey\)/);
  assert.match(updateBody, /setMarquee\(_ds\.startPP, pt\)/);

  const mouseMoveBody = functionBody(interactionSource, "onMouseMove");
  const marqueeBlock = mouseMoveBody.match(
    /if \(tool === "select" && _ds\?\.action === "marquee"\) \{([\s\S]*?)\n  \}/,
  );
  assert.ok(marqueeBlock, "marquee drag branch should exist");
  assert.match(marqueeBlock[1], /_updateSelectionAutoPanPointer\(e, svgEl\)/);

  const mouseUpBody = functionBody(interactionSource, "onMouseUp");
  assert.match(mouseUpBody, /_stopSelectionAutoPan\(\)/);
});

test("dimension labels support an optional diameter symbol", () => {
  const body = functionBody(rendererSource, "renderDimensionSVG");
  assert.match(body, /dim\.diameterSymbol === true/);
  assert.match(body, /\"⌀\"/);
  assert.match(body, /\^\[⌀Øφ\]/);
});

test("dimension snapping expands grouped children for precise endpoints", () => {
  const body = functionBody(interactionSource, "getSnapped");
  assert.match(body, /expandGroups: state\.activeTool === "dimension"/);
});

test("keypoint snapping caches drag candidates and skips tiny recalculations", () => {
  assert.match(interactionSource, /const _KEYPOINT_SNAP_RECALC_SCREEN_PX = 2/);
  const snapBody = functionBody(interactionSource, "_moveKeypointSnap");
  assert.match(snapBody, /const cache = \(_ds\.keypointSnap \|\|= \{\}\)/);
  assert.match(
    snapBody,
    /Math\.hypot\(dxP - cache\.dxP, dyP - cache\.dyP\) \* zoom/,
  );
  assert.match(snapBody, /return cache\.result/);
  assert.match(snapBody, /cache\.points = points/);
  assert.match(snapBody, /cache\.targets = getAllShapesOnPage\(page\)/);
  assert.match(snapBody, /cache\.excludeIds = new Set\(ids\)/);
});

test("complex paths use a simplified SVG hit proxy", () => {
  assert.match(
    rendererSource,
    /const complexHitPath = options\.interactive !== false && vertexCount > 512/,
  );
  assert.match(
    rendererSource,
    /"pointer-events": complexHitPath \? "none" : "all"/,
  );
  assert.match(rendererSource, /"data-hit-proxy": "simplified-path"/);
  assert.match(rendererSource, /_simplifySnapRing/);
  assert.match(rendererSource, /function _setComplexPathLivePreview/);
  assert.match(rendererSource, /function liveResizePathByTransform/);
  assert.match(rendererSource, /function clearLiveResizeTransforms/);
  assert.match(interactionSource, /_ds\.pathResizeFast =/);
  assert.match(interactionSource, /if \(_ds\.pathResizeFast\)/);
  assert.match(interactionSource, /const proxyHit = e\.target\.closest/);
  assert.match(interactionSource, /if \(!picked\) picked = findTopShapeAtRealPoint/);
  assert.match(interactionSource, /function _captureSelectionMoveOrigins/);
  assert.match(
    interactionSource,
    /_selOrig = _captureSelectionMoveOrigins\(state\.selectedShapeIds\)/,
  );
  assert.match(interactionSource, /!\(_ds\.lastDxR \|\| _ds\.lastDyR\)/);
  assert.match(
    interactionSource,
    /tool === "select" \|\| tool === "hand"[\s\S]*?\{ gridOnly: true \}/,
  );
});

test("renderer delegates viewport culling decisions to the shared package", () => {
  assert.match(
    rendererSource,
    /const ViewportCulling = globalThis\.ViewportCulling/,
  );
  assert.match(rendererSource, /ViewportCulling\.boxIntersects/);
  assert.match(rendererSource, /ViewportCulling\.isShapeVisibleInCull/);
  assert.match(rendererSource, /ViewportCulling\.visibleShapesForRender/);
});
