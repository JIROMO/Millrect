"use strict";

// アプリバンドルのエントリ（ADR 0002 フェーズ 1）。
// 対象 package の .ts を副作用 import する。esbuild が直接コンパイルするため
// build:ts の生成 .js には依存しない。
//
// - schema / model-generator / geometry-core は UMD 自己代入
//   （root.MillrectSchema 等）で global 面を自前で再現する。
// - project-json は末尾の Object.assign(window, ...) ブロックで公開する。
//
// ここに import を足したら、app/index.html から対応する <script> タグを
// 同一コミットで除去すること（グローバル二重定義を避ける）。

import "../../packages/schema/index.ts";
import "../../packages/model-generator/index.ts";
import "../../packages/geometry-core/index.ts";
import "../../packages/project-json.ts";
