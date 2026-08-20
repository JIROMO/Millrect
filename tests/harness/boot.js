"use strict";

// ─────────────────────────────────────────────────────────────
// Headless app harness (no browser, no jsdom, zero runtime deps)
//
// Millrect の app/js はブラウザのグローバルスコープ前提（module.exports なし）。
// ここでは node:vm の上に「classic <script> を順に読み込む」ブラウザ意味論を
// 再現して、コア層（state / transform / profiles / constraints / commands）を
// そのまま起動する。MCP / WS が叩く本番経路 `applyDrawingCommands` を端から端まで
// 通せるので、ブラウザを立ち上げずに e2e 相当の検証ができる。
//
// ポイント:
//   * コアファイルを 1 本のスクリプトに「連結」して実行する。
//     → ブラウザ同様、トップレベルの const/let/function を全ファイルで共有できる
//       （runInContext を file ごとに分けると let が共有されず壊れる）。
//   * Date.now を固定 → genId() が決定論的になり、スナップショットが安定する。
//   * コア外への呼び出し（onStateChanged / onTextShapeDocumentChanged 等）は
//     no-op スタブを先に置く。実ファイルを足したくなったら CORE_FILES に追記するだけ。
//
// 新しい機能のテストを足すとき:
//   1. コア層だけで足りるなら、このファイルは触らず tests/integration に test を追加。
//   2. 別の app/js ファイル（例: export.js の buildPageSVG）が要るなら
//      CORE_FILES に 1 行足す（DOM が要るものは jsdom 層 boot-dom.js 側へ）。
// ─────────────────────────────────────────────────────────────

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");

// ID を決定論化するための固定時刻（任意の定数でよい）
const FROZEN_NOW = 1700000000000;

// 連結して読み込むコア層（app/index.html のロード順に準拠）。
// DOM を要するファイル（renderer.js / export.js / ui.js …）はここに入れない。
const CORE_FILES = [
  "app/js/state.js",
  "app/js/transform.js",
  "app/js/interaction-geometry.js",
  "app/js/profiles.js",
  "app/js/constraints.js",
  "app/js/commands.js",
];

// 連結スクリプトの先頭で読み込む UMD ベンダ（global 代入なので個別実行で永続化する）
const VENDOR_FILES = ["app/vendor/polygon-clipping.umd.js"];

// app/js が呼びうる「コア外の関数」を no-op で先に定義しておく。
// var にすることでコンテキストのグローバルに残り、連結スクリプトから参照できる。
const PRELUDE = `
  // ── 決定論クロック（genId 用）─────────────────
  Date.now = function () { return ${FROZEN_NOW}; };

  // ── 3D 用 THREE の最小スタブ（profiles.js のロード時参照よけ）──
  // 実際の 3D メッシュ生成はここでは検証しない（必要なら別ハーネスで）。
  var THREE = {
    Shape: function () { this.holes = []; this.moveTo = function () {}; this.lineTo = function () {}; this.absarc = function () {}; this.bezierCurveTo = function () {}; this.quadraticCurveTo = function () {}; },
    Path:  function () { this.moveTo = function () {}; this.lineTo = function () {}; this.absarc = function () {}; this.bezierCurveTo = function () {}; this.quadraticCurveTo = function () {}; },
    Vector2: function (x, y) { this.x = x; this.y = y; },
  };

  // ── コア外の連携フック（実ファイル未ロードでも落ちないよう no-op）──
  var onStateChanged = function () {};
  var onTextShapeDocumentChanged = function () {};
  var render = function () {};
  var renderBezierOverlay = function () {};
  var updateUI = function () {};
  var Worker = undefined;
  var t = function (key) { return key; }; // i18n。defaultState 等が typeof ガードで参照

  // ── getShapeBBox の最小実装（本体は renderer.js＝DOM 層にありハーネス未ロード）──
  // align/distribute のテスト用。_ID_SCALE（real units 恒等スケール）前提で、
  // 回転・グループ・テキスト計測は扱わない（必要になったら boot-dom.js 側で本物を使う）。
  var getShapeBBox = function (shape) {
    if (shape.type === "line") {
      return {
        x: Math.min(shape.x1, shape.x2),
        y: Math.min(shape.y1, shape.y2),
        w: Math.abs(shape.x2 - shape.x1),
        h: Math.abs(shape.y2 - shape.y1),
      };
    }
    if (typeof shape.width === "number" && typeof shape.height === "number") {
      return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
    }
    return null;
  };
`;

