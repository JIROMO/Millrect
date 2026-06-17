"use strict";

importScripts(
  "../../packages/schema/index.js",
  "../../packages/model-generator/index.js",
  "../../packages/geometry-core/index.js",
);

self.onmessage = (event) => {
  const { id, project } = event.data || {};
  try {
    const generator = self.MillrectModelGenerator;
    const geometryCore = self.MillrectGeometryCore;
    if (
      !generator?.generateModelIrFromProject ||
      !geometryCore?.generateGeometryFromModelIr
    ) {
      self.postMessage({
        id,
        state: {
          ok: false,
          pending: false,
          modelIr: null,
          geometryData: null,
          errors: ["Model pipeline packages are not loaded"],
          warnings: [],
          logs: [],
        },
      });
      return;
    }

    const irResult = generator.generateModelIrFromProject(project, {
      mode: "legacy-3d-view-worker",
    });
    const geometryResult = irResult.ir
      ? geometryCore.generateGeometryFromModelIr(irResult.ir, {
          mode: "legacy-3d-view-worker",
        })
      : null;

    self.postMessage({
      id,
      state: {
        ok: Boolean(irResult.ok && geometryResult?.ok),
        pending: false,
        modelIr: irResult.ir || null,
        geometryData: geometryResult?.data || null,
        errors: [...(irResult.errors || []), ...(geometryResult?.errors || [])],
        warnings: [
          ...(irResult.warnings || []),
          ...(geometryResult?.warnings || []),
        ],
        logs: [...(irResult.logs || []), ...(geometryResult?.logs || [])],
      },
    });
  } catch (e) {
    self.postMessage({
      id,
      state: {
        ok: false,
        pending: false,
        modelIr: null,
        geometryData: null,
        errors: [e?.message || "Model pipeline failed"],
        warnings: [],
        logs: [],
      },
    });
  }
};
