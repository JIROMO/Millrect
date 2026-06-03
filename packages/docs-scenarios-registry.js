"use strict";

/**
 * ドキュメント用シナリオ ID 一覧（MCP / capture スクリプト共用メタデータ）
 */
const DOCS_SCENARIO_CATALOG = {
  startup: {
    description: "起動ダイアログと新規作成フォーム / プロジェクト一覧",
    tags: ["startup", "ui"],
    screenshots: [
      "startup-dialog.png",
      "startup-new-form.png",
      "startup-project-list.png",
    ],
  },
  mounting_plate_basic: {
    description: "120×80×50 mm 穴付きパネル（図面+多ビュー3D+STL）",
    tags: ["atlas", "drawing", "multiview", "3d", "holes"],
    screenshots: [
      "main-window.png",
      "drawing-features.png",
      "pages-add-view.png",
      "taste-brief-panel.png",
      "multiview-top-drawing.png",
      "pages-multiview.png",
      "multiview-front-drawing.png",
      "3d-panel.png",
      "toolbar.png",
    ],
  },
  workspace_orientation: {
    description: "ツール、ページ、レイヤー、履歴、3D プレビューの UI 標本",
    tags: ["atlas", "ui", "panels"],
    screenshots: [
      "main-window.png",
      "tools-panel.png",
      "design-panel.png",
      "layers-panel.png",
      "history-panel.png",
      "editing-multiselect.png",
      "help-shortcuts.png",
      "pages-multiview.png",
      "taste-brief-panel.png",
    ],
  },
  annotation_plate: {
    description: "テキスト注記、フォント、折り返し、アウトライン化の作例",
    tags: ["atlas", "text", "annotation"],
    screenshots: ["design-panel-text.png", "drawing-text.png"],
  },
  sketch_trace_plate: {
    description: "参照画像 + スケール校正 + ゴースト確認の作例",
    tags: ["atlas", "sketch", "reference", "ghost"],
    screenshots: ["sketch-digitize.png", "reference-image-panel.png"],
  },
  module_joint_1: {
    description: "実プロダクト Module Joint 1（24×100 mm、板厚 2 mm）",
    tags: ["atlas", "real-product", "drawing", "module"],
    screenshots: ["module-joint-1-millrect.png"],
  },
  multiview_box_3view: {
    description: "互換 alias: mounting_plate_basic",
    aliasOf: "mounting_plate_basic",
    tags: ["multiview", "3d"],
  },
  drawing_rect: {
    description: "上面矩形のみ（drawing-rect 用）",
    screenshots: ["drawing-rect.png"],
    tags: ["drawing", "top"],
  },
  drawing_features: {
    description: "互換 alias: mounting_plate_basic",
    aliasOf: "mounting_plate_basic",
    tags: ["drawing", "dimension"],
  },
  editing_demo: {
    description: "互換 alias: workspace_orientation",
    aliasOf: "workspace_orientation",
    tags: ["editing"],
  },
  intent_part_holes: {
    description: "Intent API: 箱 + 上面 2×2 穴 grid",
    tags: ["intent", "3d", "holes"],
  },
  sketch_digitize_demo: {
    description: "互換 alias: sketch_trace_plate",
    aliasOf: "sketch_trace_plate",
    tags: ["sketch", "reference", "ghost"],
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DOCS_SCENARIO_CATALOG };
}

if (typeof window !== "undefined") {
  window.DOCS_SCENARIO_CATALOG = DOCS_SCENARIO_CATALOG;
}
