"use strict";

(function initModelGenerator(root: any, factory: (schema: any) => any) {
  const schema =
    typeof require !== "undefined"
      ? require("../schema")
      : root?.MillrectSchema;
  const api = factory(schema);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MillrectModelGenerator = api;
    root.generateModelIrFromProject = api.generateModelIrFromProject;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : null,
  function factory(schema: any) {
    if (!schema) throw new Error("Millrect schema package is required");

    // IR 生成は number[][]（tuple ではない素の配列）でリングを扱う。
    type BBox = {
      x: number;
      y: number;
      w: number;
      h: number;
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
    // 生成された profile（State 派生 MillrectProfile とは別の、IR 内部表現）。
    interface GenProfile {
      id: string;
      sourceId: string | null;
      pageId: string;
      pageIndex: number;
      profileIndex: number;
      viewType: string;
      rings: number[][][];
      bbox: BBox;
      bboxMm: { x: number; y: number; w: number; h: number; [k: string]: number };
      area: number;
      areaMm2: number;
      material: MillrectMaterial;
      holeCount: number;
      // MillrectIrProfile（index signature 付き）へ代入可能にする。
      [key: string]: unknown;
    }
    interface Dims {
      width: number;
      depth: number;
      height: number;
      activeAxes: string[];
    }

    function round(value: number, digits = 6): number {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      const m = 10 ** digits;
      return Math.round(n * m) / m;
    }

    function ringSignedArea(ring: number[][]): number {
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[(i + 1) % ring.length];
        area += x0 * y1 - x1 * y0;
      }
      return area / 2;
    }

    function ringsBBox(rings: number[][][]): BBox | null {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const ring of rings || []) {
        for (const [x, y] of ring || []) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (!Number.isFinite(minX)) return null;
      return {
        x: round(minX),
        y: round(minY),
        w: round(maxX - minX),
        h: round(maxY - minY),
        minX: round(minX),
        minY: round(minY),
        maxX: round(maxX),
        maxY: round(maxY),
      };
    }

    function roundedRectRing(
      x: number,
      y: number,
      w: number,
      h: number,
      tl: number,
      tr: number,
      br: number,
      bl: number,
      steps = 32,
    ): number[][] {
      const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
        Array.from({ length: steps + 1 }, (_, i) => {
          const a = a0 + ((a1 - a0) * i) / steps;
          return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
        });
      const pts: number[][] = [];
      if (tl > 0) pts.push(...arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5));
      else pts.push([x, y]);
      if (tr > 0)
        pts.push(...arc(x + w - tr, y + tr, tr, Math.PI * 1.5, Math.PI * 2));
      else pts.push([x + w, y]);
      if (br > 0)
        pts.push(...arc(x + w - br, y + h - br, br, 0, Math.PI * 0.5));
      else pts.push([x + w, y + h]);
      if (bl > 0)
        pts.push(...arc(x + bl, y + h - bl, bl, Math.PI * 0.5, Math.PI));
      else pts.push([x, y + h]);
      return pts;
    }

    function circleRing(cx: number, cy: number, r: number, steps = 128): number[][] {
      return Array.from({ length: steps }, (_, i) => {
        const a = (2 * Math.PI * i) / steps;
        return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
      });
    }

    function cloneRings(rings: any): number[][][] {
      return (rings || []).map((ring: any) =>
        (ring || []).map(([x, y]: number[]) => [round(x), round(y)]),
      );
    }

    function hasVisualTransform(
      shape: MillrectShape,
      ancestorGroups: MillrectShape[] = [],
    ): boolean {
      const all = [shape, ...ancestorGroups];
      return all.some(
        (item) =>
          item &&
          (item.rotation ||
            item.flipH ||
            item.flipV ||
            item.scaleX ||
            item.scaleY),
      );
    }

    function shapeToProfileRings(
      shape: MillrectShape,
      warnings: string[],
      ancestorGroups: MillrectShape[] = [],
    ): number[][][] | null {
      let rings: number[][][] | null = null;
      switch (shape?.type) {
        case "rect": {
          const x = Number(shape.x) || 0;
          const y = Number(shape.y) || 0;
          const w = Number(shape.width) || 0;
          const h = Number(shape.height) || 0;
          if (!(w > 0) || !(h > 0)) return null;
          let outer;
          if (shape.rxMode === "individual") {
            outer = roundedRectRing(
              x,
              y,
              w,
              h,
              Number(shape.rxTL) || 0,
              Number(shape.rxTR) || 0,
              Number(shape.rxBR) || 0,
              Number(shape.rxBL) || 0,
            );
          } else if (shape.rx) {
            const radius = Number(shape.rx) || 0;
            outer = roundedRectRing(x, y, w, h, radius, radius, radius, radius);
          } else {
            outer = [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ];
          }
          rings = [outer];
          break;
        }
        case "circle":
          if (!(Number(shape.r) > 0)) return null;
          rings = [
            circleRing(
              Number(shape.cx) || 0,
              Number(shape.cy) || 0,
              Number(shape.r),
            ),
          ];
          break;
        case "ellipse":
          if (!(Number(shape.rx) > 0) || !(Number(shape.ry) > 0)) return null;
          rings = [
            Array.from({ length: 64 }, (_, i) => {
              const a = (2 * Math.PI * i) / 64;
              return [
                round((Number(shape.cx) || 0) + Number(shape.rx) * Math.cos(a)),
                round((Number(shape.cy) || 0) + Number(shape.ry) * Math.sin(a)),
              ];
            }),
          ];
          break;
        case "bezier": {
          if (
            !shape.closed ||
            !Array.isArray(shape.nodes) ||
            shape.nodes.length < 3
          ) {
            return null;
          }
          const ring: number[][] = [];
          for (let i = 0; i < shape.nodes.length; i++) {
            const p0 = shape.nodes[i];
            const p1 = shape.nodes[(i + 1) % shape.nodes.length];
            const c1 = p0.h2 || p0;
            const c2 = p1.h1 || p1;
            for (let step = 0; step < 16; step++) {
              const u = step / 16;
              const uu = 1 - u;
              ring.push([
                round(
                  uu ** 3 * p0.x +
                    3 * uu ** 2 * u * c1.x +
                    3 * uu * u ** 2 * c2.x +
                    u ** 3 * p1.x,
                ),
                round(
                  uu ** 3 * p0.y +
                    3 * uu ** 2 * u * c1.y +
                    3 * uu * u ** 2 * c2.y +
                    u ** 3 * p1.y,
                ),
              ]);
            }
          }
          rings = [ring];
          break;
        }
        case "path":
          if (!Array.isArray(shape.contours) || !shape.contours.length)
            return null;
          // contours は MultiPolygon（Polygon[]）。現状は最初の Polygon のみを
          // profile 化する（[0]=外周, [1..]=ホール）。複数の独立ポリゴンは未対応。
          rings = cloneRings(shape.contours[0]);
          break;
        default:
          return null;
      }

      if (hasVisualTransform(shape, ancestorGroups)) {
        warnings.push(
          `Profile ${shape.id || "(unknown)"} has visual transforms; Model IR keeps raw rings for now`,
        );
      }
      return cloneRings(rings);
    }

    function* iterProfileSourcesFromPage(page: MillrectPage): Generator<{
      shape: MillrectShape;
      ancestorGroups: MillrectShape[];
    }> {
      function* walk(
        shapes: any,
        ancestors: MillrectShape[],
      ): Generator<{ shape: MillrectShape; ancestorGroups: MillrectShape[] }> {
        for (const shape of shapes || []) {
          if (shape?.ghost) continue;
          if (shape?.type === "group" && Array.isArray(shape.children)) {
            yield* walk(shape.children, [...ancestors, shape]);
            continue;
          }
          yield { shape, ancestorGroups: ancestors };
        }
      }
      for (const layer of page.layers || []) {
        if (layer.visible === false || layer.locked) continue;
        yield* walk(layer.shapes || [], []);
      }
    }

    function materialFromShape(shape: MillrectShape): MillrectMaterial {
      return {
        color: shape?.fill && shape.fill !== "none" ? shape.fill : "#5965f9",
        source: shape?.fill && shape.fill !== "none" ? "shape.fill" : "default",
      };
    }

    function extractProfiles(
      project: MillrectProjectJson,
      warnings: string[],
    ): GenProfile[] {
      const profiles: GenProfile[] = [];
      for (const [pageIndex, page] of project.pages.entries()) {
        const viewType = schema.normalizeViewType(page.viewDefinition?.type);
        let profileIndex = 0;
        for (const { shape, ancestorGroups } of iterProfileSourcesFromPage(
          page,
        )) {
          const rings = shapeToProfileRings(shape, warnings, ancestorGroups);
          if (!rings?.length || !rings[0]?.length) continue;
          const area = Math.abs(ringSignedArea(rings[0]));
          if (area < 1e-6) continue;
          // rings は非空（上の length チェック済み）なので bbox は非 null。
          const bbox = ringsBBox(rings)!;
          profiles.push({
            id: `profile-${shape.id || `${page.id}-${profileIndex}`}`,
            sourceId: shape.id || null,
            pageId: page.id,
            pageIndex,
            profileIndex,
            viewType,
            rings,
            bbox,
            bboxMm: {
              x: round(schema.realToMm(bbox.x)),
              y: round(schema.realToMm(bbox.y)),
              w: round(schema.realToMm(bbox.w)),
              h: round(schema.realToMm(bbox.h)),
            },
            area: round(area),
            areaMm2: round(area / (schema.REAL_PER_MM * schema.REAL_PER_MM)),
            material: materialFromShape(shape),
            holeCount: Math.max(0, rings.length - 1),
          });
          profileIndex++;
        }
      }
      return profiles;
    }

    function firstProfileByView(
      profiles: GenProfile[],
      viewTypes: string[],
    ): GenProfile | undefined {
      return profiles.find((profile) => viewTypes.includes(profile.viewType));
    }

    function maxProfileSize(
      profiles: GenProfile[],
      viewTypes: string[],
      axis: string,
    ): number | null {
      const values = profiles
        .filter((profile) => viewTypes.includes(profile.viewType))
        .map((profile) => profile.bboxMm?.[axis])
        .filter((value) => Number(value) > 0);
      return values.length ? Math.max(...values) : null;
    }

    function inferDimensions(profiles: GenProfile[], warnings: string[]): Dims {
      const top = firstProfileByView(profiles, ["top", "bottom"]);
      const front = firstProfileByView(profiles, ["front", "back"]);
      const side = firstProfileByView(profiles, ["right", "left"]);
      // width は X 軸。side(right/left) ビューの w は depth を表すので width の
      // 根拠にはならない（front/top の w のみ採用）。
      const width =
        maxProfileSize(profiles, ["front", "back"], "w") ??
        maxProfileSize(profiles, ["top", "bottom"], "w") ??
        0;
      const depth =
        maxProfileSize(profiles, ["top", "bottom"], "h") ??
        maxProfileSize(profiles, ["right", "left"], "w") ??
        0;
      const height =
        maxProfileSize(profiles, ["front", "back"], "h") ??
        maxProfileSize(profiles, ["right", "left"], "h") ??
        0;

      const activeAxes = new Set<string>();
      if (top) activeAxes.add("y");
      if (front) activeAxes.add("z");
      if (side) activeAxes.add("x");
      if (activeAxes.size < 2) {
        warnings.push("Model IR has fewer than two orthographic axes");
      }
      return {
        width: round(width),
        depth: round(depth),
        height: round(height),
        activeAxes: [...activeAxes].sort(),
      };
    }

    function viewAxis(viewType: string): string {
      switch (viewType) {
        case "front":
        case "back":
          return "z";
        case "right":
        case "left":
          return "x";
        case "top":
        case "bottom":
        default:
          return "y";
      }
    }

    function extrusionHeight(viewType: string, dimensions: Dims): number {
      switch (viewType) {
        case "front":
        case "back":
          return dimensions.depth;
        case "right":
        case "left":
          return dimensions.width;
        case "top":
        case "bottom":
        default:
          return dimensions.height;
      }
    }

    function holeOperationFromRing(
      profile: GenProfile,
      ring: number[][],
      holeIndex: number,
    ): MillrectModelOperation {
      const bbox = ringsBBox([ring])!;
      const cx = schema.realToMm(bbox.x + bbox.w / 2);
      const cy = schema.realToMm(bbox.y + bbox.h / 2);
      const diameter = schema.realToMm((bbox.w + bbox.h) / 2);
      return {
        id: `op-hole-${profile.id}-${holeIndex}`,
        type: "hole",
        profileId: profile.id,
        viewType: profile.viewType,
        position: { x: round(cx), y: round(cy) },
        diameter: round(diameter),
        through: true,
        source: "profile.inner_ring",
      };
    }

    function featureOperationsFromProfiles(
      profiles: GenProfile[],
    ): MillrectModelOperation[] {
      const operations: MillrectModelOperation[] = [];
      for (const profile of profiles) {
        for (let i = 1; i < profile.rings.length; i++) {
          operations.push(holeOperationFromRing(profile, profile.rings[i], i));
        }
      }
      return operations;
    }

    // project.partIntent.dsl は動的な Part DSL なので any のまま掘る。
    function featureOperationsFromPartIntent(
      project: any,
    ): MillrectModelOperation[] {
      const dsl = project.partIntent?.dsl;
      const features = Array.isArray(dsl?.features) ? dsl.features : [];
      const operations: MillrectModelOperation[] = [];
      for (const [index, feature] of features.entries()) {
        const base = {
          id: `op-feature-${index}-${feature.type}`,
          source: "partIntent.dsl.features",
        };
        if (feature.type === "hole_grid") {
          operations.push({
            ...base,
            type: "hole_pattern",
            viewType: feature.view || "top",
            count: feature.count || [1, 1],
            diameter: round(feature.diameter_mm ?? feature.diameterMm ?? 3),
            inset: round(feature.inset_mm ?? feature.insetMm ?? 5),
            through: true,
          });
        } else if (feature.type === "slot") {
          operations.push({
            ...base,
            type: "cut_slot",
            viewType: feature.view || "top",
            width: round(feature.width_mm ?? feature.widthMm ?? 10),
            height: round(feature.height_mm ?? feature.heightMm ?? 4),
            position: {
              x: round(feature.x_mm ?? feature.xMm ?? 20),
              y: round(feature.y_mm ?? feature.yMm ?? 20),
            },
            through: true,
          });
        } else if (feature.type === "fillet") {
          operations.push({
            ...base,
            type: "fillet",
            viewType: feature.view || "top",
            radius: round(feature.radius_mm ?? feature.radiusMm ?? 3),
            target: feature.target || "profile_corners",
          });
        } else if (feature.type === "pattern_linear") {
          operations.push({
            ...base,
            type: "pattern_linear",
            viewType: feature.view || "top",
            count: Math.max(1, Math.trunc(Number(feature.count)) || 1),
            pitch: round(feature.pitch_mm ?? feature.pitchMm ?? 20),
            diameter: round(feature.diameter_mm ?? feature.diameterMm ?? 3),
            axis: feature.axis === "y" ? "y" : "x",
            start: feature.start_mm || feature.startMm || { x: 10, y: 10 },
            through: true,
          });
        } else if (feature.type === "threaded_hole") {
          const depth = round(feature.depth ?? feature.depth_mm ?? 0);
          operations.push({
            ...base,
            type: "threaded_hole",
            standard: feature.standard || "M4",
            position: feature.position || { x: 0, y: 0 },
            depth,
            // depth 未指定（≤0）の機能 1 個で IR 全体が invalid にならないよう、
            // 深さが無ければ貫通穴として扱う。
            through: feature.through === true || !(depth > 0),
          });
        } else if (feature.type === "chamfer") {
          operations.push({
            ...base,
            type: "chamfer",
            distance: round(feature.distance ?? feature.distance_mm ?? 1),
            target: feature.target || "outer_edges",
          });
        }
      }
      const thickness = dsl?.params?.T;
      if (Number(thickness) > 0) {
        operations.push({
          id: "op-thickness-from-part-intent",
          type: "thickness",
          value: round(thickness),
          source: "partIntent.dsl.params.T",
        });
      }
      return operations;
    }

    function buildOperations(
      profiles: GenProfile[],
      dimensions: Dims,
      project: MillrectProjectJson,
    ): MillrectModelOperation[] {
      const operations: MillrectModelOperation[] = [];
      for (const profile of profiles) {
        operations.push({
          id: `op-profile-${profile.id}`,
          type: "profile_reference",
          profileId: profile.id,
          sourceId: profile.sourceId,
          viewType: profile.viewType,
        });
        const height = extrusionHeight(profile.viewType, dimensions);
        if (height > 0) {
          operations.push({
            id: `op-extrude-${profile.id}`,
            type: "extrude",
            profileId: profile.id,
            viewType: profile.viewType,
            axis: viewAxis(profile.viewType),
            height: round(height),
          });
        }
      }

      const activeAxes = dimensions.activeAxes || [];
      if (activeAxes.length >= 2) {
        operations.push({
          id: "op-multiview-axis-intersection",
          type: "boolean_intersection",
          axes: activeAxes,
          operands: operations
            .filter((operation) => operation.type === "extrude")
            .map((operation) => operation.id),
          strategy: "orthographic_profile_sweep",
        });
      }

      operations.push(...featureOperationsFromProfiles(profiles));
      operations.push(...featureOperationsFromPartIntent(project));
      return operations;
    }

    function generateModelIrFromProject(
      project: MillrectProjectJson,
      options: { mode?: string } = {},
    ): MillrectModelIrResult {
      const validation = schema.validateProjectJson(project);
      const warnings: string[] = [...validation.warnings];
      const logs: unknown[] = [];
      if (!validation.ok) {
        return {
          ok: false,
          errors: validation.errors,
          warnings,
          logs,
          ir: null,
        };
      }

      const profiles = extractProfiles(project, warnings);
      const dimensions = inferDimensions(profiles, warnings);
      const operations = buildOperations(profiles, dimensions, project);
      const ir = {
        kind: "millrect.model-ir",
        schemaVersion: schema.MODEL_IR_VERSION,
        units: "mm",
        source: {
          projectName: project.projectName || "Untitled",
          projectHash: schema.stableHash(project),
        },
        dimensions: {
          width: dimensions.width,
          depth: dimensions.depth,
          height: dimensions.height,
        },
        axes: dimensions.activeAxes,
        profiles,
        operations,
        logs,
        warnings,
        meta: {
          generator: "packages/model-generator",
          mode: options.mode || "deterministic-ir",
        },
      };

      const irValidation = schema.validateModelIr(ir);
      return {
        ok: irValidation.ok,
        errors: irValidation.errors,
        warnings: [...warnings, ...irValidation.warnings],
        logs,
        ir,
      };
    }

    return {
      extractProfiles,
      generateModelIrFromProject,
    };
  },
);
