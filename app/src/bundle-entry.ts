"use strict";

// アプリバンドルのエントリ（ADR 0002 フェーズ 2）。
// 対象 package の .ts を副作用 import する。esbuild が直接コンパイルするため
// build:ts の生成 .js には依存しない。
//
// import 順は旧 app/index.html の <script> タグ順を維持する（ロード時副作用の
// 相対順序を変えない）。各 package は末尾の Object.assign(window, ...) または
// UMD 自己代入（root.MillrectSchema 等）で script タグ時代と同じ global 面を
// 明示的に再現する。
//
// ここに import を足したら、app/index.html から対応する <script> タグを
// 同一コミットで除去すること（グローバル二重定義を避ける）。

// ── 旧 <head> 位置（schema ファミリ）─────────────────────────────
import "../../packages/schema/index.ts";
import "../../packages/model-generator/index.ts";
import "../../packages/geometry-core/index.ts";

// ── 旧 <body> 位置（タグ順）──────────────────────────────────────
import "../../packages/sample-catalog.ts";
import "../../packages/multiview-starter-box.ts";
import "../../packages/docs-box-scenario.ts";
import "../../packages/module-joint-1-scenario.ts";
import "../../packages/agent-intent.ts";
import "../../packages/digitize-sketch.ts";
import "../../packages/part-geometry.ts";
import "../../packages/manufacturing-rules.ts";
import "../../packages/part-dsl.ts";
import "../../packages/part-solver.ts";
import "../../packages/project-json.ts";
import "../../packages/taste-memory.ts";
import "../../packages/taste-memory-promotion.ts";
import "../../packages/builtin-fonts.ts";
import "../../packages/google-fonts.ts";
import "../../packages/fontsource-api.ts";
import "../../packages/docs-scenarios-registry.ts";
import "../../packages/text-contour-grouping.ts";
import "../../packages/help-index.ts";
import "../../packages/model-viewer/index.ts";
