# Millrect Documentation System

Status: active direction

This note defines how Millrect documentation should scale without turning every
layout adjustment into a full manual screenshot pass.

## Core Model

Millrect docs use three layers:

1. **Guide pages** — task-oriented explanations such as drawing, editing,
   multiview 3D, export, and AI/MCP.
2. **Design Atlas** — specimen cards that show what Millrect can make and link
   into UI, AI/MCP, and DSL paths.
3. **Blueprint specimens** — generated editorial visuals that show complex
   design outcomes without depending on app UI screenshots.
4. **Reference pages** — developer, schema, MCP, Part DSL, and design notes.

The atlas is the main "what can it do?" surface. Guide pages explain how to use
the tools. Reference pages answer exact API and implementation questions.

## Image Tiers

| Tier | Purpose | Update trigger |
| --- | --- | --- |
| Blueprint specimen | Generated complex engineering visual | Specimen story changes |
| Showcase | Finished design story for home / atlas | Visual story changes |
| Scenario capture | Repeatable screenshot from a scenario ID | Scenario behavior or layout changes |
| UI proof | Small UI placement evidence | UI labels or placement changes |

Prefer one strong Showcase image over several low-information screenshots.
For complex drawings, prefer one generated blueprint specimen plus a small
number of scenario captures.

## Scenario IDs

Every repeatable screenshot should map to a scenario ID before the image file is
named.

Current public-facing specimens:

| Scenario ID | Role |
| --- | --- |
| `startup` | Startup dialog, new project form, and project list |
| `mounting_plate_basic` | Standard 2D -> 3D -> STL specimen |
| `sketch_trace_plate` | Reference image / scale calibration / ghost review |
| `annotation_plate` | Text, font, wrapping, and outline workflow |
| `workspace_orientation` | UI map for panels, pages, layers, and preview |

Planned complex specimen:

| Scenario ID | Role |
| --- | --- |
| `fixture_plate_advanced` | Generated blueprint direction for a dense fixture plate with holes, slots, section/detail views, and DSL |

When adding a new feature page, first decide whether it extends an existing
specimen. Add a new specimen only when the outcome is meaningfully different.
Generated blueprint visuals and automated app captures must stay in separate
lanes: generated visuals sell the outcome, while captures prove the workflow.

## Page Pattern

Feature pages should follow this order:

1. What this feature can produce
2. Representative specimen or screenshot
3. UI path
4. AI/MCP path, when applicable
5. Constraints and failure modes
6. Reference links

This keeps user-facing pages outcome-led while still giving agents and
developers exact hooks.

## Capture Policy

Use `npm run docs:screenshots` for full regeneration. For a smaller update,
regenerate a single scenario ID:

```text
npm run docs:screenshots -- --scenario mounting_plate_basic
npm run docs:screenshots -- --scenario sketch_trace_plate --locale ja
npm run docs:screenshots -- --list-scenarios
```

The script validates only the files expected for the selected scenario, so a
small documentation edit does not need a full screenshot pass.

## Source Finding Notes

When a documentation screenshot needs correction, first find the generated
scenario source instead of editing PNGs directly. Keep the search path in this
document so future agents can start from durable project memory.

Useful searches:

```text
rg -n "Module Joint 1|module-joint-1|Ø6|R2|10 mm pitch|feat-center|drawing-features|captureModuleJoint1Scenario" shared scripts docs tests
```

Current Module Joint 1 screenshot sources:

| Concern | Source |
| --- | --- |
| Product geometry, cut lines, dimensions, and notes | `packages/module-joint-1-scenario.js` |
| Edge cut-ins baked into the outline (keyholes) | `moduleJoint1SlotRects()` + `moduleJoint1PathShape()` |
| Dimension line placement | `moduleJoint1DimensionShapes()` |
| Note text below the drawing | `moduleJoint1NoteShapes()` |
| Project state used by the app sample | `buildModuleJoint1ProjectState()` |
| Screenshot files written for the docs | `scripts/capture-docs-screenshots.js` → `captureModuleJoint1Scenario()` |
| Generic mounting-plate drawing demo | `scripts/docs-multiview-scenario.js` → `applyDrawingFeaturesScenario()` |

Do not treat generated screenshot PNGs as the source of truth. Update the
scenario code, regenerate with `npm run docs:screenshots -- --scenario module_joint_1`,
and then visually check that dimensions stay outside the part where possible and
that no non-existent guide or cut line has been introduced.
