"use strict";

(function initSchema(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MillrectSchema = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : null, function factory() {
  const REAL_PER_MM = 10;
  const MODEL_IR_VERSION = 1;
  const GEOMETRY_DATA_VERSION = 1;

  const PAPER_SIZES_MM = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 },
    A2: { width: 420, height: 594 },
    A1: { width: 594, height: 841 },
  };

  const MODEL_OPERATION_TYPES = new Set([
    "profile_reference",
    "extrude",
    "boolean_union",
    "boolean_intersection",
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
  ]);

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function makeResult(errors, warnings = []) {
    return {
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  function stableClone(value) {
    if (Array.isArray(value)) return value.map(stableClone);
    if (isPlainObject(value)) {
      const out = {};
      for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) out[key] = stableClone(value[key]);
      }
      return out;
    }
    if (typeof value === "number") {
      return Object.is(value, -0) ? 0 : value;
    }
    return value;
  }

  function stableStringify(value, space) {
    return JSON.stringify(stableClone(value), null, space);
  }

  function stableHash(value) {
    const text = typeof value === "string" ? value : stableStringify(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function normalizeViewType(type) {
    if (type === "section" || type === "detail") return "top";
    return type || "top";
  }

  function realToMm(value) {
    return Number(value) / REAL_PER_MM;
  }

  function mmToReal(value) {
    return Number(value) * REAL_PER_MM;
  }

  function getPaperSizeMm(page = {}) {
    const size = PAPER_SIZES_MM[page.paper] || PAPER_SIZES_MM.A4;
    return page.orientation === "landscape"
      ? { width: size.height, height: size.width }
      : { width: size.width, height: size.height };
  }

  function getPageCanvasSizeMm(page = {}) {
    const paper = getPaperSizeMm(page);
    const scale = page.scale || { numerator: 1, denominator: 1 };
    const numerator = Number(scale.numerator) || 1;
    const denominator = Number(scale.denominator) || 1;
    return {
      width: paper.width * (denominator / numerator),
      height: paper.height * (denominator / numerator),
    };
  }

  function validateProjectJson(data) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(data)) {
      return makeResult(["Project JSON must be an object"], warnings);
    }
    if (!Array.isArray(data.pages) || data.pages.length === 0) {
      errors.push("Project JSON must contain pages[]");
    }
    for (const [pageIndex, page] of (data.pages || []).entries()) {
      const pagePath = `pages[${pageIndex}]`;
      if (!isPlainObject(page)) {
        errors.push(`${pagePath} must be an object`);
        continue;
      }
      if (typeof page.id !== "string" || !page.id) {
        errors.push(`${pagePath}.id must be a non-empty string`);
      }
      if (!Array.isArray(page.layers) || page.layers.length === 0) {
        errors.push(`${pagePath}.layers must be a non-empty array`);
      }
      if (!page.viewDefinition?.type) {
        warnings.push(`${pagePath}.viewDefinition.type is not set`);
      }
      for (const [layerIndex, layer] of (page.layers || []).entries()) {
        const layerPath = `${pagePath}.layers[${layerIndex}]`;
        if (!isPlainObject(layer)) {
          errors.push(`${layerPath} must be an object`);
          continue;
        }
        if (typeof layer.id !== "string" || !layer.id) {
          errors.push(`${layerPath}.id must be a non-empty string`);
        }
        if (!Array.isArray(layer.shapes)) {
          errors.push(`${layerPath}.shapes must be an array`);
        }
      }
    }
    return makeResult(errors, warnings);
  }

  function isMillrectProjectJson(data) {
    return validateProjectJson(data).ok;
  }

  function validateModelOperation(operation, index) {
    const errors = [];
    const path = `operations[${index}]`;
    if (!isPlainObject(operation)) {
      return [`${path} must be an object`];
    }
    if (!MODEL_OPERATION_TYPES.has(operation.type)) {
      errors.push(`${path}.type is unsupported: ${operation.type}`);
    }
    if (typeof operation.id !== "string" || !operation.id) {
      errors.push(`${path}.id must be a non-empty string`);
    }
    if (operation.type === "extrude") {
      if (typeof operation.profileId !== "string" || !operation.profileId) {
        errors.push(`${path}.profileId is required for extrude`);
      }
      if (!(Number(operation.height) > 0)) {
        errors.push(`${path}.height must be positive for extrude`);
      }
    }
    if (operation.type === "threaded_hole") {
      if (typeof operation.standard !== "string" || !operation.standard) {
        errors.push(`${path}.standard is required for threaded_hole`);
      }
      if (!isPlainObject(operation.position)) {
        errors.push(`${path}.position is required for threaded_hole`);
      }
      if (!(Number(operation.depth) > 0) && operation.through !== true) {
        errors.push(`${path}.depth must be positive unless through is true`);
      }
    }
    if (operation.type === "fillet" || operation.type === "chamfer") {
      if (!(Number(operation.radius) > 0 || Number(operation.distance) > 0)) {
        errors.push(`${path} needs radius or distance`);
      }
    }
    return errors;
  }

  function validateModelIr(ir) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(ir)) {
      return makeResult(["Model IR must be an object"], warnings);
    }
    if (ir.kind !== "millrect.model-ir") {
      errors.push('Model IR kind must be "millrect.model-ir"');
    }
    if (ir.schemaVersion !== MODEL_IR_VERSION) {
      errors.push(`Model IR schemaVersion must be ${MODEL_IR_VERSION}`);
    }
    if (ir.units !== "mm") {
      errors.push('Model IR units must be "mm"');
    }
    if (!Array.isArray(ir.profiles)) {
      errors.push("Model IR profiles[] is required");
    }
    if (!Array.isArray(ir.operations)) {
      errors.push("Model IR operations[] is required");
    }
    for (const [index, operation] of (ir.operations || []).entries()) {
      errors.push(...validateModelOperation(operation, index));
    }
    if (!ir.operations?.some((operation) => operation.type === "extrude")) {
      warnings.push("Model IR has no extrude operation");
    }
    return makeResult(errors, warnings);
  }

  function validateGeometryData(data) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(data)) {
      return makeResult(["Geometry data must be an object"], warnings);
    }
    if (data.kind !== "millrect.geometry-data") {
      errors.push('Geometry data kind must be "millrect.geometry-data"');
    }
    if (data.schemaVersion !== GEOMETRY_DATA_VERSION) {
      errors.push(
        `Geometry data schemaVersion must be ${GEOMETRY_DATA_VERSION}`,
      );
    }
    if (data.units !== "mm") {
      errors.push('Geometry data units must be "mm"');
    }
    if (!Array.isArray(data.meshes)) {
      errors.push("Geometry data meshes[] is required");
    }
    for (const [meshIndex, mesh] of (data.meshes || []).entries()) {
      const path = `meshes[${meshIndex}]`;
      if (!isPlainObject(mesh)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      if (!Array.isArray(mesh.vertices)) {
        errors.push(`${path}.vertices must be an array`);
      }
      if (!Array.isArray(mesh.faces)) {
        errors.push(`${path}.faces must be an array`);
      }
    }
    return makeResult(errors, warnings);
  }

  return {
    REAL_PER_MM,
    MODEL_IR_VERSION,
    GEOMETRY_DATA_VERSION,
    MODEL_OPERATION_TYPES,
    PAPER_SIZES_MM,
    isPlainObject,
    stableClone,
    stableStringify,
    stableHash,
    normalizeViewType,
    realToMm,
    mmToReal,
    getPaperSizeMm,
    getPageCanvasSizeMm,
    validateProjectJson,
    isMillrectProjectJson,
    validateModelIr,
    validateGeometryData,
  };
});
