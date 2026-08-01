// Shared MCP tool metadata — extracted from mcp/server.js (the Electron/stdio MCP server).
//
// This is a plain data module: name / description / action only. It intentionally does NOT
// include zod parameter schemas, because mcp/server.js runs on the MCP SDK's zod v3 line while
// the Cloudflare Workers side (worker/) runs @modelcontextprotocol/server on zod v4. Coupling
// the schema objects across those two major versions would be fragile, so each side builds its
// own zod shape and only the name/description/action triple is shared here to avoid drift in the
// human-facing text.
//
// Excluded from this file (see mcp/server.js for the originals, desktop-only):
//   - capture_screenshot        (Electron capturePage() + fs write)
//   - load_reference_image      (Electron local file-path read)
//   - import_part_dsl_file      (Electron arbitrary local file-path read)
// Excluded from this file (pre-existing, unimplemented Taste-Memory tools — call() targets that
// don't exist anywhere in app/js/, unrelated to this migration):
//   - get_taste_context
//   - update_project_brief
//   - record_decision
//   - set_project_phase
//   - list_global_principles
//   - promote_principle
//   - append_artifact_log
//   - append_session_learnings
//
// Do not edit mcp/server.js from this file or vice versa without keeping both in sync by hand.

export const MCP_TOOL_DEFS = [
  {
    name: "get_project_context",
    description:
      "プロジェクトの状態を確認する。isNew=true なら白紙、false なら作業中。図面操作の前に Resource millrect://docs/agent-manual を読み、続けて本ツールで新規/継続を確認すること。",
    action: "getProjectContext",
  },
  {
    name: "get_state",
    description:
      "現在の Millrect 図面の状態を取得する。ページ情報・シェイプ一覧・スケールが返る。図面を操作する前に必ず呼ぶこと。",
    action: "getState",
  },
  {
    name: "undo",
    description: "最後の操作を元に戻す。canUndo=false なら何もしない。",
    action: "undo",
  },
  {
    name: "redo",
    description: "Undo した操作をやり直す。canRedo=false なら何もしない。",
    action: "redo",
  },
  {
    name: "set_selected_shapes",
    description:
      "指定した ID のシェイプを選択状態にする。boolean演算・グループ化の前に必ず呼ぶこと。空配列を渡すと全選択解除。",
    action: "setSelectedShapes",
  },
  {
    name: "group_shapes",
    description:
      "選択中のシェイプをグループ化する。2個以上選択していること。グループIDが返る。",
    action: "groupShapes",
  },
  {
    name: "ungroup_shapes",
    description:
      "選択中のグループを解除する。グループシェイプを選択した状態で呼ぶこと。",
    action: "ungroupShapes",
  },
  {
    name: "boolean_subtract",
    description:
      "選択中のシェイプで boolean 差分演算を行う。最初に選択したシェイプから残りを差し引く。2個以上選択していること。",
    action: "booleanSubtract",
  },
  {
    name: "boolean_union",
    description:
      "選択中のシェイプで boolean 結合演算を行う（ユニオン）。2個以上選択していること。",
    action: "booleanUnion",
  },
  {
    name: "boolean_intersect",
    description:
      "選択中のシェイプで boolean 交差演算を行う。2個以上選択していること。",
    action: "booleanIntersect",
  },
  {
    name: "boolean_exclude",
    description:
      "選択中のシェイプで boolean 除外演算を行う（XOR）。2個以上選択していること。",
    action: "booleanExclude",
  },
  {
    name: "boolean_flatten",
    description:
      "選択中の図形またはグループを 1 つの path に統合する。1個以上選択していること。",
    action: "booleanFlatten",
  },
  {
    name: "add_constraint",
    description:
      "幾何拘束を追加する。拘束タイプ:\n- horizontal   : line を水平にする\n- vertical     : line を垂直にする\n- parallel     : 2本の line を平行にする\n- equal_length : 2本の line を等長にする\n- fixed        : shape の位置を固定する (params: {x, y})\n- coincident   : 2つの端点を一致させる (params: {point1:\"start\"|\"end\", point2:\"start\"|\"end\"})\n- symmetric    : 2点を軸対称にする (params: {axis:\"x\"|\"y\", value:number})",
    action: "addConstraint",
  },
  {
    name: "remove_constraint",
    description:
      "拘束を削除する。get_constraints で ID を確認してから呼ぶこと。",
    action: "removeConstraint",
  },
  {
    name: "get_constraints",
    description: "現在のページの幾何拘束一覧を取得する。",
    action: "getConstraints",
  },
  {
    name: "update_3d_scene",
    description:
      "全ページの図面から 3D メッシュを再生成する。完了後に meshCount / message を返す。",
    action: "update3DScene",
  },
  {
    name: "get_3d_scene_status",
    description:
      "現在の 3D シーン状態を取得する（meshCount / message）。再生成はしない。",
    action: "get3DSceneStatus",
  },
  {
    name: "validate_3d_readiness",
    description:
      "3D 生成準備状況を構造化して返す。ビュー軸数・各ページの閉輪郭・既知の問題一覧。描画前チェックに使う。",
    action: "validate3DReadiness",
  },
  {
    name: "create_multiview_box",
    description:
      "mm 指定で多ビュー直方体を一括生成する（Intent API）。\n上面+正面を必須生成。views に \"right\" を含めると右側面も追加。\n座標計算不要 — sizeMm のみ指定すれば用紙中央に配置される。",
    action: "createMultiviewBox",
  },
  {
    name: "create_part",
    description:
      "セマンティック Part 生成（Intent API）。現状 kind=\"box\" のみ。\nfeatures 例: hole_grid — 指定ビューの矩形に等ピッチ穴を path 輪郭として追加（3D 貫通穴）。",
    action: "createPart",
  },
  {
    name: "layout_rect_mm",
    description:
      "現在のページに mm 指定の矩形を用紙中央へ配置する（Intent API）。",
    action: "layoutRectOnPageMm",
  },
  {
    name: "list_docs_scenarios",
    description:
      "ドキュメント用シナリオ ID 一覧（run_docs_scenario 用）。ブラウザ上で再現可能なシーンを返す。",
    action: "listDocsScenarios",
  },
  {
    name: "run_docs_scenario",
    description:
      "ドキュメント用シナリオを適用する（Intent API + 既存 docs レイアウト）。\nscenario 例: multiview_box_3view, drawing_rect, drawing_features, editing_demo, intent_part_holes",
    action: "runDocsScenario",
  },
  {
    name: "set_reference_scale_anchor",
    description:
      "参照画像上の 2 点間を既知 mm 長に合わせてスケール（real units 座標）。",
    action: "setReferenceImageScaleAnchor",
  },
  {
    name: "digitize_sketch",
    description:
      "Vision LLM 等から渡された primitive 提案をゴースト図形として配置（mm 第一級）。\nconfirm=true で即確定。Millrect 内に Vision は含まない — 外部が proposals を生成する。",
    action: "applyDigitizeProposals",
  },
  {
    name: "confirm_digitize_proposals",
    description:
      "ゴースト図形を確定（3D 生成対象にする）。shape_ids 省略時はページ上の全ゴースト。",
    action: "confirmDigitizeProposals",
  },
  {
    name: "compile_part_dsl",
    description:
      "Part DSL v1 をコンパイル（dry-run）。state は変更しない。\nSolver + DSL パイプライン: DSL → compile plan → (applyPartDsl で) geometry",
    action: "compilePartDsl",
  },
  {
    name: "apply_part_dsl",
    description: "Part DSL v1 をコンパイルして図面に適用する（create_part の DSL 版）。",
    action: "applyPartDsl",
  },
  {
    name: "update_part_param",
    description:
      "Part のパラメータを mm 指定で更新（part 種別に応じた Solver 差分）。",
    action: "updatePartParam",
  },
  {
    name: "validate_manufacturability",
    description:
      "Part DSL の製造ルール（穴径・ケルフ・端距離等）を検証。state は変更しない。",
    action: "validatePartManufacturability",
  },
  {
    name: "apply_commands",
    description:
      "図面にコマンドをバッチ適用する。複数コマンドをまとめて送れる（1回のUndoで全部戻る）。\nアクション一覧:\n- addShape        : 通常シェイプ（rect/circle/line/text/bezier/path）を追加\n- updateShape     : 既存シェイプを更新\n- deleteShape     : 既存シェイプを削除\n- addDimension    : 寸法線を追加（page.dimensions[] に格納される）\n- updateDimension : 既存寸法線を更新\n- addConstraint   : 幾何拘束を追加 (constraint フィールドに { type, shapeIds, params? })\n- removeConstraint: 拘束を削除 (id フィールドに拘束ID)\n- applyConstraints: 全拘束を即時解く\n- selectShapes    : 選択状態を変更 (ids フィールドに ID 配列)\n- setPagePaper    : ページの用紙・向きを変更\n- setPageScale    : ページのスケールを変更\n- setProjectName  : プロジェクト名を変更\n- addPage         : 新規ページを追加\n\nshape/dimension オブジェクトは必ず id フィールドを含めること（例: \"rect-001\"）。\n\n配置（placement）: 追加した図形バッチは既定で自動配置される（auto）。\n- auto   : ページが空なら用紙中央へ。既存図形と重なる・遠く離れている場合は空きスペースへ再配置。\n           バッチ全体が既存図形の内側に完全に収まる（穴あけ・ブーリアン用の重ね）、\n           または既存図形から 20mm 以内に隣接する（接続線・注記）場合は動かさない。\n- center : 常に用紙中央へ。\n- none   : 座標をそのまま使う。厳密な絶対座標配置をしたいときに指定する。\n新しい部品を描くときは座標を原点 (0,0) 起点で相対的に書けばよい（自動配置が用紙上の位置を決める）。",
    action: "applyCommands",
  },
  {
    name: "clear_canvas",
    description: "現在のページのシェイプをすべて削除してキャンバスをクリアする。",
    action: "clearCanvas",
  },
  {
    name: "get_svg",
    description: "現在のページを SVG 文字列として取得する。確認・参照用途に使う。",
    action: "getSvg",
  },
  {
    name: "align_shapes",
    description:
      "選択中のシェイプを整列する。1個選択時はページ基準、複数選択時は選択範囲基準。",
    action: "alignShapes",
  },
  {
    name: "distribute_shapes",
    description: "選択中のシェイプを均等分布する（3個以上必要）。",
    action: "distributeShapes",
  },
];
