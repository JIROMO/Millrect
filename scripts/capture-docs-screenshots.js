/**
 * Generate documentation screenshots into docs/images/ (ja) and docs/images/en/
 * Run: npm run docs:screenshots
 * Run one scenario: npm run docs:screenshots -- --scenario mounting_plate_basic
 * Run one locale: npm run docs:screenshots -- --locale ja
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("@playwright/test");
const {
  applyMultiviewDocsBoxScenario,
  applyDrawingRectScenario,
  applyDrawingFeaturesScenario,
  applyEditingDemoScenario,
  focusDrawingFeaturesView,
  focusShapeInView,
  fitPageForCapture,
  flushRender,
  waitForShapeInSvg,
  switchToPage,
  waitFor3DMesh,
} = require("./docs-multiview-scenario");

const ROOT = path.join(__dirname, "..");
const STATIC_PORT = process.env.MILLRECT_STATIC_PORT || "4173";
const appUrl = `http://127.0.0.1:${STATIC_PORT}/app/index.html`;

const DRAWING_FEATURES_CAPTURE_VIEW = {
  zoomFactor: 1.02,
  margin: 24,
  pad: 40,
};

const LOCALE_CONFIGS = {
  ja: {
    locale: "ja",
    outDir: path.join(ROOT, "docs", "images"),
    projectNameBox: "直方体",
    layerNotes: "注記",
    noteText: "120×80",
    engravingText: "120×80",
  },
  en: {
    locale: "en",
    outDir: path.join(ROOT, "docs", "images", "en"),
    projectNameBox: "Box",
    layerNotes: "Notes",
    noteText: "120×80",
    engravingText: "120×80",
  },
};

const SCREENSHOT_FILES = [
  "startup-dialog.png",
  "startup-new-form.png",
  "startup-project-list.png",
  "main-window.png",
  "drawing-rect.png",
  "tools-panel.png",
  "drawing-features.png",
  "design-panel.png",
  "design-panel-text.png",
  "drawing-text.png",
  "layers-panel.png",
  "editing-multiselect.png",
  "help-shortcuts.png",
  "pages-add-view.png",
  "multiview-top-drawing.png",
  "pages-multiview.png",
  "multiview-front-drawing.png",
  "3d-panel.png",
  "toolbar.png",
  "project-menu.png",
  "sketch-digitize.png",
  "reference-image-panel.png",
  "module-joint-1-millrect.png",
];

const SCENARIO_ORDER = [
  "startup",
  "drawing_rect",
  "mounting_plate_basic",
  "workspace_orientation",
  "annotation_plate",
  "sketch_trace_plate",
  "module_joint_1",
];

const SCENARIO_FILES = {
  startup: [
    "startup-dialog.png",
    "startup-new-form.png",
    "startup-project-list.png",
  ],
  drawing_rect: ["drawing-rect.png"],
  mounting_plate_basic: [
    "main-window.png",
    "drawing-features.png",
    "pages-add-view.png",
    "multiview-top-drawing.png",
    "pages-multiview.png",
    "multiview-front-drawing.png",
    "3d-panel.png",
    "toolbar.png",
    "project-menu.png",
  ],
  workspace_orientation: [
    "main-window.png",
    "tools-panel.png",
    "design-panel.png",
    "layers-panel.png",
    "editing-multiselect.png",
    "help-shortcuts.png",
    "pages-multiview.png",
  ],
  annotation_plate: ["design-panel-text.png", "drawing-text.png"],
  sketch_trace_plate: ["sketch-digitize.png", "reference-image-panel.png"],
  module_joint_1: [
    "main-window.png",
    "drawing-rect.png",
    "drawing-features.png",
    "drawing-text.png",
    "editing-multiselect.png",
    "multiview-top-drawing.png",
    "multiview-front-drawing.png",
    "3d-panel.png",
    "design-panel.png",
    "design-panel-text.png",
    "layers-panel.png",
    "pages-add-view.png",
    "pages-multiview.png",
    "toolbar.png",
    "tools-panel.png",
    "sketch-digitize.png",
    "reference-image-panel.png",
    "module-joint-1-millrect.png",
  ],
};

const SCENARIO_ALIASES = {
  all: SCENARIO_ORDER,
  multiview_box_3view: ["mounting_plate_basic"],
  drawing_features: ["mounting_plate_basic"],
  editing_demo: ["workspace_orientation"],
  sketch_digitize_demo: ["sketch_trace_plate"],
};

function usage() {
  return [
    "Usage: npm run docs:screenshots -- [--scenario <id[,id]>] [--locale ja|en] [--list-scenarios]",
    "",
    "Scenarios:",
    ...SCENARIO_ORDER.map(
      (id) => `  ${id} -> ${SCENARIO_FILES[id].join(", ")}`,
    ),
  ].join("\n");
}

function expandScenarioId(id) {
  const normalized = String(id || "").trim();
  if (!normalized) return [];
  const expanded = SCENARIO_ALIASES[normalized] || [normalized];
  for (const scenario of expanded) {
    if (!SCENARIO_FILES[scenario]) {
      throw new Error(
        `Unknown screenshot scenario: ${normalized}\n\n${usage()}`,
      );
    }
  }
  return expanded;
}

function uniqueInOrder(list) {
  return [...new Set(list)];
}

function parseArgs(argv) {
  const scenarios = [];
  let locale = process.env.MILLRECT_DOCS_LOCALE || null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--list-scenarios") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--scenario" || arg === "-s") {
      const value = argv[++i];
      if (!value) throw new Error("--scenario requires a value");
      value.split(",").forEach((id) => scenarios.push(...expandScenarioId(id)));
      continue;
    }
    if (arg.startsWith("--scenario=")) {
      arg
        .slice("--scenario=".length)
        .split(",")
        .forEach((id) => scenarios.push(...expandScenarioId(id)));
      continue;
    }
    if (arg === "--locale" || arg === "-l") {
      locale = argv[++i];
      if (!locale) throw new Error("--locale requires ja or en");
      continue;
    }
    if (arg.startsWith("--locale=")) {
      locale = arg.slice("--locale=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  if (locale && !LOCALE_CONFIGS[locale]) {
    throw new Error(`Unknown locale: ${locale}`);
  }

  return {
    scenarios: scenarios.length
      ? uniqueInOrder(scenarios).filter((id) => SCENARIO_ORDER.includes(id))
      : [...SCENARIO_ORDER],
    locales: locale ? [locale] : ["ja", "en"],
  };
}

function expectedFilesForScenarios(scenarios) {
  return uniqueInOrder(
    scenarios.flatMap((scenario) => SCENARIO_FILES[scenario] || []),
  );
}

async function ensureStaticServer() {
  try {
    const res = await fetch(appUrl);
    if (res.ok) return null;
  } catch (_) {
    /* start below */
  }
  const proc = spawn("node", ["scripts/static-server.js"], {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, MILLRECT_STATIC_PORT: STATIC_PORT },
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const res = await fetch(appUrl);
      if (res.ok) return proc;
    } catch (_) {
      /* retry */
    }
  }
  proc.kill();
  throw new Error(`Static server did not start on ${appUrl}`);
}

