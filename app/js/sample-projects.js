"use strict";

function buildSampleProjectState(sampleId, opts = {}) {
  const entry = getSampleCatalogEntry(sampleId);
  if (!entry) {
    throw new Error(`Unknown sample: ${sampleId}`);
  }

  const paper = opts.paper ?? "A4";
  const orientation = opts.orientation ?? "landscape";
  const scale = opts.scale ?? { numerator: 1, denominator: 10 };
  const projectName =
    (
      opts.projectName ||
      (typeof t === "function" ? t(entry.defaultProjectNameKey) : "") ||
      "Untitled"
    ).trim() || "Untitled";

  if (entry.type === "multiview") {
    return buildMultiviewStarterState(projectName, {
      paper,
      orientation,
      scale,
      sizeMm: opts.sizeMm ?? MULTIVIEW_STARTER_MM,
      includeSideView: entry.options?.includeSideView === true,
      styles: opts.styles ?? MULTIVIEW_STARTER_BOX,
    });
  }

  if (entry.type === "partDsl") {
    const built = buildPartDslState(
      {
        ...entry.dsl,
        meta: { ...(entry.dsl.meta || {}), sampleId: entry.id },
      },
      { projectName, paper, orientation, scale },
    );
    if (!built.ok) {
      throw new Error(built.error || "Sample build failed");
    }
    built.state.projectName = projectName;
    return built.state;
  }

  if (entry.type === "moduleJoint1") {
    return buildModuleJoint1ProjectState(projectName);
  }

  throw new Error(`Unsupported sample type: ${entry.type}`);
}

function resolveSampleIdFromTemplate(template) {
  if (!template) return null;
  if (template === "multiview") return "starter-box";
  if (typeof template === "string" && template.startsWith("sample:")) {
    return template.slice("sample:".length);
  }
  return null;
}

function shouldFitMultiviewSampleView(template) {
  const sampleId = resolveSampleIdFromTemplate(template);
  if (!sampleId) return template === "multiview";
  const entry = getSampleCatalogEntry(sampleId);
  return entry?.fitView === "multiview";
}
