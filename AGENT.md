# Millrect — AI Agent Manual

**日本語:** [AGENT.ja.md](AGENT.ja.md)

Instructions for AI agents (Claude / MCP / scripts) operating Millrect.  
All functions are exposed in the global scope and can be called via `window.xxx()` or `xxx()`.

**Product philosophy:** [millrect.com/docs/philosophy.html](https://millrect.com/docs/philosophy.html) — Millrect is a **shared drawing space for humans and agents**, not full delegation of drawings to AI. Prefer **Intent API / MCP tools** over browser UI automation.

## MCP reference

When operating via the MCP server (`mcp/server.js`), this manual is published as a Resource.

| Resource URI | Content |
|--------------|---------|
| `millrect://docs/agent-manual` | Full manual (this document) |
| `millrect://docs/workflow` | Operation checklist (short) |
| `millrect://docs/mcp-reference` | **Supplement:** full MCP tool list + `apply_commands` actions |
| `millrect://docs/taste-memory` | [docs/TASTE-MEMORY.md](docs/TASTE-MEMORY.md) — Taste Memory (Project / Global / Artifact layers) |

Standard prompts: `operate_drawing` (2D), `create_3d_model` (multiview 3D).

**Before drawing operations, always read `agent-manual`, then check `get_project_context` → `validate_3d_readiness`.**  
For a complete MCP tool index (including `undo`, Boolean ops, constraints), also read `mcp-reference` or [docs/MCP-REFERENCE.md](docs/MCP-REFERENCE.md). Repository layout and architecture: [docs/en/developer.html](docs/en/developer.html).

## Intent API (preferred for agents)

Use **high-level MCP tools** before raw `apply_commands`. They accept **mm** and handle layout / multiview setup internally.

| MCP tool | WS action | Purpose |
|----------|-----------|---------|
| `create_multiview_box` | `createMultiviewBox` | Box from `width_mm` / `depth_mm` / `height_mm` → top + front (+ optional right) pages |
| `create_part` | `createPart` | Semantic part: `kind: "box"` + `features[]` (e.g. `hole_grid` on top view) |
| `layout_rect_mm` | `layoutRectOnPageMm` | Centered rect on current page |
| `validate_3d_readiness` | `validate3DReadiness` | Structured pre-check (axes, closed contours, issues[]) |

Example flow:

```
validate_3d_readiness          → see what's missing
create_multiview_box           → { width_mm: 120, depth_mm: 80, height_mm: 50, views: ["top","front","right"] }
create_part                  → { kind: "box", features: [{ type: "hole_grid", view: "top", count: [2,2] }] }
update_3d_scene                → confirm mesh
apply_commands                 → only for fine edits (holes, offsets, etc.)
```

Global functions (scripts / WS): `createMultiviewBox()`, `createPart()`, `layoutRectOnPageMm()`, `validate3DReadiness()`, `runDocsScenario()`, `setReferenceImage()`, `applyDigitizeProposals()`, `confirmDigitizeProposals()`.

### Sketch digitization (reference image + ghost shapes)

**Goal:** Rough sketch/photo → editable drawing, not pixel-perfect CAD. Millrect does **not** run Vision internally — an external LLM produces **proposals** in mm.

**Workflow (agent or human):**

```
load_reference_image          → underlay on current page
set_reference_scale_anchor    → 2 points + length_mm (or UI: Pages → Reference image → Calibrate scale)
digitize_sketch               → proposals[] as ghost shapes (semi-transparent, dashed)
confirm_digitize_proposals    → ghosts become normal shapes (3D profiles enabled)
validate_3d_readiness         → check before 3D
```

**Human UI:** Pages tab → **Reference image** — load file, **Move & resize** (toggle: click again to exit), opacity, scale calibration (both ends of a known-length line + mm + Apply), confirm/remove ghosts.

**Taste brief UI:** Pages tab → **Taste brief** — inspect `projectBrief` intent / phase / principles / decisions and the "require brief before generating parts" guard.

**Proposal schema (mm-first):**

```json
{ "type": "rect", "x_mm": 10, "y_mm": 20, "width_mm": 80, "height_mm": 50 }
{ "type": "circle", "cx_mm": 40, "cy_mm": 40, "r_mm": 5 }
{ "type": "line", "x1_mm": 0, "y1_mm": 0, "x2_mm": 100, "y2_mm": 0 }
```

**Ghost shapes:** `shape.ghost === true` — visible on canvas, **excluded** from `extractProfilesFromPage()` and 3D until confirmed.

| MCP tool | WS action | Purpose |
|----------|-----------|---------|
| `load_reference_image` | `loadReferenceImageFromFile` | Image file → `page.referenceImage` |
| `set_reference_scale_anchor` | `setReferenceImageScaleAnchor` | Scale underlay from 2 points + mm |
| `digitize_sketch` | `applyDigitizeProposals` | Place proposals as ghosts (`confirm: true` to finalize in one step) |
| `confirm_digitize_proposals` | `confirmDigitizeProposals` | Remove ghost flag from shapes |

### Documentation via MCP (Electron required)

For docs screenshots, **MCP + running Electron** is more accurate than guessing coordinates:

Durable documentation-production memory lives in
[docs/design/documentation-system.md](docs/design/documentation-system.md).
Before changing generated docs screenshots, read its source-finding notes and
update scenario code rather than editing PNGs directly.

1. `list_docs_scenarios` → `run_docs_scenario` — reproducible scene (mm-based)
2. `capture_screenshot` — PNG to `docs/images/...` with `target`, `view_type`, `scenario`
3. `npm run docs:screenshots` — batch fallback (Playwright script)

| MCP tool | Purpose |
|----------|---------|
| `list_docs_scenarios` | Scenario catalog |
| `run_docs_scenario` | Apply named docs scene |
| `capture_screenshot` | Save PNG (viewport, toolbar, panel_3d, …) |
| `load_reference_image` | Sketch/photo underlay |
| `set_reference_scale_anchor` | Calibrate reference scale from 2 points + mm |
| `digitize_sketch` | Place Vision LLM primitive proposals as ghost shapes (mm) |
| `confirm_digitize_proposals` | Confirm ghost shapes → normal drawing objects |

### Part DSL + Solver (v1 — Tier 3)

**Parts:** `box`, `panel`, `l_bracket`, `enclosure`  
**Features:** `hole_grid`, `slot`, `fillet`, `pattern_linear`  
**Manufacturing:** `manufacturing: { process, thickness_mm, kerf_mm, min_hole_diameter_mm, min_edge_distance_mm }`

```json
{
  "version": 1,
  "part": "panel",
  "params": { "W": 200, "H": 150 },
  "manufacturing": { "process": "laser_cut", "thickness_mm": 3, "kerf_mm": 0.2 },
  "features": [
    { "type": "fillet", "radius_mm": 3 },
    { "type": "slot", "x_mm": 20, "y_mm": 30, "width_mm": 40, "height_mm": 5 }
  ]
}
```

| MCP tool | Purpose |
|----------|---------|
| `compile_part_dsl` | Dry-run: DSL → compile plan (no state change) |
| `apply_part_dsl` | DSL → geometry in document |
| `validate_manufacturability` | Manufacturing rules check (no state change) |
| `update_part_param` | Change params — Solver diff when `partIntent` exists |
| `import_part_dsl_file` | Load `.mlr-part.json` and apply |

Pipeline: **DSL** → **Compiler** → **Emitter** (`applyPartDsl`) → **Param Solver** (`applyParamBindSolver`) → **Geometry Solver** (`applyConstraints`).

`state.partIntent` persists DSL, bindings, and features (Undo/export via `DOC_KEYS`).

## Critical rules for agents

1. **2D drawing is the only source of truth.** 3D is derived and can always be regenerated with `update3DScene()`.
2. **3D uses multiview intersection only.** Do not use per-shape `feature.depth` (extrusion hints) — removed from UI.
3. **Solids require multiple orthographic pages.** e.g. top view page + front view page. Assign `viewDefinition.type` and draw closed contours on each.
4. **Dimensions live in `page.dimensions[]`.** Do not mix them into `layer.shapes[]`.
5. After shape changes, always call `render(); uiUpdate();`. For 3D, use `update3DScene(); get3DSceneStatus();`.

## 3D pipeline boundaries

When improving 3D accuracy, keep edits inside the pipeline packages whenever possible:

| Area | Responsibility |
|------|----------------|
| `packages/schema` | Project JSON, Part DSL, Model IR, geometry-data validation |
| `packages/model-generator` | Project JSON / profiles / Part DSL features → editable Model IR operations |
| `packages/geometry-core` | Model IR → deterministic geometry data, export-ready mesh/CSG data |
| `packages/model-viewer` | Three.js display, camera, selection/highlight only |
| `app/js/3d-view.js` | Legacy multiview CSG preview/STL wrapper; keep compatibility changes minimal |

Runnable apps belong under `apps/`; reusable libraries belong under `packages/`.
The existing 2D editor currently remains in `app/` for compatibility. If it is
relocated, the target is `apps/millrect-editor`, not `packages/`. Extract only
reusable 2D primitives (drawing schema, profile extraction, command reducers,
rendering helpers) into packages.

Do not modify 2D editing UI to fix 3D accuracy unless there is no other path.
Do not perform DOM work inside generation code. Do not make Three.js the geometry
core. Meshes are outputs, not the only internal representation. Use
`get3DModelPipelineState()` after `update3DScene()` to inspect the new
Project JSON → Model IR → geometry-data wrapper.

---

## Coordinate system

| Concept | Value |
|---------|-------|
| Unit | real units (1 mm = 10 units) |
| A4 landscape | 2970 × 2100 |
| A4 portrait | 2100 × 2970 |
| A3 landscape | 4200 × 2970 |

With scale 1:10 (`scale: {numerator:1, denominator:10}`):

```
paperUnit = realUnit × numerator / denominator
realUnit  = paperUnit × denominator / numerator
```

---

## Shape schema

```js
// Common fields
{
  id: string,            // generate with genId('shape')
  type: string,
  stroke: string,        // e.g. "#1a1a2e"
  fill: string,          // color or "none"
  strokeWidth: "thin" | "medium" | "thick",

  // Visual transforms (reflected in SVG, getBBox, alignment, Profile, and 3D)
  rotation?: number,
  flipH?: boolean,
  flipV?: boolean,

  // feature (legacy; unused for 3D; stripped on import)
  // feature?: { type: "extrude", depth: number, bevel?: boolean, bevelSize?: number },
}

// rect
{ type:"rect", x, y, width, height, rx? }

// circle
{ type:"circle", cx, cy, r }

// line
{ type:"line", x1, y1, x2, y2,
  role?: "drawing"|"cut"|"annotation"|"construction" }  // default "drawing"
//   all roles are display style only; lines are never 3D sources.
//   to cut in 3D, bake the notch into the shape geometry itself (edit the path outline /
//   boolean-subtract) — a line never implicitly cuts the solid.

// text
{ type:"text", x, y, text:string,
  fontSize?:number,        // px (default 3.5)
  fontFamily?:string,      // bundled Gen Interface JP, or family from state.fonts[]
  fontWeight?: "normal"|"bold",
  textAlign?: "left"|"center"|"right",
  lineHeight?:number,
  width?:number            // wrap width in mm; omit for single line
}
// Note: text color uses stroke (not fill)

// bezier
{ type:"bezier", nodes: [{x, y, h1:{x,y}|null, h2:{x,y}|null}], closed: boolean }

// path
{ type:"path", contours: [ring[][]] }   // polygon-clipping format

// group
{ type:"group", children: Shape[] }
```

## Dimension schema (stored in `page.dimensions[]`)

```js
{
  id: string,
  type: "dimension",
  dimensionType: "horizontal" | "vertical",
  from: {x, y},
  to:   {x, y},
  offset: number,

  // Style (optional)
  color?: string,
  lineWidth?: number,
  textSize?: number,
  arrowStyle?: "dot"|"arrow"|"slash"|"open",
  fontFamily?: string,

  // Number format (optional)
  value?: number,
  decimals?: number,
  prefix?: string,
  suffix?: string,

  // Text placement (optional)
  textOffsetX?: number,
  textOffsetY?: number,
  textRotation?: number,
}
```

> **Important:** dimensions are not stored in `layer.shapes[]`.  
> Calling `addShape({ type:"dimension", ... })` routes them to `page.dimensions[]` automatically.

## Page.viewDefinition (required for 3D)

Assign an orthographic view type to each page. 3D is derived by **CSG intersection of drawing contours**.

| type | Meaning |
|------|---------|
| `top` / `bottom` | Top / bottom view |
| `front` / `back` | Front / back view |
| `right` / `left` | Right / left view |
| `section` / `detail` | Section / detail (treated as `top` internally) |

```js
page.viewDefinition = { type: "top", normal: [0,0,1], up: [0,1,0] };
```

**Minimum for 3D:** at least two orthogonal views (e.g. top + front). A single page yields `get3DSceneStatus().meshCount === 0`.

**Do not** attach 3D hints via `feature.depth` etc. (UI removed; drawing-first only).

---

## Basic operation patterns

```js
// ① Add a shape
addShape({
  id: genId('shape'), type: 'rect',
  x: 100, y: 100, width: 500, height: 300,
  stroke: '#1a1a2e', fill: 'none', strokeWidth: 'medium'
});
render(); uiUpdate();

// ② Update a shape
updateShape('shape-xxxx', { fill: '#ff0000' });
render(); uiUpdate();

// ③ Delete a shape
deleteShape('shape-xxxx');
render(); uiUpdate();

// ④ Selection
getState().selectedShapeIds = ['shape-xxxx'];
uiUpdate();

// ⑤ Add a dimension (auto-routed to page.dimensions[])
addShape({
  id: genId('dim'), type: 'dimension',
  dimensionType: 'horizontal',
  from: {x: 100, y: 500}, to: {x: 600, y: 500},
  offset: 50,
  stroke: '#1a1a2e', fill: 'none', strokeWidth: 'thin',
});
render(); uiUpdate();
```

---

## State API

```js
getState()                   // → _state object
getCurrentPage()             // → current Page
getCurrentLayer()            // → current Layer
getAllShapesOnPage(page)      // → Shape[] (excludes dimensions)
getAllDimensionsOnPage(page)  // → Dimension[]
findShapeById(id)            // → { shape, layer, page, isDimension } | null
                             //   layer is null when isDimension=true
pushHistory()                // records document parts only → triggers autosave
undo() / redo()              // → boolean; zoom/pan/tool unchanged
replaceState(newState)       // replace full state (resets history)
genId(prefix)                // generate unique ID
```

---

## Profile API (3D / contour extraction)

```js
canBeProfile(shape)  // → boolean

extractProfilesFromPage(page)
// → [{ id, sourceId, pageId, rings, bbox, area }]
// Supported: rect / circle / bezier(closed) / path
// Not supported: line / text / dimension / bezier(open) / group

shapeToProfile(shape, pageId)  // → Profile | null
```

---

## Shape manipulation API

```js
addShape(shape)
updateShape(id, values)
deleteShape(id)
deleteSelectedShapes()

shiftShape(shape, dx, dy)         // direct mutation (does not call pushHistory)
moveShapeToPosition(id, x, y)     // move bbox top-left to (x,y) → pushHistory()

cloneSelectedShapes(dx, dy)       // → new id[]
duplicateShapes()                 // offset duplicate → pushHistory()

alignShapes(dir)
// dir: 'left'|'centerH'|'right'|'top'|'centerV'|'bottom'
// 1 selected → page bounds; multiple → selection bounds

distributeShapes(axis)            // 'h' | 'v' (needs ≥3 shapes)

flipShapes('h' | 'v')            // SVG display only; coordinates unchanged
rotateShapes(deg)                 // SVG display only; no effect on 3D

groupSelectedShapes()
ungroupSelectedShapes()
mergeSelectedShapes()             // union
subtractSelectedShapes()          // difference
intersectSelectedShapes()         // intersection
excludeSelectedShapes()           // exclude
flattenSelectedShapes()           // flatten path/group
```

---

## Text outline API (Electron)

```js
isTextOutlineAvailable()          // → boolean
outlineTextShape(shapeOrId)       // replace text with path group; pushHistory() called
// Browser-only: shows alert and exits
// macOS: Core Text; otherwise fontkit
```

To use text in 3D contours:
1. `addShape({ type:"text", ... })`
2. `outlineTextShape(id)` → path group
3. Set viewDefinition on each page, then `update3DScene()`

No dedicated MCP tool for `outlineTextShape`. After adding text via `apply_commands`, call it over WS (UI operation is usually easier).

---

## Project fonts (`state.fonts[]`)

Google Fonts registered via Fontsource API. Part of Undo/export (`DOC_KEYS`).

```js
{
  id: "font-xxx",
  family: "Roboto",
  cssUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
  fileUrl: "https://cdn.jsdelivr.net/fontsource/fonts/roboto@.../latin-400-normal.ttf",
  fileUrlBold: "https://cdn.jsdelivr.net/fontsource/fonts/roboto@.../latin-700-normal.ttf",
  source: "google",
  libraryId: "libfont-yyy"
}
```

| Action | Function / UI |
|--------|---------------|
| Search & register from Fontsource | UI "Find fonts…" → `openFontBrowserModal()` |
| Register from URL | `registerGoogleFontCssUrl(url)` |
| Library → project | `addProjectFontFromLibrary(entry)` |
| Remove from project | `removeProjectFont(fontId)` |
| Font choices | `getFontFamilyOptions()` → bundled + `fonts[]` |

**Note:** modal lists Fontsource (Google catalog), not system-installed fonts.  
User library persists in `userData/fonts-library.json` (Electron), separate from project JSON.

---

## Geometric constraints API

```js
addConstraint({ type:'horizontal', shapeIds:['l1'] })
addConstraint({ type:'vertical',   shapeIds:['l1'] })
addConstraint({ type:'parallel',   shapeIds:['l1','l2'] })
addConstraint({ type:'equal_length', shapeIds:['l1','l2'] })
addConstraint({ type:'fixed',      shapeIds:['r1'], params:{ x:100, y:100 } })
addConstraint({ type:'coincident', shapeIds:['l1','l2'],
                params:{ point1:'end', point2:'start' } })

removeConstraint('cst-id')
applyConstraints()
getConstraintsForShape('shape-id')   // → Constraint[]
getAllConstraints()                    // → Constraint[] (current page)
```

---

## Batch operations API (recommended)

```js
applyDrawingCommands([
  { action: 'addShape',
    shape: { id: genId('shape'), type: 'rect', x:100, y:100, width:400, height:200,
             stroke:'#1a1a2e', fill:'none', strokeWidth:'medium' } },

  { action: 'addDimension',
    dimension: { id: genId('dim'), dimensionType:'horizontal',
                 from:{x:100,y:400}, to:{x:500,y:400}, offset:30,
                 stroke:'#1a1a2e', fill:'none', strokeWidth:'thin' } },

  { action: 'addConstraint',
    constraint: { id: genId('cst'), type:'horizontal', shapeIds:['l1'] } },

  { action: 'updateShape',
    id: 'existing-id',
    values: { fill: '#4a9eff' } },

  { action: 'deleteShape',     id: 'shape-to-delete' },
  { action: 'removeConstraint', id: 'cst-id' },

  { action: 'selectShapes',    ids: ['shape-xxxx'] },
  { action: 'applyConstraints' },

  { action: 'setPageScale',    scale: { numerator:1, denominator:10 } },
  { action: 'setPagePaper',    paper:'A4', orientation:'landscape' },
  { action: 'setProjectName',  name: 'My Project' },
  { action: 'addPage' },
]);
render(); uiUpdate();
```

---

## Page & layer API

```js
addPage(createPage({ name:'Page 2', paper:'A3', orientation:'landscape' }))
deletePage(id)
updatePage(id, { name: 'New name' })

addLayer(pageId, createLayer({ name: 'Outline' }))
deleteLayer(pageId, layerId)
updateLayer(pageId, layerId, { visible: false, locked: true })

getState().currentPageId = page.id;
getState().currentLayerId = page.layers[0].id;
render(); uiUpdate();
```

---

## BBox

```js
const ID_SCALE = { numerator:1, denominator:1 };
const bb = getShapeBBox(shape, ID_SCALE);
// → { x, y, w, h } (top-left, size in real units) | null
```

---

## Render updates

```js
render()    // full SVG redraw (required after geometry changes)
uiUpdate()  // sync property panel, layers, pages
fitPage()   // zoom to fit page in viewport
```

---

## Export API

```js
exportProjectJsonString()
exportCurrentPageSvg()
exportAllPagesPdf()         // async
exportSTL()
```

---

## 3D API (multiview intersection)

```js
update3DScene()       // regenerate mesh via CSG from all pages[]
get3DSceneStatus()    // → { meshCount: number, message: string|null }
exportSTL()           // download STL (alert if meshCount=0)
```

When `message` is non-null, views or contours are insufficient. Examples:
- "Add a front view (or side view) in addition to the top view"
- "Draw closed contours (rect, circle, path, etc.) on each view"

---

## Examples

### Add a rectangle and center it on the page

```js
const id = genId('shape');
addShape({
  id, type:'rect', x:0, y:0, width:500, height:300,
  stroke:'#1a1a2e', fill:'#4a9eff33', strokeWidth:'medium'
});
getState().selectedShapeIds = [id];
alignShapes('centerH'); alignShapes('centerV');
render(); uiUpdate();
```

### Generate 3D from multiview (top + front)

```js
const state = getState();
const topPage = state.pages[0];
topPage.name = "Top view";
topPage.viewDefinition = { type: "top", normal: [0,0,1], up: [0,1,0] };
topPage.layers[0].shapes.push({
  id: genId("shape"), type: "rect",
  x: 100, y: 100, width: 1000, height: 800,
  stroke: "#1a1a2e", fill: "#8fb7ff", strokeWidth: "medium",
});

const frontPage = createPage({
  name: "Front view",
  viewDefinition: { type: "front", normal: [0,-1,0], up: [0,0,1] },
});
frontPage.layers[0].shapes.push({
  id: genId("shape"), type: "rect",
  x: 100, y: 500, width: 1000, height: 500,
  stroke: "#1a1a2e", fill: "#ffb347", strokeWidth: "medium",
});
state.pages.push(frontPage);
replaceState(state);
render(); uiUpdate();

update3DScene();
console.log(get3DSceneStatus()); // { meshCount: 1, message: null }
```

### Add a horizontal dimension

```js
addShape({
  id: genId('dim'), type:'dimension',
  dimensionType:'horizontal',
  from:{x:200, y:700}, to:{x:800, y:700}, offset:60,
  stroke:'#1a1a2e', fill:'none', strokeWidth:'thin',
});
render(); uiUpdate();
```

### List profiles on the current page

```js
const profiles = extractProfilesFromPage(getCurrentPage());
profiles.forEach(p => {
  console.log(p.sourceId, 'area:', p.area.toFixed(1), 'bbox:', p.bbox);
});
```

---

## Notes

- `shiftShape()` does not call `pushHistory()`. Call `pushHistory()` → `render()` → `uiUpdate()` yourself after changes.
- `addShape()` / `updateShape()` / `deleteShape()` call `pushHistory()` internally.
- `applyDrawingCommands()` calls `pushHistory()` once at the end (batch-friendly).
- IDs must be unique. Use `genId('shape')` / `genId('dim')`.
- When `layer.locked === true`, `addShape()` fails for normal shapes (returns false).
- `render()` is RAF-debounced; rapid calls coalesce to one frame.
- `rotation` / `flipH` / `flipV` are reflected in SVG, `getShapeBBox`, alignment, Profile extraction, and 3D.
- **3D comes from drawings.** Do not use `feature.depth`. Draw top + front (≥2 views) and call `update3DScene()`.
- Legacy `feature` fields in imported JSON are ignored for 3D generation.