const DOCS_SIDEBAR_W = 260;

async function setDocsSidebarWidth(page, widthPx) {
  await page.evaluate((w) => {
    document.documentElement.style.setProperty("--right-w", `${w}px`);
  }, widthPx);
  await flushRender(page);
}

async function captureSidebarScreenshot(page, outDir, fileName) {
  await setDocsSidebarWidth(page, DOCS_SIDEBAR_W);
  await page.locator("#sidebar-right").screenshot({
    path: path.join(outDir, fileName),
  });
  await setDocsSidebarWidth(page, 260);
}

async function openProjectListDialog(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(appUrl);
  await page.waitForFunction(() =>
    Boolean(window.getState?.() && window.getCurrentPage?.()),
  );
  await page.locator("#btn-project-menu").click();
  await page.locator('[data-trigger="btn-open"]').click();
  await page.locator("#startup-dialog").waitFor({ state: "visible" });
}

async function openNewProject(page, config, name) {
  await openProjectListDialog(page);
  const previousTabCount = await page.evaluate(
    () => window.getProjectTabs?.().length || 0,
  );
  await page.locator("#pl-btn-new").click();
  await page.locator("#startup-project-name").fill(name);
  await page.locator("#startup-btn-new").click();
  await page.locator("#startup-overlay").waitFor({ state: "hidden" });
  await page.waitForFunction(
    ({ previousTabCount, name }) =>
      Boolean(
        window.getState?.() &&
          window.getCurrentPage?.() &&
          window.getProjectTabs?.().length > previousTabCount &&
          window.getState().projectName === name,
      ),
    { previousTabCount, name },
  );
}

