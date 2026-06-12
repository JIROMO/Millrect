const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  Menu,
} = require("electron");
const zlib = require("zlib");
// Enable Local Font Access API so renderer can call window.queryLocalFonts()
app.commandLine.appendSwitch("enable-features", "LocalFonts");
// Chromium GPU の無害な mailbox/overlay ERROR ログを抑制（描画・GPU 機能には影響なし）
app.commandLine.appendSwitch("disable-logging");
const { findFontFile, readFontFile } = require("./electron/font-path");
const { outlineText, measureTextLayout } = require("./electron/text-outline");
const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const { WebSocketServer } = require("ws");

const REPO_ROOT = __dirname;

const menuLocales = require("./packages/locales/menus.json");
let _appLocale = "ja";

function menuLabel(key) {
  return menuLocales[_appLocale]?.[key] ?? menuLocales.ja?.[key] ?? key;
}

function normalizeAppLocale(code) {
  const c = String(code || "")
    .trim()
    .toLowerCase()
    .split("-")[0];
  return c === "en" ? "en" : "ja";
}

const WS_PORT = 23450;
let _win = null;
let _wss = null;
let _wsToken = null;

function getWsToken() {
  if (!_wsToken) _wsToken = crypto.randomBytes(32).toString("hex");
  return _wsToken;
}

