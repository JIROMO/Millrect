# Blueprint Specimens

Status: active direction

Millrect docs should use generated blueprint visuals as the main showcase layer,
while keeping app screenshots small and repeatable. The goal is to show what
Millrect can make before explaining which button produces it.

## North Star

Use `fixture_plate_advanced` as the first complex specimen.

It should look like a dense but believable engineering artifact:

- 160 x 100 x 12 mm fixture plate
- four mounting holes
- two elongated slots
- centerlines and datum marks
- top, front, side, section, and isometric views
- material / thickness / machining callouts
- a small Part DSL excerpt

The generated image does not need to be an app screenshot. It is the editorial
hero that establishes the outcome. Scenario captures prove that the outcome can
be produced inside Millrect.

## Real Product Specimen

Use `module_joint_1` as the first real-product specimen candidate.

Source facts:

- all dimensions are millimeters
- thickness: 2 mm
- overall top-view size: 24 x 100 mm
- width chain: 3 / 6 / 6 / 6 / 3
- circular holes: Ø6
- corner / end cutout radius: R2
- the edge-side cut-ins are baked into the outline geometry as keyholes (each
  hole + a 1 mm slit to the nearest long edge); there is no center line across
  the gap between the two hole columns
- the cut is part of the shape geometry (not a `role:"cut"` line), so 2D and 3D
  match exactly — the keyhole outline is what gets extruded

This specimen is useful because it is narrow, dense, and real. It shows that the
documentation system can move beyond generic demo plates while still keeping the
geometry easy to explain.

Generated visuals for real products are not the manufacturing source of truth.
Keep the source drawing, DSL, or deterministic geometry as the authority, and
use generated images as publication visuals.

## Visual Roles

| Role | Purpose | Source |
| --- | --- | --- |
| Blueprint sheet | Main docs / atlas explanation image | Generated AI image |
| Machined part hero | Home / showcase emotional anchor | Generated AI image |
| Technical spread | Advanced docs and AI/MCP explanation | Generated AI image |
| Scenario capture | UI proof and regression-safe screenshots | Playwright capture |
| Live specimen | Small interactive explanation | HTML/SVG |

Do not replace generated blueprint visuals every time the app UI changes. Only
regenerate them when the specimen story changes.

## Prompt Template

```text
Create a refined engineering documentation visual for Millrect.
No app UI, no browser chrome, no mouse cursor.

Subject:
Advanced fixture plate, 160 x 100 x 12 mm, chamfered aluminum body,
four mounting holes, two elongated slots, centerlines, datum markers,
dimension lines, section strip, and a small isometric view.

Composition:
Technical publication spread with a blueprint sheet, dimension rails,
detail bubbles, material swatches, and a compact Part-DSL-like code block.

Style:
Precise Japanese industrial design documentation, warm white drafting paper,
blue / black / gray linework, restrained accent color, legible density,
premium CAD manual feeling.

Text:
Avoid paragraphs and brand names. Use only tiny numeric or symbolic labels such
as W, D, H, Ø, R, A-A, 160, 100, 12.
```

## Scenario Contract

When this becomes a repeatable docs scenario, use:

```text
scenarioId: fixture_plate_advanced
generatedVisuals:
  - blueprint-direction-board.png
  - fixture-plate-blueprint.png
  - fixture-plate-technical-spread.png
captures:
  - fixture-plate-app-main.png
  - fixture-plate-drawing.png
  - fixture-plate-multiview.png
  - fixture-plate-3d-panel.png
  - fixture-plate-pages-panel.png
```

The generated visuals are curated. The captures are automated. Keep those two
lanes separate so layout tweaks do not force expensive image generation.

For the real product specimen:

```text
scenarioId: module_joint_1
generatedVisuals:
  - module-joint-1-blueprint.png
captures:
  - module-joint-1-drawing.png
  - module-joint-1-3d-panel.png
  - module-joint-1-pages-panel.png
sourceTruth:
  - original drawing image
  - Part DSL or deterministic vector geometry
```

## Documentation Pattern

For each complex specimen page:

1. Start with the generated blueprint visual.
2. Explain the object and what Millrect capability it demonstrates.
3. Show one scenario capture only when it proves an app-specific operation.
4. Link to UI, AI/MCP, Part DSL, export, and constraints.
5. Keep the reusable prompt and scenario ID in this design note.