async function captureStartupScenario(page, config) {
  const OUT = config.outDir;
  await openProjectListDialog(page);
  await page.screenshot({ path: path.join(OUT, "startup-dialog.png") });

  await page.locator("#pl-btn-new").click();
  await page.locator("#startup-project-name").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(OUT, "startup-new-form.png") });

  await openProjectListDialog(page);
  await page.locator("#pl-search").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(OUT, "startup-project-list.png") });
}

async function captureDrawingRectScenario(page, config) {
  const OUT = config.outDir;
  await openNewProject(page, config, config.projectNameBox);

  await page.evaluate(applyDrawingRectScenario);
  await waitForShapeInSvg(page, "doc-rect");
  await page.evaluate(focusShapeInView, "doc-rect");
  await flushRender(page);
  await page.screenshot({ path: path.join(OUT, "drawing-rect.png") });
}

async function openDrawingFeaturesScenario(page, config) {
  await openNewProject(page, config, config.projectNameBox);

  await page.evaluate(applyDrawingFeaturesScenario);
  await page.evaluate(focusDrawingFeaturesView, DRAWING_FEATURES_CAPTURE_VIEW);
  await flushRender(page);
  await waitForShapeInSvg(page, "feat-top");
  await waitForShapeInSvg(page, "feat-dim-w");
}

async function captureDrawingFeaturesScreens(page, config) {
  const OUT = config.outDir;
  await page.screenshot({ path: path.join(OUT, "main-window.png") });

  await page.locator('.panel-tab[data-tab="layers"]').click();
  await page.evaluate(focusDrawingFeaturesView, DRAWING_FEATURES_CAPTURE_VIEW);
  await flushRender(page);
  await page.screenshot({ path: path.join(OUT, "drawing-features.png") });
}

async function captureDesignPanel(page, config) {
  const OUT = config.outDir;
  await page.evaluate(() => {
    getState().selectedShapeIds = ["feat-top"];
    render();
    uiUpdate();
  });
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "design-panel.png");
}

async function addAnnotationText(page, config) {
  await page.evaluate((engravingText) => {
    window.electronAPI = window.electronAPI || { isDesktopApp: true };
    window.electronAPI.outlineTextShape = async () => ({ children: [] });
    window.electronAPI.measureTextLayout = async () => ({ layout: {} });
    const scale = DOC_DOCS_SCALE;
    const layout = docBoxTopLayout(DOC_DOCS_MM, scale);
    const { w, d, ox, oy } = layout;
    const page0 = getCurrentPage();
    page0.layers[0].shapes.push({
      id: "feat-text",
      type: "text",
      x: ox + 60,
      y: oy + 16,
      width: 320,
      text: engravingText,
      fontSize: 10,
      lineHeight: 1.1,
      fontFamily: "Gen Interface JP",
      fontWeight: "bold",
      textAlign: "left",
      stroke: "#14213d",
      strokeWidth: "medium",
    });
    getState().selectedShapeIds = ["feat-text"];
    render();
    uiUpdate();
  }, config.engravingText);
  await waitForShapeInSvg(page, "feat-text");
}