// WS の認証ファイルは os.homedir() ベースの固定パスへ書く。
// os.tmpdir() はプロセスごとに $TMPDIR が食い違い、MCP サーバーと
// 不一致になって Unauthorized を招くため使わない。
function wsAuthDir() {
  const dir = path.join(os.homedir(), ".millrect");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeWsAuthFiles(port) {
  const dir = wsAuthDir();
  fs.writeFileSync(path.join(dir, "millrect-ws-port"), String(port));
  fs.writeFileSync(path.join(dir, "millrect-ws-token"), getWsToken());
}

function startWebSocketServer(port = WS_PORT) {
  const server = new WebSocketServer({ host: "127.0.0.1", port });

  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log(`[MCP-WS] port ${port} in use, trying ${port + 1}…`);
      server.close();
      startWebSocketServer(port + 1);
    } else {
      console.error("[MCP-WS]", e.message);
    }
  });

  server.once("listening", () => {
    _wss = server;
    writeWsAuthFiles(port);
    if (port !== WS_PORT) console.log(`[MCP-WS] listening on port ${port}`);
  });

  server.on("connection", (ws) => {
    ws.on("message", async (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const { id, action, token } = msg;
      if (token !== getWsToken()) {
        ws.send(JSON.stringify({ id, error: "Unauthorized" }));
        return;
      }
      try {
        let result;

        if (action === "getState") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const state = getState();
              const page  = getCurrentPage();
              const ID_SCALE = { numerator: 1, denominator: 1 };
              const allShapes = getAllShapesOnPage(page);
              const profiles  = extractProfilesFromPage(page);

              return {
                projectName: state.projectName,
                unit: state.unit,
                page: {
                  id:           page.id,
                  name:         page.name,
                  paper:        page.paper,
                  orientation:  page.orientation,
                  scale:        page.scale,
                  viewDefinition: page.viewDefinition ?? null,
                },
                // 図形（dimensions は含まない）
                shapes: allShapes.map(s => {
                  const bb = getShapeBBox(s, ID_SCALE);
                  return {
                    id:      s.id,
                    type:    s.type,
                    bbox:    bb,
                    feature: s.feature ?? null,
                  };
                }),
                // 寸法線（shapes とは独立）
                dimensions: (page.dimensions || []).map(d => ({
                  id:            d.id,
                  dimensionType: d.dimensionType,
                  from:          d.from,
                  to:            d.to,
                  offset:        d.offset,
                })),
                // Profile（閉じた輪郭として 3D 生成に使える図形）
                profiles: profiles.map(p => ({
                  id:       p.id,
                  sourceId: p.sourceId,
                  bbox:     p.bbox,
                  area:     p.area,
                })),
                selectedShapeIds: state.selectedShapeIds,
              };
            })()
          `);
        } else if (action === "applyCommands") {
          const cmds = JSON.stringify(msg.commands);
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                applyDrawingCommands(${cmds});
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "clearCanvas") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const page = getCurrentPage();
              const layer = getCurrentLayer();
              layer.shapes = [];
              pushHistory(); render(); uiUpdate();
              return { ok: true };
            })()
          `);
        } else if (action === "getSvg") {
          result = await _win.webContents.executeJavaScript(`
            (() => ({ svg: buildPageSVG(getCurrentPage()).outerHTML }))()
          `);
        } else if (action === "alignShapes") {
          const dir = JSON.stringify(msg.direction);
          result = await _win.webContents.executeJavaScript(`
            (() => { alignShapes(${dir}); render(); uiUpdate(); return { ok: true }; })()
          `);
        } else if (action === "distributeShapes") {
          const axis = JSON.stringify(msg.axis);
          result = await _win.webContents.executeJavaScript(`
            (() => { distributeShapes(${axis}); render(); uiUpdate(); return { ok: true }; })()
          `);
        } else if (action === "undo") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const ok = undo();
              render(); uiUpdate();
              return { ok, canUndo: canUndo(), canRedo: canRedo() };
            })()
          `);
        } else if (action === "redo") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const ok = redo();
              render(); uiUpdate();
              return { ok, canUndo: canUndo(), canRedo: canRedo() };
            })()
          `);
        } else if (action === "groupShapes") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              groupSelectedShapes();
              render(); uiUpdate();
              return { ok: true, groupId: getState().selectedShapeIds[0] ?? null };
            })()
          `);
        } else if (action === "ungroupShapes") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              ungroupSelectedShapes();
              render(); uiUpdate();
              return { ok: true };
            })()
          `);
        } else if (action === "booleanSubtract") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                subtractSelectedShapes();
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "booleanUnion") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                unionSelectedShapes();
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "booleanIntersect") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                intersectSelectedShapes();
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "booleanExclude") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                excludeSelectedShapes();
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "booleanFlatten") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                flattenSelectedShapes();
                render(); uiUpdate();
                return { ok: true };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "addConstraint") {
          const cst = JSON.stringify(msg.constraint);
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                const id = addConstraint(${cst});
                applyConstraints(); render(); uiUpdate();
                return { ok: true, id };
              } catch(e) { return { ok: false, error: e.message }; }
            })()
          `);
        } else if (action === "removeConstraint") {
          const cid = JSON.stringify(msg.id);
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const ok = removeConstraint(${cid});
              render(); uiUpdate();
              return { ok };
            })()
          `);
        } else if (action === "getConstraints") {
          result = await _win.webContents.executeJavaScript(`
            (() => ({
              constraints: getAllConstraints(),
            }))()
          `);
        } else if (action === "setSelectedShapes") {
          // selectedShapeIds は常に配列でなければならない。配列以外（undefined 等）が
          // 渡されると renderer/interaction/ui が .includes/.length で落ちるため矯正する。
          const ids = JSON.stringify(Array.isArray(msg.ids) ? msg.ids : []);
          result = await _win.webContents.executeJavaScript(`
            (() => {
              getState().selectedShapeIds = ${ids};
              render(); uiUpdate();
              return { ok: true };
            })()
          `);
        } else if (action === "getProjectContext") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const state    = getState();
              const allShapes = state.pages.flatMap(p => p.layers.flatMap(l => l.shapes));
              const allDims   = state.pages.flatMap(p => p.dimensions || []);
              const page      = getCurrentPage();
              return {
                projectName:    state.projectName,
                projectId:      getCurrentProjectId(),
                isNew:          allShapes.length === 0 && allDims.length === 0,
                totalShapes:    allShapes.length,
                totalDimensions: allDims.length,
                profileCount:   extractProfilesFromPage(page).length,
                pageCount:      state.pages.length,
                currentPage:    page.name,
                viewDefinition: page.viewDefinition ?? null,
                projectBrief: state.projectBrief ?? null,
                briefSummary: briefSummary(state.projectBrief),
              };
            })()
          `);
        } else if (action === "getTasteContext") {
          result = await _win.webContents.executeJavaScript(`
            (async () => getTasteContext())()
          `);
        } else if (action === "listGlobalPrinciples") {
          result = await _win.webContents.executeJavaScript(`
            (async () => listGlobalPrinciples())()
          `);
        } else if (action === "promotePrinciple") {
          const input = JSON.stringify(
            msg.input ?? { statement: msg.statement },
          );
          result = await _win.webContents.executeJavaScript(`
            (async () => {
              try {
                return await promotePrinciple(${input});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "appendArtifactLog") {
          const entry = JSON.stringify(msg.entry ?? {});
          const opts = JSON.stringify({
            historyLabel: msg.historyLabel ?? "Artifact review",
          });
          result = await _win.webContents.executeJavaScript(`
            (() => appendArtifactLogEntry(${entry}, ${opts}))()
          `);
        } else if (action === "updateProjectBrief") {
          const patch = JSON.stringify(msg.patch ?? {});
          const opts = JSON.stringify({
            pushHistory: msg.pushHistory !== false,
            historyLabel: msg.historyLabel ?? "Update project brief",
          });
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return updateProjectBrief(${patch}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "recordDecision") {
          const partial = JSON.stringify(msg.decision ?? msg.partial ?? {});
          const opts = JSON.stringify({
            pushHistory: msg.pushHistory !== false,
            historyLabel: msg.historyLabel ?? "Record decision",
          });
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return recordDecision(${partial}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "setProjectPhase") {
          const phase = JSON.stringify(msg.phase ?? "");
          const opts = JSON.stringify({
            pushHistory: msg.pushHistory !== false,
          });
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return setProjectPhase(${phase}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "appendSessionLearnings") {
          const payload = JSON.stringify(msg.payload ?? {});
          const opts = JSON.stringify({
            historyLabel: msg.historyLabel ?? "Session learnings",
          });
          result = await _win.webContents.executeJavaScript(`
            (async () => {
              try {
                return appendSessionLearnings(${payload}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "get3DSceneStatus") {
          result = await _win.webContents.executeJavaScript(`
            (() => get3DSceneStatus())()
          `);
        } else if (action === "update3DScene") {
          result = await _win.webContents.executeJavaScript(`
            (() => {
              const canvas = document.getElementById("canvas-3d");
              if (canvas && !_3scene) init3DView(canvas);
              update3DScene();
              return get3DSceneStatus();
            })()
          `);
        } else if (action === "validate3DReadiness") {
          result = await _win.webContents.executeJavaScript(`
            (() => validate3DReadiness())()
          `);
        } else if (action === "createMultiviewBox") {
          const opts = JSON.stringify(msg.options ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return createMultiviewBox(${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "layoutRectOnPageMm") {
          const mmW = Number(msg.mmW);
          const mmH = Number(msg.mmH);
          const style = JSON.stringify(msg.style ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return layoutRectOnPageMm(${mmW}, ${mmH}, ${style});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "createPart") {
          const opts = JSON.stringify(msg.options ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return createPart(${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "switchPage") {
          const pageId = JSON.stringify(msg.pageId);
          result = await _win.webContents.executeJavaScript(`
            (() => {
              switchPage(${pageId});
              render(); uiUpdate();
              return { ok: true, pageId: getCurrentPage().id, name: getCurrentPage().name };
            })()
          `);
        } else if (action === "listDocsScenarios") {
          result = await _win.webContents.executeJavaScript(`
            (() => listDocsScenarios())()
          `);
        } else if (action === "runDocsScenario") {
          const scenarioId = JSON.stringify(msg.scenarioId);
          const opts = JSON.stringify(msg.options ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return runDocsScenario(${scenarioId}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "prepareDocsCaptureView") {
          const opts = JSON.stringify(msg.options ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => prepareDocsCaptureView(${opts}))()
          `);
        } else if (action === "captureScreenshot") {
          const opts = msg.options || {};
          if (opts.scenario) {
            await _win.webContents.executeJavaScript(`
              (() => runDocsScenario(${JSON.stringify(opts.scenario)}, ${JSON.stringify({ locale: opts.locale, update3d: opts.update3d })}))()
            `);
          }
          if (opts.prepare) {
            await _win.webContents.executeJavaScript(`
              (() => prepareDocsCaptureView(${JSON.stringify(opts.prepare)}))()
            `);
          }
          await _win.webContents.executeJavaScript(`
            (() => { document.getElementById("startup-overlay")?.remove(); })()
          `);
          await _win.webContents.executeJavaScript(`
            (() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))()
          `);
          let rect = null;
          if (opts.target) {
            const rectResult = await _win.webContents.executeJavaScript(`
              (() => getCaptureRectForTarget(${JSON.stringify(opts.target)}))()
            `);
            if (!rectResult?.ok) {
              result = rectResult;
            } else {
              rect = rectResult.rect;
            }
          }
          if (result === undefined) {
            const { nativeImage } = require("electron");
            const img = rect
              ? await _win.webContents.capturePage(rect)
              : await _win.webContents.capturePage();
            const relPath =
              opts.path || `docs/images/mcp-capture-${Date.now()}.png`;
            const outPath = path.isAbsolute(relPath)
              ? relPath
              : path.join(REPO_ROOT, relPath);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, img.toPNG());
            const size = img.getSize();
            result = {
              ok: true,
              path: outPath,
              relativePath: relPath,
              width: size.width,
              height: size.height,
            };
            if (opts.recordArtifact !== false) {
              const artifactPayload = JSON.stringify({
                ok: true,
                path: outPath,
                relativePath: relPath,
                width: size.width,
                height: size.height,
              });
              await _win.webContents.executeJavaScript(`
                (() => recordCaptureArtifactLog(${artifactPayload}, { pushHistory: false }))()
              `);
            }
          }
        } else if (action === "setReferenceImage") {
          const pageId = JSON.stringify(msg.pageId ?? null);
          const spec = JSON.stringify(msg.spec ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => setReferenceImage(${pageId}, ${spec}))()
          `);
        } else if (action === "setReferenceImageScaleAnchor") {
          const pageId = JSON.stringify(msg.pageId ?? null);
          const from = JSON.stringify(msg.from);
          const to = JSON.stringify(msg.to);
          const lengthMm = Number(msg.lengthMm);
          result = await _win.webContents.executeJavaScript(`
            (() => setReferenceImageScaleAnchor(${pageId}, ${from}, ${to}, ${lengthMm}))()
          `);
        } else if (action === "loadReferenceImageFromFile") {
          const filePath = path.isAbsolute(msg.filePath)
            ? msg.filePath
            : path.join(REPO_ROOT, msg.filePath);
          if (!fs.existsSync(filePath)) {
            result = { ok: false, error: `File not found: ${filePath}` };
          } else {
            const buf = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime =
              ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : "image/png";
            const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
            const pageId = JSON.stringify(msg.pageId ?? null);
            const spec = JSON.stringify({
              dataUrl,
              widthMm: msg.widthMm,
              heightMm: msg.heightMm,
              opacity: msg.opacity,
            });
            result = await _win.webContents.executeJavaScript(`
              (() => setReferenceImage(${pageId}, ${spec}))()
            `);
          }
        } else if (action === "compilePartDsl") {
          const dsl = JSON.stringify(msg.dsl ?? msg.options ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => compilePartDslPlan(${dsl}))()
          `);
        } else if (action === "applyPartDsl") {
          const dsl = JSON.stringify(msg.dsl ?? {});
          const opts = JSON.stringify(msg.runtimeOpts ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return applyPartDsl(${dsl}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "updatePartParam") {
          const param = JSON.stringify(msg.param);
          const valueMm = Number(msg.valueMm);
          const opts = JSON.stringify(msg.runtimeOpts ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => {
              try {
                return updatePartParam(${param}, ${valueMm}, ${opts});
              } catch (e) {
                return { ok: false, error: e.message };
              }
            })()
          `);
        } else if (action === "validatePartManufacturability") {
          const dsl = JSON.stringify(msg.dsl ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => validatePartManufacturability(${dsl}))()
          `);
        } else if (action === "importPartDslFromFile") {
          const filePath = path.isAbsolute(msg.filePath)
            ? msg.filePath
            : path.join(REPO_ROOT, msg.filePath);
          if (!fs.existsSync(filePath)) {
            result = { ok: false, error: `File not found: ${filePath}` };
          } else {
            const json = fs.readFileSync(filePath, "utf-8");
            const opts = JSON.stringify(msg.runtimeOpts ?? {});
            result = await _win.webContents.executeJavaScript(`
              (() => {
                try {
                  return importPartDslJson(${JSON.stringify(json)}, ${opts});
                } catch (e) {
                  return { ok: false, error: e.message };
                }
              })()
            `);
          }
        } else if (action === "applyDigitizeProposals") {
          const pageId = JSON.stringify(msg.pageId ?? null);
          const proposals = JSON.stringify(msg.proposals ?? []);
          const opts = JSON.stringify(msg.opts ?? {});
          result = await _win.webContents.executeJavaScript(`
            (() => applyDigitizeProposals(${pageId}, ${proposals}, ${opts}))()
          `);
        } else if (action === "confirmDigitizeProposals") {
          const pageId = JSON.stringify(msg.pageId ?? null);
          const shapeIds = JSON.stringify(msg.shapeIds ?? null);
          result = await _win.webContents.executeJavaScript(`
            (() => confirmDigitizeProposals(${pageId}, ${shapeIds}))()
          `);
        } else if (action === "clearDigitizeProposals") {
          const pageId = JSON.stringify(msg.pageId ?? null);
          result = await _win.webContents.executeJavaScript(`
            (() => clearDigitizeProposals(${pageId}))()
          `);
        } else {
          result = { error: `Unknown action: ${action}` };
        }

        ws.send(JSON.stringify({ id, result }));
      } catch (e) {
        ws.send(JSON.stringify({ id, error: e.message }));
      }
    });
  });
}

