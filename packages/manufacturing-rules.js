"use strict";

/**
 * 製造ルール DSL — Part の加工可能性検証（Tier 3）
 */

const DEFAULT_MANUFACTURING = {
  process: "laser_cut",
  thickness_mm: 3,
  kerf_mm: 0.2,
  min_hole_diameter_mm: 2,
  min_edge_distance_mm: 3,
};

function _num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeManufacturing(raw = {}) {
  const m = raw && typeof raw === "object" ? raw : {};
  return {
    process: m.process ?? DEFAULT_MANUFACTURING.process,
    thickness_mm: _num(
      m.thickness_mm ?? m.thicknessMm,
      DEFAULT_MANUFACTURING.thickness_mm,
    ),
    kerf_mm: _num(m.kerf_mm ?? m.kerfMm, DEFAULT_MANUFACTURING.kerf_mm),
    min_hole_diameter_mm: _num(
      m.min_hole_diameter_mm ?? m.minHoleDiameterMm,
      DEFAULT_MANUFACTURING.min_hole_diameter_mm,
    ),
    min_edge_distance_mm: _num(
      m.min_edge_distance_mm ?? m.minEdgeDistanceMm,
      DEFAULT_MANUFACTURING.min_edge_distance_mm,
    ),
  };
}

/** DSL features から検証用の穴・スロット spec を抽出 */
function collectFeatureSpecs(features = []) {
  const specs = [];
  for (const f of features) {
    if (f.type === "hole_grid") {
      specs.push({
        kind: "hole",
        view: f.view ?? "top",
        diameter_mm: f.diameter_mm ?? 3,
      });
    } else if (f.type === "pattern_linear") {
      specs.push({
        kind: "hole",
        view: f.view ?? "top",
        diameter_mm: f.diameter_mm ?? f.diameterMm ?? 3,
        count: f.count ?? 1,
      });
    } else if (f.type === "slot") {
      specs.push({
        kind: "slot",
        view: f.view ?? "top",
        width_mm: f.width_mm ?? f.widthMm ?? 5,
        height_mm: f.height_mm ?? f.heightMm ?? 5,
      });
    }
  }
  return specs;
}

/**
 * 製造ルール検証（dry-run — state 不要）
 * @returns {{ ok: boolean, violations: object[], manufacturing: object }}
 */
function validateManufacturingRules(dsl = {}) {
  const manufacturing = normalizeManufacturing(
    dsl.manufacturing ?? dsl.meta?.manufacturing,
  );
  const violations = [];
  const features = dsl.features ?? [];
  const specs = collectFeatureSpecs(features);

  for (const spec of specs) {
    if (spec.kind === "hole") {
      const d = spec.diameter_mm;
      if (d < manufacturing.min_hole_diameter_mm) {
        violations.push({
          code: "HOLE_TOO_SMALL",
          view: spec.view,
          diameter_mm: d,
          min_mm: manufacturing.min_hole_diameter_mm,
          message: `穴径 ${d}mm は最小 ${manufacturing.min_hole_diameter_mm}mm 未満`,
        });
      }
      if (
        d < manufacturing.thickness_mm &&
        manufacturing.process === "laser_cut"
      ) {
        violations.push({
          code: "HOLE_VS_THICKNESS",
          view: spec.view,
          diameter_mm: d,
          thickness_mm: manufacturing.thickness_mm,
          message: `穴径 ${d}mm が板厚 ${manufacturing.thickness_mm}mm より小さい`,
        });
      }
    }
    if (spec.kind === "slot") {
      const minDim = Math.min(spec.width_mm, spec.height_mm);
      if (minDim < manufacturing.kerf_mm * 2) {
        violations.push({
          code: "SLOT_VS_KERF",
          view: spec.view,
          min_dim_mm: minDim,
          kerf_mm: manufacturing.kerf_mm,
          message: `スロット ${minDim}mm はケルフ ${manufacturing.kerf_mm}mm に対して小さすぎる`,
        });
      }
    }
  }

  for (const f of features) {
    const inset = f.inset_mm ?? f.insetMm;
    if (inset != null && inset < manufacturing.min_edge_distance_mm) {
      violations.push({
        code: "INSET_TOO_SMALL",
        feature: f.type,
        view: f.view,
        inset_mm: inset,
        min_mm: manufacturing.min_edge_distance_mm,
        message: `inset ${inset}mm は最小端距離 ${manufacturing.min_edge_distance_mm}mm 未満`,
      });
    }
  }

  if (dsl.part === "enclosure") {
    const t = dsl.params?.T ?? dsl.params?.t;
    if (t != null && t !== manufacturing.thickness_mm) {
      violations.push({
        code: "WALL_THICKNESS_MISMATCH",
        param_T_mm: t,
        manufacturing_thickness_mm: manufacturing.thickness_mm,
        message: `壁厚 T=${t}mm と manufacturing.thickness_mm=${manufacturing.thickness_mm} が不一致（警告）`,
        severity: "warn",
      });
    }
  }

  return {
    ok: violations.filter((v) => v.severity !== "warn").length === 0,
    violations,
    manufacturing,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULT_MANUFACTURING,
    normalizeManufacturing,
    collectFeatureSpecs,
    validateManufacturingRules,
  };
}

if (typeof window !== "undefined") {
  window.normalizeManufacturing = normalizeManufacturing;
  window.validateManufacturingRules = validateManufacturingRules;
}