async function captureAnnotationPlateScenario(page, config) {
  const OUT = config.outDir;
  await openDrawingFeaturesScenario(page, config);
  await addAnnotationText(page, config);
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "design-panel-text.png");
  await page.evaluate(focusShapeInView, "feat-top");
  await flushRender(page);
  await page.screenshot({ path: path.join(OUT, "drawing-text.png") });
}

async function captureLayersPanel(page, config) {
  const OUT = config.outDir;
  await page.evaluate(({ layerNotes, noteText }) => {
    const scale = DOC_DOCS_SCALE;
    const layout = docBoxTopLayout(DOC_DOCS_MM, scale);
    const { ox, oy } = layout;
    const pg = getCurrentPage();
    pg.layers.push({
      id: genId("layer"),
      name: layerNotes,
      visible: true,
      locked: false,
      shapes: [
        {
          id: "layer-note",
          type: "text",
          x: ox + 200,
          y: oy - 40,
          text: noteText,
          fontSize: 3.5,
          stroke: "#64748b",
        },
      ],
    });
    render();
    uiUpdate();
  }, config);
  await page.locator('.panel-tab[data-tab="layers"]').click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "layers-panel.png");
}

async function captureEditingDemo(page, config) {
  const OUT = config.outDir;
  await page.evaluate(applyEditingDemoScenario);
  await page.evaluate(focusShapeInView, "edit-top");
  await flushRender(page);
  await waitForShapeInSvg(page, "edit-top");
  await page.screenshot({ path: path.join(OUT, "editing-multiselect.png") });
}

async function captureHelpPopover(page, config) {
  const OUT = config.outDir;
  await page.locator("#btn-help").click();
  await page
    .locator("#help-popover:not([hidden])")
    .waitFor({ state: "visible" });
  await page.locator("#help-popover").screenshot({
    path: path.join(OUT, "help-shortcuts.png"),
  });
  await page.locator("#btn-help-close").click();
}

async function captureSketchTracePlateScenario(page, config) {
  const OUT = config.outDir;
  await openNewProject(
    page,
    config,
    config.locale === "ja" ? "スケッチ取り込み" : "Sketch import",
  );
  await page.evaluate(
    (locale) => runDocsScenario("sketch_digitize_demo", { locale }),
    config.locale,
  );
  await waitForShapeInSvg(page, "doc-ghost-rect");
  await page.locator("#reference-image").waitFor({ state: "attached" });
  await fitPageForCapture(page);
  await flushRender(page);
  await page.screenshot({ path: path.join(OUT, "sketch-digitize.png") });

  await page.locator('.panel-tab[data-tab="pages"]').click();
  await page
    .locator(
      '[data-section="panel.pages.referenceImage"] .panel-collapse-trigger',
    )
    .click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "reference-image-panel.png");
}