function createWindow() {
  const { width, height } =
    require("electron").screen.getPrimaryDisplay().workAreaSize;
  _win = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    title: "Millrect",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  _win.loadFile(path.join(__dirname, "app", "index.html"));
}

app.setName("Millrect");

function sendOpenHelpDoc(page, anchor) {
  _win?.webContents.send("menu:openHelpDoc", {
    page: page || "index.html",
    anchor: anchor || null,
  });
}

function buildMenu(locale) {
  if (locale) _appLocale = normalizeAppLocale(locale);
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: menuLabel("app"),
            submenu: [
              { label: menuLabel("app.about"), role: "about" },
              { type: "separator" },
              { label: menuLabel("app.services"), role: "services" },
              { type: "separator" },
              { label: menuLabel("app.hide"), role: "hide" },
              { label: menuLabel("app.hideOthers"), role: "hideOthers" },
              { label: menuLabel("app.unhide"), role: "unhide" },
              { type: "separator" },
              { label: menuLabel("app.quit"), role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: menuLabel("file"),
      submenu: [
        {
          label: menuLabel("file.new"),
          accelerator: "CmdOrCtrl+N",
          click: () => _win?.webContents.send("menu:new"),
        },
        { type: "separator" },
        {
          label: menuLabel("file.open"),
          accelerator: "CmdOrCtrl+O",
          click: () => _win?.webContents.send("menu:open"),
        },
        { type: "separator" },
        {
          label: menuLabel("file.print"),
          accelerator: "CmdOrCtrl+P",
          click: () => _win?.webContents.send("menu:print"),
        },
        { type: "separator" },
        {
          label: menuLabel("file.exportSvg"),
          click: () => _win?.webContents.send("menu:exportSvg"),
        },
        {
          label: menuLabel("file.exportPdf"),
          click: () => _win?.webContents.send("menu:exportPdf"),
        },
        {
          label: menuLabel("file.exportJson"),
          click: () => _win?.webContents.send("menu:exportJson"),
        },
      ],
    },
    {
      label: menuLabel("edit"),
      submenu: [
        {
          label: menuLabel("edit.undo"),
          accelerator: "CmdOrCtrl+Z",
          click: () => _win?.webContents.send("menu:undo"),
        },
        {
          label: menuLabel("edit.redo"),
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => _win?.webContents.send("menu:redo"),
        },
        { type: "separator" },
        { label: menuLabel("edit.cut"), role: "cut" },
        { label: menuLabel("edit.copy"), role: "copy" },
        { label: menuLabel("edit.paste"), role: "paste" },
        { label: menuLabel("edit.selectAll"), role: "selectAll" },
        { type: "separator" },
        {
          label: menuLabel("edit.booleanUnion"),
          accelerator: "Alt+Shift+U",
          click: () => _win?.webContents.send("menu:booleanUnion"),
        },
        {
          label: menuLabel("edit.booleanSubtract"),
          accelerator: "Alt+Shift+S",
          click: () => _win?.webContents.send("menu:booleanSubtract"),
        },
        {
          label: menuLabel("edit.booleanIntersect"),
          accelerator: "Alt+Shift+I",
          click: () => _win?.webContents.send("menu:booleanIntersect"),
        },
        {
          label: menuLabel("edit.booleanExclude"),
          accelerator: "Alt+Shift+E",
          click: () => _win?.webContents.send("menu:booleanExclude"),
        },
        {
          label: menuLabel("edit.booleanFlatten"),
          accelerator: "Alt+Shift+F",
          click: () => _win?.webContents.send("menu:booleanFlatten"),
        },
      ],
    },
    {
      label: menuLabel("view"),
      submenu: [
        {
          label: menuLabel("view.zoomIn"),
          accelerator: "CmdOrCtrl+Plus",
          click: () => _win?.webContents.send("menu:zoomIn"),
        },
        {
          label: menuLabel("view.zoomOut"),
          accelerator: "CmdOrCtrl+-",
          click: () => _win?.webContents.send("menu:zoomOut"),
        },
        {
          label: menuLabel("view.zoomReset"),
          accelerator: "CmdOrCtrl+0",
          click: () => _win?.webContents.send("menu:zoomReset"),
        },
        { type: "separator" },
        { label: menuLabel("view.fullscreen"), role: "togglefullscreen" },
        { type: "separator" },
        {
          label: menuLabel("view.devTools"),
          role: "toggleDevTools",
          accelerator: "CmdOrCtrl+Alt+I",
        },
      ],
    },
    {
      label: menuLabel("window"),
      submenu: [
        { label: menuLabel("window.minimize"), role: "minimize" },
        { label: menuLabel("window.close"), role: "close" },
        ...(isMac
          ? [
              { type: "separator" },
              { label: menuLabel("window.front"), role: "front" },
            ]
          : []),
      ],
    },
    {
      label: menuLabel("help"),
      submenu: [
        {
          label: menuLabel("help.search"),
          accelerator: "CmdOrCtrl+Shift+/",
          click: () => _win?.webContents.send("menu:helpSearch"),
        },
        { type: "separator" },
        {
          label: menuLabel("help.docsTop"),
          click: () => sendOpenHelpDoc("index.html"),
        },
        {
          label: menuLabel("help.gettingStarted"),
          click: () => sendOpenHelpDoc("getting-started.html"),
        },
        {
          label: menuLabel("help.drawing"),
          click: () => sendOpenHelpDoc("drawing.html"),
        },
        {
          label: menuLabel("help.multiview3d"),
          click: () => sendOpenHelpDoc("multiview-3d.html"),
        },
        {
          label: menuLabel("help.shortcuts"),
          click: () => _win?.webContents.send("menu:helpShortcuts"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Allow local-fonts permission for queryLocalFonts() API
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "local-fonts");
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => permission === "local-fonts",
  );
  startWebSocketServer();
  createWindow();
  buildMenu();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("help:openTopic", async (_, { page, anchor }) => {
  sendOpenHelpDoc(page, anchor);
  return { ok: true };
});

ipcMain.handle("app:setLocale", async (_, locale) => {
  buildMenu(locale);
  return { ok: true, locale: _appLocale };
});

async function saveProjectJsonDialog(_, { defaultName, content }) {
  const base = defaultName.replace(/\.json$/i, "");
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("downloads"), base + ".json"),
    filters: [{ name: "Millrect JSON", extensions: ["json"] }],
  });
  if (!filePath) return null;
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

async function openProjectJsonDialog() {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: "Millrect Project", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (!filePaths || filePaths.length === 0) return null;
  const json = fs.readFileSync(filePaths[0], "utf-8");
  return { json, filePath: filePaths[0] };
}

function imageMimeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "image/png";
}

async function openImageFileDialog() {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] },
    ],
    properties: ["openFile"],
  });
  if (!filePaths || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const bytes = fs.readFileSync(filePath);
  return {
    dataUrl: `data:${imageMimeForPath(filePath)};base64,${bytes.toString("base64")}`,
    name: path.basename(filePath),
    filePath,
  };
}