// 起動後に Node 側へ公開する関数名（存在しないものは黙ってスキップ）。
// 新しいコア API を露出したくなったら、ここに名前を足すだけ。
const EXPORT_NAMES = [
  // lifecycle
  "initState",
  "getState",
  "defaultState",
  // command 入口（MCP / WS と同じ本番経路）
  "applyDrawingCommands",
  // shape CRUD
  "addShape",
  "updateShape",
  "deleteShape",
  "selectShapeFromList",
  "createRevolvedShapeFromSelectedCircle",
  // lookups
  "findShapeById",
  "getCurrentPage",
  "getCurrentLayer",
  "getShapeBBox",
  "getPageCanvasMM",
  "snapToShapes",
  "_simplifySnapRing",
  "getPathInteractionGeometry",
  "dimensionValueMM",
  // history
  "undo",
  "redo",
  "canUndo",
  "canRedo",
  "pushHistory",
  "getDocumentRenderVersion",
  "getShapeRenderVersion",
  "markShapeDirty",
  // ids
  "genId",
  // derived: profiles（2D→3D 派生の入口）
  "shapeToProfile",
  "shapeToProfileRings",
  "extractProfilesFromPage",
  // boolean 入力（回転焼き込みの回帰テスト用）
  "shapeToClipPolygon",
  "offsetClipPolygon",
  "insetClipPolygon",
  "outsetClipPolygon",
  // ops
  "alignShapes",
  "distributeShapes",
  "groupSelectedShapes",
  "ungroupSelectedShapes",
  "subtractSelectedShapes",
  "unionSelectedShapes",
  "offsetSelectedShapes",
  // constraints
  "getAllConstraints",
  "applyConstraints",
  "addConstraint",
  "removeConstraint",
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/**
 * ヘッドレスでコア層を起動し、公開 API オブジェクトを返す。
 * 既に initState() 済み（page-1 / layer-1 が存在する空プロジェクト）。
 *
 * @returns {object} EXPORT_NAMES の関数群 + reset()
 */
function bootApp() {
  const sandbox = { console };
  vm.createContext(sandbox);

  // 1) prelude（クロック固定・スタブ）
  vm.runInContext(PRELUDE, sandbox, { filename: "<harness-prelude>" });

  // 2) vendor（UMD: global 代入で永続化）
  for (const f of VENDOR_FILES) {
    vm.runInContext(read(f), sandbox, { filename: f });
  }

  // 3) コア層を 1 本に連結（ブラウザの classic-script 共有スコープを再現）
  let src = "";
  for (const f of CORE_FILES) {
    src += `\n//=== ${f} ===\n` + read(f) + "\n";
  }
  // epilogue: トップレベルの束縛を direct eval で拾って globalThis.__app へ
  src +=
    "\n;(function () {\n" +
    "  var names = " +
    JSON.stringify(EXPORT_NAMES) +
    ";\n" +
    "  var out = {};\n" +
    "  for (var i = 0; i < names.length; i++) {\n" +
    "    try { out[names[i]] = eval(names[i]); } catch (e) { /* 未定義はスキップ */ }\n" +
    "  }\n" +
    "  globalThis.__app = out;\n" +
    "})();\n";

  vm.runInContext(src, sandbox, { filename: "<harness-core>" });

  const app = sandbox.__app;
  app.reset = () => app.initState();
  app.reset(); // 空プロジェクトで開始
  return app;
}

module.exports = { bootApp, ROOT, FROZEN_NOW, CORE_FILES };