async function captureModuleJoint1Scenario(page, config) {
  const OUT = config.outDir;
  await openNewProject(page, config, "Module Joint 1");
  const focusModuleJoint = () => {
    const page0 = getCurrentPage();
    const found = findShapeById("module-joint-1-outline");
    const bb = getShapeBBox(found.shape, page0.scale);
    const state = getState();
    const leftOff = 88;
    const rightOff = 300;
    const toolbarH = 48;
    const statusH = 24;
    const margin = 72;
    const availW = window.innerWidth - leftOff - rightOff - margin * 2;
    const availH = window.innerHeight - toolbarH - statusH - margin * 2;
    const zoom = Math.min(availW / bb.w, availH / bb.h) * 0.86;
    state.zoom = Math.max(0.2, Math.min(zoom, 10));
    state.panX =
      leftOff + margin + (availW - bb.w * state.zoom) / 2 - bb.x * state.zoom;
    state.panY =
      toolbarH + margin + (availH - bb.h * state.zoom) / 2 - bb.y * state.zoom;
    state.panY += 36;
    render();
    uiUpdate();
  };
  await page.evaluate(() => {
    const result = applyModuleJoint1Scenario();
    window.__moduleJoint1Pages = result;
  });
  await page.evaluate(focusModuleJoint);
  await waitForShapeInSvg(page, "module-joint-1-outline");
  await flushRender(page);
  await page.screenshot({ path: path.join(OUT, "main-window.png") });
  await page.screenshot({ path: path.join(OUT, "drawing-rect.png") });
  await page.screenshot({ path: path.join(OUT, "drawing-features.png") });
  await page.screenshot({ path: path.join(OUT, "drawing-text.png") });
  await page.screenshot({ path: path.join(OUT, "editing-multiselect.png") });
  await page.screenshot({ path: path.join(OUT, "multiview-top-drawing.png") });
  await page.screenshot({ path: path.join(OUT, "sketch-digitize.png") });
  await page.screenshot({
    path: path.join(OUT, "module-joint-1-millrect.png"),
  });

  await page.locator("#tools-float").screenshot({
    path: path.join(OUT, "tools-panel.png"),
  });

  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "design-panel.png");

  await page.evaluate(() => {
    getState().selectedShapeIds = ["module-joint-1-note"];
    render();
    uiUpdate();
  });
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "design-panel-text.png");

  await page.locator('.panel-tab[data-tab="layers"]').click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "layers-panel.png");

  await page.locator('.panel-tab[data-tab="pages"]').click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "pages-add-view.png");
  await captureSidebarScreenshot(page, OUT, "pages-multiview.png");
  await captureSidebarScreenshot(page, OUT, "reference-image-panel.png");

  await page.evaluate(focusModuleJoint);
  await flushRender(page);

  const sectionPageId = await page.evaluate(
    () => window.__moduleJoint1Pages?.sectionPageId,
  );
  await switchToPage(page, sectionPageId, "module-joint-1-section");
  await page.evaluate(() => {
    const found = findShapeById("module-joint-1-section");
    const bb = getShapeBBox(found.shape, getCurrentPage().scale);
    const state = getState();
    state.zoom = 7;
    state.panX = 520 - bb.x * state.zoom;
    state.panY = 430 - bb.y * state.zoom;
    render();
    uiUpdate();
  });
  await page.locator('.panel-tab[data-tab="pages"]').click();
  await flushRender(page);
  await page.screenshot({
    path: path.join(OUT, "multiview-front-drawing.png"),
  });

  await waitFor3DMesh(page);
  await page.locator("#panel-3d").screenshot({
    path: path.join(OUT, "3d-panel.png"),
  });
  await page.evaluate(() => {
    if (typeof window.setAppMode === "function") {
      window.setAppMode("2d");
    } else {
      document.getElementById("panel-3d")?.classList.remove("visible");
    }
  });
  await flushRender(page);
  await page
    .locator("#toolbar")
    .screenshot({ path: path.join(OUT, "toolbar.png") });
}

