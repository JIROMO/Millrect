"use strict";

// アプリ本体バンドルのエントリ（ADR 0002 フェーズ 3）。
// 旧 <body> の <script> タグ位置（svg.min.js の直後）で実行される第 2 バンドル。
// packages バンドル（head）とは別に、app/js を旧タグ順で段階的に取り込む。
//
// 実行タイミング互換: バンドルタグは旧 i18n.js の位置に置くため、
// customElements.define 時には #app の要素が DOM に存在し（旧来どおり即
// upgrade）、connectedCallback 時点で i18n / locales は定義済み。
//
// ここに import を足したら、app/index.html から対応する <script> タグを
// 同一コミットで除去すること。

import "../js/i18n.ts";
import "../js/locales/ja.ts";
import "../js/locales/en.ts";
import "../js/components/millrect-toolbar.ts";
import "../js/components/millrect-left-sidebar.ts";
import "../js/components/millrect-canvas.ts";
import "../js/components/millrect-right-sidebar.ts";
import "../js/components/millrect-3d-panel.ts";
import "../js/db.ts";
import "../js/state.ts";
import "../js/font-library.ts";
import "../js/project-fonts.ts";
import "../js/font-browser.ts";
import "../js/transform.ts";
import "../js/profiles.ts";
import "../js/constraints.ts";
import "../js/renderer.ts";
import "../js/commands.ts";
import "../js/export.ts";
import "../js/interaction.ts";
import "../js/text-outline.ts";
import "../js/multiview-template.ts";
import "../js/part-builders.ts";
import "../js/docs-viewer.ts";
import "../js/help-search.ts";
import "../js/panel-sections.ts";
import "../js/ui.ts";
import "../js/path-editor.ts";
import "../js/3d-view.ts";
import "../js/agent-api.ts";
import "../js/taste-memory-api.ts";
import "../js/part-compiler.ts";
import "../js/sample-projects.ts";
import "../js/reference-image.ts";
import "../js/digitize-sketch.ts";
import "../js/docs-api.ts";
import "../js/autosave.ts";
import "../js/app-mode.ts";
