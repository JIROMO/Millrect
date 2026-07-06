# Millrect — MCP Tool Reference (supplement)

**日本語:** 同内容の HTML は [docs/developer.html](developer.html#mcp-tools)（開発者ガイド）  
**Primary agent manual:** `AGENT.md` / Resource `millrect://docs/agent-manual`  
**User-facing MCP setup:** [docs/ai-mcp.html](ai-mcp.html)

This document lists **all MCP tools** and **`apply_commands` actions**.  
For schemas, coordinates, and drawing rules, read `agent-manual` first.

## Naming layers

| Layer | Naming | Used by |
|-------|--------|---------|
| MCP tools | `snake_case` | Claude Desktop, Cursor (`mcp/server.js`) |
| WebSocket `action` | `camelCase` | Direct WS (`main.js`) |
| `apply_commands` body | `camelCase` | `addShape`, `updateShape`, … |

## MCP tools (snake_case → WS action)

| MCP tool | WS action | Description |
|----------|-----------|-------------|
| `get_project_context` | `getProjectContext` | **Call first** — shapes, profiles, viewDefinition |
| `get_state` | `getState` | Current page shapes / dimensions / profiles |
| `validate_3d_readiness` | `validate3DReadiness` | Structured 3D readiness check |
| `compile_part_dsl` | `compilePartDsl` | Part DSL dry-run |
| `apply_part_dsl` | `applyPartDsl` | Apply Part DSL v1 to document |
| `update_part_param` | `updatePartParam` | Update W/D/H mm (Solver when `partIntent` exists) |
| `import_part_dsl_file` | `importPartDslFile` | Load `.mlr-part.json` from disk |
| `create_part` | `createPart` | Semantic part (`box` + features) |
| `create_multiview_box` | `createMultiviewBox` | Multiview box in mm |
| `layout_rect_mm` | `layoutRectOnPageMm` | Centered rect on current page (mm) |
| `load_reference_image` | `loadReferenceImageFromFile` | Reference image underlay |
| `set_reference_scale_anchor` | `setReferenceImageScaleAnchor` | 2-point scale calibration (mm) |
| `digitize_sketch` | `applyDigitizeProposals` | Vision proposals → ghost shapes |
| `confirm_digitize_proposals` | `confirmDigitizeProposals` | Confirm ghosts → normal shapes |
| `validate_manufacturability` | `validatePartManufacturability` | Manufacturing rules (Part DSL) |
| `apply_commands` | `applyCommands` | Low-level drawing commands (see below) |
| `clear_canvas` | `clearCanvas` | Clear current layer shapes |
| `get_svg` | `getSvg` | Current page SVG string |
| `align_shapes` | `alignShapes` | Align selection |
| `distribute_shapes` | `distributeShapes` | Distribute selection |
| `undo` / `redo` | `undo` / `redo` | Undo / Redo |
| `set_selected_shapes` | `setSelectedShapes` | Change selection |
| `group_shapes` / `ungroup_shapes` | `groupShapes` / `ungroupShapes` | Group / ungroup |
| `boolean_union` | `booleanUnion` | Boolean union |
| `boolean_subtract` | `booleanSubtract` | Boolean subtract |
| `boolean_intersect` | `booleanIntersect` | Boolean intersect |
| `boolean_exclude` | `booleanExclude` | Boolean exclude |
| `boolean_flatten` | `booleanFlatten` | Flatten to path |
| `add_constraint` | `addConstraint` | Add geometric constraint |
| `remove_constraint` | `removeConstraint` | Remove constraint |
| `get_constraints` | `getConstraints` | List constraints |
| `update_3d_scene` | `update3DScene` | Regenerate 3D mesh |
| `get_3d_scene_status` | `get3DSceneStatus` | 3D status (no regen) |
| `list_docs_scenarios` | `listDocsScenarios` | Docs screenshot scenarios |
| `run_docs_scenario` | `runDocsScenario` | Apply docs scenario |
| `capture_screenshot` | (main process) | PNG capture (Electron) |

**WebSocket:** `ws://127.0.0.1:23450` (retries +1 if busy). Token file: `~/.millrect/millrect-ws-token`.

## `apply_commands` actions

| action | Description |
|--------|-------------|
| `addShape` | Add shape (`type:"dimension"` → `page.dimensions[]`) |
| `updateShape` | Update shape |
| `deleteShape` | Delete shape |
| `addDimension` | Add dimension explicitly |
| `updateDimension` | Update dimension |
| `selectShapes` | Change selection |
| `setPagePaper` | Paper and orientation |
| `setPageScale` | Scale |
| `setProjectName` | Project name |
| `addPage` | Add page |
| `addConstraint` | Add constraint |
| `removeConstraint` | Remove constraint |
| `applyConstraints` | Apply all constraints immediately |

### Placement (auto-positioning of added shapes)

`apply_commands` takes an optional top-level `placement` parameter that controls where the
batch of newly added shapes lands on the paper:

| value | Behavior |
|-------|----------|
| `auto` (default) | Empty page → centered on paper. Overlapping existing shapes or placed far away from them → moved to free space. Fully inside an existing shape (hole / boolean overlay) or within 20 mm of one (connector lines, annotations) → kept as-is. |
| `center` | Always centered on paper. |
| `none` | Use coordinates exactly as given. |

Shapes and dimensions added in the same batch shift together, so relative coordinates
within a batch are preserved — draw new parts starting at the origin `(0,0)` and let
placement decide where they go. Dimension-only batches never move. 3D generation is
bbox-based per page, so placement does not affect CSG output.

## More for contributors

Repository layout, architecture, Electron APIs: [developer.html](developer.html) (JA) · [en/developer.html](en/developer.html) (EN)