async function captureMultiviewScreens(page, config, options = {}) {
  const OUT = config.outDir;
  await openNewProject(page, config, config.projectNameBox);
  const { topPageId, frontPageId } = await page.evaluate(
    applyMultiviewDocsBoxScenario,
  );
  await waitForShapeInSvg(page, "doc-top-rect");
  await switchToPage(page, topPageId, "doc-top-rect");
  await page.evaluate(focusDrawingFeaturesView, DRAWING_FEATURES_CAPTURE_VIEW);

  await page.locator('.panel-tab[data-tab="pages"]').click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "pages-add-view.png");

  await page.screenshot({
    path: path.join(OUT, "multiview-top-drawing.png"),
  });

  await switchToPage(page, frontPageId, "doc-front-rect");
  await page.locator('.panel-tab[data-tab="pages"]').click();
  await flushRender(page);
  await captureSidebarScreenshot(page, OUT, "pages-multiview.png");
  if (options.pagesOnly) return;

  await page.screenshot({
    path: path.join(OUT, "multiview-front-drawing.png"),
  });

  await switchToPage(page, topPageId, "doc-top-rect");
  await waitFor3DMesh(page);
  await page.locator("#panel-3d").screenshot({
    path: path.join(OUT, "3d-panel.png"),
  });

  await page.locator("#btn-3d-close").click();
  await flushRender(page);
  await page
    .locator("#toolbar")
    .screenshot({ path: path.join(OUT, "toolbar.png") });

  await page.locator("#btn-project-menu").click();
  await page.locator("#project-actions-dialog").waitFor({ state: "visible" });
  await page.screenshot({ path: path.join(OUT, "project-menu.png") });
  await page.locator("#project-actions-dialog .pl-btn-close").click();

  const status = await page.evaluate(() => get3DSceneStatus());
  if (status.meshCount < 1) {
    throw new Error(
      `[${config.locale}] 3D mesh not generated for docs screenshots: ${status.message}`,
    );
  }
  console.log(`[${config.locale}] 3D meshCount: ${status.meshCount}`);
}

async function captureMountingPlateBasicScenario(page, config) {
  await openDrawingFeaturesScenario(page, config);
  await captureDrawingFeaturesScreens(page, config);
  await captureMultiviewScreens(page, config);
}

async function captureWorkspaceOrientationScenario(page, config) {
  const OUT = config.outDir;
  await openDrawingFeaturesScenario(page, config);
  await page.screenshot({ path: path.join(OUT, "main-window.png") });
  await page.locator("#tools-float").screenshot({
    path: path.join(OUT, "tools-panel.png"),
  });
  await captureDesignPanel(page, config);
  await captureLayersPanel(page, config);
  await captureEditingDemo(page, config);
  await captureHelpPopover(page, config);
  await captureMultiviewScreens(page, config, { pagesOnly: true });
}

const SCENARIO_CAPTURE = {
  startup: captureStartupScenario,
  drawing_rect: captureDrawingRectScenario,
  mounting_plate_basic: captureMountingPlateBasicScenario,
  workspace_orientation: captureWorkspaceOrientationScenario,
  annotation_plate: captureAnnotationPlateScenario,
  sketch_trace_plate: captureSketchTracePlateScenario,
  module_joint_1: captureModuleJoint1Scenario,
};

async function captureLocaleScreenshots(page, config, scenarios) {
  const OUT = config.outDir;
  fs.mkdirSync(OUT, { recursive: true });

  for (const scenario of scenarios) {
    const capture = SCENARIO_CAPTURE[scenario];
    if (!capture)
      throw new Error(`No capture function for scenario: ${scenario}`);
    console.log(`[${config.locale}] Capturing ${scenario}`);
    await capture(page, config);
  }

  console.log(`[${config.locale}] Screenshots saved to ${OUT}`);
}

async function main() {
  const { scenarios, locales } = parseArgs(process.argv.slice(2));
  const expectedFiles = expectedFilesForScenarios(scenarios);

  const serverProc = await ensureStaticServer();
  const browser = await chromium.launch();

  for (const locale of locales) {
    const config = LOCALE_CONFIGS[locale];
    if (!config) {
      throw new Error(`Unknown locale: ${locale}`);
    }

    const context = await browser.newContext();
    await context.addInitScript((loc) => {
      localStorage.setItem("millrect-locale", loc);
    }, config.locale);

    const page = await context.newPage();
    page.on("pageerror", (err) =>
      console.error(`[${locale}] pageerror:`, err.message),
    );

    await captureLocaleScreenshots(page, config, scenarios);
    await context.close();
  }

  await browser.close();
  if (serverProc) serverProc.kill();

  for (const locale of locales) {
    const outDir = LOCALE_CONFIGS[locale].outDir;
    for (const file of expectedFiles) {
      const full = path.join(outDir, file);
      if (!fs.existsSync(full)) {
        throw new Error(`Missing screenshot: ${full}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
