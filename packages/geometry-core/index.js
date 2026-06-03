"use strict";

(function initGeometryCore(root, factory) {
  const schema =
    typeof require !== "undefined"
      ? require("../schema")
      : root?.MillrectSchema;
  const api = factory(schema);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MillrectGeometryCore = api;
    root.generateGeometryFromModelIr = api.generateGeometryFromModelIr;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : null,
  function factory(schema) {
    if (!schema) throw new Error("Millrect schema package is required");

    function round(value, digits = 6) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      const m = 10 ** digits;
      return Math.round(n * m) / m;
    }

    function positive(value) {
      return Number(value) > 0 ? Number(value) : 0;
    }

    function buildBoxMesh(dimensions, material) {
      const width = positive(dimensions.width);
      const depth = positive(dimensions.depth);
      const height = positive(dimensions.height);
      if (!width || !depth || !height) return null;
      const vertices = [
        [0, 0, 0],
        [width, 0, 0],
        [width, height, 0],
        [0, height, 0],
        [0, 0, -depth],
        [width, 0, -depth],
        [width, height, -depth],
        [0, height, -depth],
      ].map((point) => point.map((value) => round(value)));
      const faces = [
        [0, 1, 2],
        [0, 2, 3],
        [1, 5, 6],
        [1, 6, 2],
        [5, 4, 7],
        [5, 7, 6],
        [4, 0, 3],
        [4, 3, 7],
        [3, 2, 6],
        [3, 6, 7],
        [4, 5, 1],
        [4, 1, 0],
      ];
      return {
        id: "mesh-derived-bounds",
        role: "derived-preview-bounds",
        vertices,
        faces,
        material: material || { color: "#5965f9" },
      };
    }

    function dominantMaterial(ir) {
      const counts = new Map();
      for (const profile of ir.profiles || []) {
        const color = profile.material?.color || "#5965f9";
        counts.set(color, (counts.get(color) || 0) + 1);
      }
      const first = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return { color: first?.[0] || "#5965f9" };
    }

    function featureAnnotations(ir) {
      return (ir.operations || [])
        .filter((operation) =>
          [
            "hole",
            "hole_pattern",
            "threaded_hole",
            "cut_slot",
            "fillet",
            "chamfer",
            "shell",
            "thickness",
            "material",
            "visibility",
            "pattern_linear",
          ].includes(operation.type),
        )
        .map((operation) => schema.stableClone(operation));
    }

    function boundsForDimensions(dimensions = {}) {
      const width = positive(dimensions.width);
      const depth = positive(dimensions.depth);
      const height = positive(dimensions.height);
      return {
        min: [0, 0, depth ? -depth : 0],
        max: [round(width), round(height), 0],
        size: [round(width), round(height), round(depth)],
      };
    }

    function generateGeometryFromModelIr(ir, options = {}) {
      const validation = schema.validateModelIr(ir);
      const warnings = [...validation.warnings];
      const logs = [];
      if (!validation.ok) {
        return {
          ok: false,
          errors: validation.errors,
          warnings,
          logs,
          data: null,
        };
      }

      const material = dominantMaterial(ir);
      const meshes = [];
      const boundsMesh = buildBoxMesh(ir.dimensions || {}, material);
      if (boundsMesh) {
        meshes.push(boundsMesh);
      } else {
        warnings.push("Geometry core could not derive a non-zero preview mesh");
      }

      const data = {
        kind: "millrect.geometry-data",
        schemaVersion: schema.GEOMETRY_DATA_VERSION,
        units: "mm",
        source: {
          modelIrHash: schema.stableHash(ir),
          projectHash: ir.source?.projectHash || null,
        },
        meshes,
        features: featureAnnotations(ir),
        operations: (ir.operations || []).map((operation) =>
          schema.stableClone(operation),
        ),
        metrics: {
          meshCount: meshes.length,
          vertexCount: meshes.reduce(
            (sum, mesh) => sum + mesh.vertices.length,
            0,
          ),
          faceCount: meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0),
          bounds: boundsForDimensions(ir.dimensions),
        },
        warnings,
        logs,
        meta: {
          generator: "packages/geometry-core",
          mode: options.mode || "deterministic-geometry-data",
        },
      };

      const dataValidation = schema.validateGeometryData(data);
      return {
        ok: dataValidation.ok,
        errors: dataValidation.errors,
        warnings: [...warnings, ...dataValidation.warnings],
        logs,
        data,
      };
    }

    return {
      buildBoxMesh,
      featureAnnotations,
      generateGeometryFromModelIr,
    };
  },
);