ipcMain.handle("dialog:saveProjectJson", saveProjectJsonDialog);
ipcMain.handle("dialog:openProjectJson", openProjectJsonDialog);
ipcMain.handle("dialog:openImageFile", openImageFileDialog);
/** @deprecated */ ipcMain.handle("dialog:save", saveProjectJsonDialog);
/** @deprecated */ ipcMain.handle("dialog:open", openProjectJsonDialog);

ipcMain.handle("dialog:saveSvg", async (_, { defaultName, content }) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("downloads"), defaultName),
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
  if (!filePath) return null;
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
});

ipcMain.handle("dialog:savePdf", async (_, { defaultName, buffer }) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath("downloads"), defaultName),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!filePath) return null;
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
});

function _fontLibraryPath() {
  return path.join(app.getPath("userData"), "fonts-library.json");
}

function _fontCatalogCachePath() {
  return path.join(app.getPath("userData"), "font-catalog-cache.json");
}

function _readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

ipcMain.handle("fontLibrary:read", async () =>
  _readJsonFileSafe(_fontLibraryPath()),
);

ipcMain.handle("fontLibrary:write", async (_, data) => {
  fs.writeFileSync(_fontLibraryPath(), JSON.stringify(data, null, 2));
});

ipcMain.handle("fontCatalog:read", async () =>
  _readJsonFileSafe(_fontCatalogCachePath()),
);

ipcMain.handle("fontCatalog:write", async (_, data) => {
  fs.writeFileSync(_fontCatalogCachePath(), JSON.stringify(data, null, 2));
});

ipcMain.handle("font:read", async (_, { family, style }) => {
  const filePath = findFontFile(family, style, { includeTtc: false });
  if (!filePath) return null;
  return new Uint8Array(readFontFile(filePath));
});

ipcMain.handle("font:outlineText", async (_, payload) => {
  try {
    return outlineText(payload);
  } catch (err) {
    return { error: err.message || String(err) };
  }
});

ipcMain.handle("font:measureTextLayout", async (_, payload) => {
  try {
    return measureTextLayout(payload);
  } catch (err) {
    return { error: err.message || String(err) };
  }
});
