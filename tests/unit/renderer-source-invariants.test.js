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
  assert.match(handleMoveBody, /liveUpdateShapes\(state\.selectedShapeIds, \{/);
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

test("renderer delegates viewport culling decisions to the shared package", () => {
  assert.match(
    rendererSource,
    /const ViewportCulling = globalThis\.ViewportCulling/,
  );
  assert.match(rendererSource, /ViewportCulling\.boxIntersects/);
  assert.match(rendererSource, /ViewportCulling\.isShapeVisibleInCull/);
  assert.match(rendererSource, /ViewportCulling\.visibleShapesForRender/);
});
