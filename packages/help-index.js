"use strict";

/** @typedef {{ title: string, section: string, page: string, anchor?: string, keywords: string[], summary: string }} HelpEntry */

/** @type {HelpEntry[]} */
var HELP_INDEX = [
  {
    title: "デスクトップ版",
    section: "ガイド",
    page: "desktop-download.html",
    keywords: [
      "ダウンロード",
      "インストール",
      "DMG",
      "Windows",
      "デスクトップ",
      "Electron",
    ],
    summary: "デスクトップ版のダウンロードと未署名配布時の起動方法",
  },
  {
    title: "はじめに",
    section: "ガイド",
    page: "getting-started.html",
    keywords: ["起動", "新規", "プロジェクト", "初めて", "スタート"],
    summary: "アプリの起動と最初のプロジェクト作成",
  },
  {
    title: "できること",
    section: "ガイド",
    page: "index.html",
    anchor: "capabilities",
    keywords: [
      "できること",
      "機能",
      "2D",
      "3D",
      "STL",
      "Part DSL",
      "Taste Memory",
    ],
    summary: "作図、3D、スケッチ取り込み、AI 連携、Taste Memory の全体像",
  },
  {
    title: "設計標本帳",
    section: "ガイド",
    page: "atlas.html",
    keywords: [
      "標本帳",
      "作例",
      "カタログ",
      "設計図",
      "Live Specimen",
      "Part DSL",
    ],
    summary: "作例から図面・3D・AI/MCP・Part DSL の入口をたどる",
  },
  {
    title: "Live Specimen",
    section: "設計標本帳",
    page: "atlas.html",
    anchor: "live-specimen",
    keywords: ["ライブ", "パラメータ", "寸法", "穴", "DSL", "インタラクティブ"],
    summary:
      "寸法を変えると 2D 図面・寸法アイソメ図・Part DSL が更新される作例",
  },
  {
    title: "画像運用",
    section: "設計標本帳",
    page: "atlas.html",
    anchor: "image-system",
    keywords: ["スクリーンショット", "画像", "キャプチャ", "scenario", "保守"],
    summary: "Showcase / Scenario capture / UI proof に分けて画像を管理",
  },
  {
    title: "設計思想",
    section: "ガイド",
    page: "philosophy.html",
    keywords: ["思想", "設計思想", "図面", "3D", "AI", "MCP", "出力"],
    summary: "図面を本体にして 3D・AI・出力を補助として扱う考え方",
  },
  {
    title: "図面が本体",
    section: "設計思想",
    page: "philosophy.html",
    anchor: "drawing-first",
    keywords: ["図面", "2D", "本体", "正投影図", "寸法"],
    summary: "編集の中心を 2D 図面に置く理由",
  },
  {
    title: "AI は補助者",
    section: "設計思想",
    page: "philosophy.html",
    anchor: "ai-assist",
    keywords: ["AI", "MCP", "補助", "自動化", "確認"],
    summary: "AI 連携を作図の補助線として扱う考え方",
  },
  {
    title: "アプリの起動",
    section: "はじめに",
    page: "getting-started.html",
    anchor: "launch",
    keywords: ["起動", "インストール", "開く"],
    summary: "Millrect の起動方法と起動ダイアログ",
  },
  {
    title: "新規プロジェクト",
    section: "はじめに",
    page: "getting-started.html",
    anchor: "new-project",
    keywords: ["新規", "作成", "プロジェクト", "用紙", "A4"],
    summary: "プロジェクト名・用紙サイズを設定して作成",
  },
  {
    title: "3D を試す",
    section: "はじめに",
    page: "getting-started.html",
    anchor: "sample-3d",
    keywords: ["3D", "ページ追加", "上面", "正面", "JSON", "サンプル"],
    summary: "面の向きを選んでページを追加し、3D プレビューへ切り替える",
  },
  {
    title: "最初の図形を描く",
    section: "はじめに",
    page: "getting-started.html",
    anchor: "first-shape",
    keywords: ["描く", "矩形", "最初", "図形"],
    summary: "ツールを選んでキャンバスに図形を配置",
  },
  {
    title: "画面構成",
    section: "ガイド",
    page: "interface.html",
    keywords: ["UI", "レイアウト", "パネル", "画面"],
    summary: "ツールバー・キャンバス・右パネルの見方",
  },
  {
    title: "ツールバー（上部）",
    section: "画面構成",
    page: "interface.html",
    anchor: "toolbar",
    keywords: ["ツールバー", "保存", "出力", "Undo"],
    summary: "上部バーのファイル操作と 3D プレビュー",
  },
  {
    title: "ツールパレット（左）",
    section: "画面構成",
    page: "interface.html",
    anchor: "tools",
    keywords: ["ツール", "パレット", "描画", "選択"],
    summary: "左側の描画ツール一覧",
  },
  {
    title: "キャンバス（中央）",
    section: "画面構成",
    page: "interface.html",
    anchor: "canvas",
    keywords: ["キャンバス", "ズーム", "パン", "用紙"],
    summary: "図面を描くメインエリアとズーム操作",
  },
  {
    title: "右パネル",
    section: "画面構成",
    page: "interface.html",
    anchor: "right-panel",
    keywords: [
      "レイヤー",
      "ページ",
      "Design",
      "History",
      "フォント",
      "Google Fonts",
      "制作メモ",
    ],
    summary:
      "レイヤー・ページ・プロパティ・履歴タブ。Pages 内に参照画像、フォント、制作メモ",
  },
  {
    title: "プロジェクトフォント（右パネル）",
    section: "画面構成",
    page: "interface.html",
    anchor: "project-fonts-panel",
    keywords: ["フォント", "Google Fonts", "Fontsource", "ライブラリ", "Pages"],
    summary:
      "Pages タブ内 — フォントを探す / ライブラリ / プロジェクトへの追加",
  },
  {
    title: "制作メモ（Pages タブ）",
    section: "画面構成",
    page: "interface.html",
    anchor: "taste-brief-panel",
    keywords: [
      "制作メモ",
      "Taste brief",
      "Taste Memory",
      "projectBrief",
      "方針",
      "AI",
    ],
    summary:
      "Pages タブ内 — projectBrief の意図・フェーズ・設計原則・判断履歴を確認",
  },
  {
    title: "3D プレビューパネル",
    section: "画面構成",
    page: "interface.html",
    anchor: "3d-panel",
    keywords: ["3D", "プレビュー", "立体", "STL"],
    summary: "3D モデルの確認と STL 書き出し",
  },
  {
    title: "2D 描画",
    section: "ガイド",
    page: "drawing.html",
    keywords: ["描画", "2D", "図形", "ツール", "画像"],
    summary: "矩形・円・線・ベジェ・テキスト・寸法・キャンバス画像",
  },
  {
    title: "矩形 (R)",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "rect",
    keywords: ["矩形", "四角", "R", "rect", "長方形"],
    summary: "ドラッグで矩形を描く",
  },
  {
    title: "円 (C)",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "circle",
    keywords: ["円", "C", "circle", "丸"],
    summary: "中心から半径を指定して円を描く",
  },
  {
    title: "線 (L)",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "line",
    keywords: ["線", "直線", "L", "line"],
    summary: "2 点を指定して直線を描く",
  },
  {
    title: "ペン（ベジェ）",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "bezier",
    keywords: ["ベジェ", "ペン", "曲線", "パス", "bezier"],
    summary: "ベジェ曲線で自由な輪郭を描く",
  },
  {
    title: "テキスト (T)",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "text",
    keywords: [
      "テキスト",
      "文字",
      "T",
      "ラベル",
      "フォント",
      "行間",
      "Gen Interface JP",
    ],
    summary:
      "図面上に文字を配置。同梱フォントとプロジェクト登録フォントから選択",
  },
  {
    title: "プロジェクトフォント（Google Fonts）",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "project-fonts",
    keywords: [
      "フォント",
      "Google Fonts",
      "Fontsource",
      "ライブラリ",
      "Roboto",
      "日本語",
      "Bold",
      "ウェイト",
      "cssUrl",
    ],
    summary:
      "Fontsource から Google Fonts を検索登録。ライブラリでプロジェクト横断再利用（PC フォントではない）",
  },
  {
    title: "テキストのアウトライン化",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "text-outline",
    keywords: [
      "アウトライン",
      "outline",
      "テキスト",
      "文字",
      "path",
      "3D",
      "刻印",
    ],
    summary: "テキストを path 図形に変換して 3D 輪郭に使う（Electron 版）",
  },
  {
    title: "テキストのアウトライン化",
    section: "編集操作",
    page: "editing.html",
    anchor: "text-outline",
    keywords: [
      "アウトライン",
      "outline",
      "テキスト",
      "グループ",
      "path",
      "Electron",
    ],
    summary: "Design タブまたは右クリックからテキストを path に変換",
  },
  {
    title: "寸法線 (D)",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "dimensions",
    keywords: ["寸法", "D", "dimension", "サイズ", "長さ"],
    summary: "2 点間の距離を寸法線で表示",
  },
  {
    title: "キャンバス画像",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "canvas-images",
    keywords: ["画像", "写真", "PNG", "JPEG", "WebP", "SVG", "圧縮", "容量"],
    summary: "画像を通常オブジェクトとして配置し、移動・リサイズ・出力",
  },
  {
    title: "ページとレイヤー",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "layers",
    keywords: ["レイヤー", "ページ", "上面", "正面", "多ページ"],
    summary: "複数ページ・レイヤーでの図面管理",
  },
  {
    title: "スケッチ取り込み",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "sketch-import",
    keywords: [
      "スケッチ",
      "参照画像",
      "下絵",
      "位置",
      "サイズ",
      "適用",
      "スケール校正",
      "ゴースト",
      "digitize",
      "写真",
    ],
    summary: "参照画像・位置サイズ編集・スケール校正・ゴースト確定",
  },
  {
    title: "参照画像の位置・サイズ",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "sketch-transform",
    keywords: [
      "参照画像",
      "位置",
      "サイズ",
      "編集",
      "適用",
      "移動",
      "リサイズ",
      "下絵",
    ],
    summary: "位置・サイズを編集（再クリックで終了）",
  },
  {
    title: "参照画像パネル",
    section: "画面構成",
    page: "interface.html",
    anchor: "reference-image-panel",
    keywords: [
      "参照画像",
      "Pages",
      "下絵",
      "位置",
      "サイズ",
      "適用",
      "不透明度",
      "スケール校正",
    ],
    summary: "Pages タブの参照画像 UI（編集トグル・スケール校正）",
  },
  {
    title: "スケッチ digitize",
    section: "AI 連携",
    page: "ai-mcp.html",
    anchor: "sketch-digitize",
    keywords: [
      "digitize",
      "ゴースト",
      "Vision",
      "load_reference_image",
      "スケッチ",
    ],
    summary: "MCP 経由のスケッチ取り込みとゴースト確定",
  },
  {
    title: "スナップ（吸着）",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "snap",
    keywords: ["スナップ", "吸着", "グリッド", "端点", "中点"],
    summary: "端点・交点・グリッドへの自動吸着",
  },
  {
    title: "回転・反転について",
    section: "2D 描画",
    page: "drawing.html",
    anchor: "transform",
    keywords: ["回転", "反転", "flip", "rotation"],
    summary: "回転・反転は表示、整列、Profile、3D 生成に反映",
  },
  {
    title: "編集操作",
    section: "ガイド",
    page: "editing.html",
    keywords: ["編集", "選択", "移動", "整列"],
    summary: "選択・プロパティ・整列・グループ・Boolean",
  },
  {
    title: "選択と移動",
    section: "編集操作",
    page: "editing.html",
    anchor: "select",
    keywords: ["選択", "移動", "V", "select", "ドラッグ"],
    summary: "図形の選択・複数選択・移動",
  },
  {
    title: "Design タブ（プロパティ）",
    section: "編集操作",
    page: "editing.html",
    anchor: "design",
    keywords: ["Design", "プロパティ", "数値", "座標"],
    summary: "右パネルで図形の数値を直接編集",
  },
  {
    title: "外観（塗り・線色）",
    section: "編集操作",
    page: "editing.html",
    anchor: "appearance",
    keywords: ["色", "塗り", "線色", "fill", "stroke", "外観"],
    summary: "図形の塗りつぶし色と線の色を変更",
  },
  {
    title: "整列・均等配置",
    section: "編集操作",
    page: "editing.html",
    anchor: "align",
    keywords: ["整列", "align", "均等", "distribute", "左揃え"],
    summary: "複数図形の整列と等間隔配置",
  },
  {
    title: "グループ化",
    section: "編集操作",
    page: "editing.html",
    anchor: "group",
    keywords: ["グループ", "group", "⌘G", "まとめる"],
    summary: "複数図形を 1 つのグループにまとめる",
  },
  {
    title: "合成・くり抜き（Boolean）",
    section: "編集操作",
    page: "editing.html",
    anchor: "boolean",
    keywords: [
      "Boolean",
      "合成",
      "結合",
      "くり抜き",
      "減算",
      "union",
      "subtract",
    ],
    summary: "パスの結合・減算・交差・除外・統合",
  },
  {
    title: "Undo / Redo と History",
    section: "編集操作",
    page: "editing.html",
    anchor: "history",
    keywords: ["Undo", "Redo", "元に戻す", "履歴", "History"],
    summary: "操作の取り消しと履歴パネル",
  },
  {
    title: "3D 生成",
    section: "ガイド",
    page: "multiview-3d.html",
    keywords: ["3D", "立体", "CSG", "多ビュー", "投影"],
    summary: "上面図・正面図から立体を生成",
  },
  {
    title: "3D の仕組み",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "how-it-works",
    keywords: ["仕組み", "交差", "CSG", "正投影"],
    summary: "2 軸以上の正投影図を CSG 交差して立体化",
  },
  {
    title: "面の向きを選んでページ追加",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "view-type",
    keywords: [
      "上面",
      "正面",
      "側面",
      "viewDefinition",
      "ビュー",
      "ページ追加",
    ],
    summary: "上面・正面・側面などのページを追加する",
  },
  {
    title: "直方体を作る例",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "example",
    keywords: ["直方体", "箱", "例", "チュートリアル"],
    summary: "上面図 + 正面図で直方体を作る手順",
  },
  {
    title: "3D への色の反映",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "color",
    keywords: ["色", "3D", "塗り", "カラー"],
    summary: "図形の塗り色が 3D メッシュに反映される",
  },
  {
    title: "3D がうまくいかないとき",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "tips",
    keywords: ["トラブル", "エラー", "メッシュ", "失敗"],
    summary: "立体が生成されない場合のチェックポイント",
  },
  {
    title: "穴やくり抜き（3D）",
    section: "3D 生成",
    page: "multiview-3d.html",
    anchor: "holes",
    keywords: ["穴", "ホール", "くり抜き", "内側"],
    summary: "輪郭の内側に穴を作る方法",
  },
  {
    title: "保存と出力",
    section: "ガイド",
    page: "export.html",
    keywords: ["保存", "出力", "エクスポート", "書き出し"],
    summary: "JSON・SVG・PDF・STL の保存と出力",
  },
  {
    title: "自動保存",
    section: "保存と出力",
    page: "export.html",
    anchor: "autosave",
    keywords: ["自動保存", "autosave", "復元"],
    summary: "作業内容の自動保存と再開",
  },
  {
    title: "プロジェクトファイル（JSON）",
    section: "保存と出力",
    page: "export.html",
    anchor: "project-file",
    keywords: ["JSON", "保存", "読み込み", "プロジェクト"],
    summary: "プロジェクト全体を JSON で保存・読み込み",
  },
  {
    title: "SVG 出力・インポート",
    section: "保存と出力",
    page: "export.html",
    anchor: "svg",
    keywords: ["SVG", "インポート", "出力"],
    summary: "SVG 形式での入出力",
  },
  {
    title: "PDF 出力",
    section: "保存と出力",
    page: "export.html",
    anchor: "pdf",
    keywords: ["PDF", "印刷", "出力"],
    summary: "全ページを PDF として書き出し",
  },
  {
    title: "STL 出力",
    section: "保存と出力",
    page: "export.html",
    anchor: "stl",
    keywords: ["STL", "3Dプリント", "書き出し"],
    summary: "3D モデルを STL ファイルにエクスポート",
  },
  {
    title: "キーボードショートカット",
    section: "ガイド",
    page: "shortcuts.html",
    keywords: ["ショートカット", "キーボード", "⌘", "Ctrl"],
    summary: "ツール切替・編集・表示のキー一覧",
  },
  {
    title: "ツール切替ショートカット",
    section: "ショートカット",
    page: "shortcuts.html",
    anchor: "tools",
    keywords: ["V", "R", "C", "L", "T", "D", "H", "ツール"],
    summary: "V=選択, R=矩形, C=円, L=線, T=テキスト, D=寸法",
  },
  {
    title: "編集ショートカット",
    section: "ショートカット",
    page: "shortcuts.html",
    anchor: "edit",
    keywords: ["Undo", "Redo", "コピー", "削除", "グループ"],
    summary: "⌘Z, ⌘C, Del, ⌘G など",
  },
  {
    title: "表示・ナビゲーション",
    section: "ショートカット",
    page: "shortcuts.html",
    anchor: "view",
    keywords: ["ズーム", "パン", "Space", "Esc"],
    summary: "ズーム・パン・選択解除",
  },
  {
    title: "AI 連携（MCP）",
    section: "ガイド",
    page: "ai-mcp.html",
    keywords: ["AI", "MCP", "Claude", "自動操作"],
    summary: "Claude Desktop などから Millrect を操作",
  },
  {
    title: "MCP 設定",
    section: "AI 連携",
    page: "ai-mcp.html",
    anchor: "mcp-setup",
    keywords: [
      "MCP",
      "Claude",
      "設定",
      "server.js",
      "Node",
      "claude_desktop_config",
    ],
    summary: "Claude Desktop 向け MCP サーバー設定例",
  },
  {
    title: "AI に頼みやすい作業単位",
    section: "AI 連携",
    page: "ai-mcp.html",
    anchor: "part-dsl-workflow",
    keywords: [
      "Intent API",
      "Part DSL",
      "validate_manufacturability",
      "部品",
      "mm",
    ],
    summary: "状況確認、Intent API、Part DSL、製造チェック、レビューの流れ",
  },
  {
    title: "Taste Memory",
    section: "AI 連携",
    page: "ai-mcp.html",
    anchor: "taste-memory",
    keywords: [
      "Taste Memory",
      "projectBrief",
      "好み",
      "判断",
      "record_decision",
      "artifactLog",
    ],
    summary: "意図・制約・好み・採否理由・レビュー履歴を記録",
  },
  {
    title: "開発者ガイド",
    section: "開発者向け",
    page: "developer.html",
    keywords: [
      "開発",
      "API",
      "アーキテクチャ",
      "リポジトリ",
      "スキーマ",
      "MCP",
      "Electron",
    ],
    summary: "リポジトリ構成・データモデル・グローバル API・MCP リファレンス",
  },
  {
    title: "プロジェクト構成",
    section: "開発者向け",
    page: "developer.html",
    anchor: "project-layout",
    keywords: ["ディレクトリ", "フォルダ", "app", "shared", "mcp"],
    summary: "millrect/ 以下のディレクトリと主要ファイル",
  },
  {
    title: "MCP ツール一覧",
    section: "開発者向け",
    page: "developer.html",
    anchor: "mcp-tools",
    keywords: [
      "get_project_context",
      "apply_commands",
      "apply_part_dsl",
      "snake_case",
    ],
    summary: "MCP ツールと apply_commands アクションのリファレンス",
  },
];

/** @type {Record<string, Omit<HelpEntry, "page" | "anchor">>} */
var HELP_INDEX_EN = {
  "desktop-download.html": {
    title: "Desktop app",
    section: "Guide",
    keywords: [
      "download",
      "install",
      "DMG",
      "Windows",
      "desktop",
      "Electron",
      "unsigned",
    ],
    summary: "Download the desktop app and open unsigned builds",
  },
  "getting-started.html": {
    title: "Getting started",
    section: "Guide",
    keywords: ["launch", "new", "project", "first", "start", "tutorial"],
    summary: "Launch the app and create your first project",
  },
  "index.html#capabilities": {
    title: "What Millrect can do",
    section: "Guide",
    keywords: [
      "capabilities",
      "features",
      "2D",
      "3D",
      "STL",
      "Part DSL",
      "Taste Memory",
    ],
    summary:
      "Overview of drawing, 3D, sketch import, AI integration, and Taste Memory",
  },
  "atlas.html": {
    title: "Design Atlas",
    section: "Guide",
    keywords: [
      "atlas",
      "specimen",
      "catalogue",
      "example",
      "Live Specimen",
      "Part DSL",
    ],
    summary:
      "Explore drawings, 3D, AI/MCP, and Part DSL from reusable design specimens",
  },
  "atlas.html#live-specimen": {
    title: "Live Specimen",
    section: "Design Atlas",
    keywords: ["live", "parameter", "dimension", "hole", "DSL", "interactive"],
    summary:
      "Change dimensions and update the 2D drawing, dimensioned isometric, and Part DSL together",
  },
  "atlas.html#image-system": {
    title: "Image system",
    section: "Design Atlas",
    keywords: ["screenshot", "image", "capture", "scenario", "maintenance"],
    summary:
      "Manage screenshots as Showcase, Scenario capture, and UI proof images",
  },
  "philosophy.html": {
    title: "Philosophy",
    section: "Guide",
    keywords: ["philosophy", "drawing", "3D", "AI", "MCP", "export"],
    summary:
      "Why Millrect treats drawings as primary and 3D, AI, and export as supporting layers",
  },
  "philosophy.html#drawing-first": {
    title: "Drawings come first",
    section: "Philosophy",
    keywords: ["drawing", "2D", "source", "orthographic", "dimension"],
    summary: "Why the editable source remains the 2D drawing",
  },
  "philosophy.html#ai-assist": {
    title: "AI assists rather than takes over",
    section: "Philosophy",
    keywords: ["AI", "MCP", "assistant", "automation", "confirm"],
    summary: "How AI integration supports drawing without replacing it",
  },
  "getting-started.html#launch": {
    title: "Launching the app",
    section: "Getting started",
    keywords: ["launch", "install", "open", "startup"],
    summary: "How to launch Millrect and the startup dialog",
  },
  "getting-started.html#new-project": {
    title: "New project",
    section: "Getting started",
    keywords: ["new", "create", "project", "paper", "A4", "document"],
    summary: "Set project name and paper size",
  },
  "getting-started.html#sample-3d": {
    title: "Try 3D",
    section: "Getting started",
    keywords: ["sample", "3D", "add page", "top", "front", "JSON"],
    summary: "Add face-direction pages and switch to 3D preview",
  },
  "getting-started.html#first-shape": {
    title: "Draw your first shape",
    section: "Getting started",
    keywords: ["draw", "rectangle", "first", "shape", "tool"],
    summary: "Pick a tool and place a shape on the canvas",
  },
  "interface.html": {
    title: "Interface",
    section: "Guide",
    keywords: ["UI", "layout", "panel", "screen", "workspace"],
    summary: "Toolbar, canvas, and right panel overview",
  },
  "interface.html#toolbar": {
    title: "Toolbar (top)",
    section: "Interface",
    keywords: ["toolbar", "save", "export", "undo", "file"],
    summary: "File actions and 3D preview on the top bar",
  },
  "interface.html#tools": {
    title: "Tool palette (left)",
    section: "Interface",
    keywords: ["tool", "palette", "draw", "select", "tools"],
    summary: "Drawing tools on the left",
  },
  "interface.html#canvas": {
    title: "Canvas (center)",
    section: "Interface",
    keywords: ["canvas", "zoom", "pan", "paper", "drawing"],
    summary: "Main drawing area and zoom/pan",
  },
  "interface.html#right-panel": {
    title: "Right panel",
    section: "Interface",
    keywords: [
      "layer",
      "page",
      "Design",
      "History",
      "font",
      "Google Fonts",
      "Taste brief",
      "sidebar",
    ],
    summary:
      "Layers, pages, properties, history, reference images, project fonts, and Taste brief",
  },
  "interface.html#project-fonts-panel": {
    title: "Project fonts (right panel)",
    section: "Interface",
    keywords: ["font", "Google Fonts", "Fontsource", "library", "Pages"],
    summary: "Browse fonts, library, and add fonts to the project",
  },
  "interface.html#taste-brief-panel": {
    title: "Taste brief (Pages tab)",
    section: "Interface",
    keywords: [
      "Taste brief",
      "Taste Memory",
      "projectBrief",
      "intent",
      "principles",
      "AI",
    ],
    summary:
      "Pages tab — inspect projectBrief intent, phase, design principles, and decisions",
  },
  "interface.html#reference-image-panel": {
    title: "Reference image panel",
    section: "Interface",
    keywords: ["reference", "sketch", "underlay", "Pages", "scale"],
    summary: "Sketch underlay and scale calibration UI",
  },
  "interface.html#3d-panel": {
    title: "3D preview panel",
    section: "Interface",
    keywords: ["3D", "preview", "mesh", "solid", "STL"],
    summary: "Review the 3D model and export STL",
  },
  "drawing.html": {
    title: "2D drawing",
    section: "Guide",
    keywords: ["draw", "2D", "shape", "tool", "sketch", "image"],
    summary: "Rectangle, circle, line, bezier, text, dimensions, canvas images",
  },
  "drawing.html#rect": {
    title: "Rectangle (R)",
    section: "2D drawing",
    keywords: ["rectangle", "rect", "R", "box", "square"],
    summary: "Drag to draw a rectangle",
  },
  "drawing.html#circle": {
    title: "Circle (C)",
    section: "2D drawing",
    keywords: ["circle", "C", "round", "radius"],
    summary: "Draw a circle from center and radius",
  },
  "drawing.html#line": {
    title: "Line (L)",
    section: "2D drawing",
    keywords: ["line", "L", "segment", "straight"],
    summary: "Draw a line between two points",
  },
  "drawing.html#bezier": {
    title: "Pen (Bezier)",
    section: "2D drawing",
    keywords: ["bezier", "pen", "curve", "path", "spline"],
    summary: "Draw freeform outlines with Bezier curves",
  },
  "drawing.html#text": {
    title: "Text (T)",
    section: "2D drawing",
    keywords: ["text", "label", "T", "font", "line height", "Gen Interface JP"],
    summary: "Place text using bundled and project fonts",
  },
  "drawing.html#project-fonts": {
    title: "Project fonts (Google Fonts)",
    section: "2D drawing",
    keywords: [
      "font",
      "Google Fonts",
      "Fontsource",
      "library",
      "Roboto",
      "Bold",
      "weight",
      "cssUrl",
    ],
    summary: "Search Fontsource, reuse library fonts across projects",
  },
  "drawing.html#text-outline": {
    title: "Convert text to outlines",
    section: "2D drawing",
    keywords: ["outline", "text", "path", "3D", "engrave", "convert"],
    summary: "Turn text into path shapes for 3D profiles (Electron)",
  },
  "editing.html#text-outline": {
    title: "Convert text to outlines",
    section: "Editing",
    keywords: ["outline", "text", "group", "path", "Electron", "convert"],
    summary: "Convert text from the Design tab or context menu",
  },
  "drawing.html#dimensions": {
    title: "Dimensions (D)",
    section: "2D drawing",
    keywords: ["dimension", "D", "size", "length", "measure"],
    summary: "Show distance between two points",
  },
  "drawing.html#canvas-images": {
    title: "Canvas images",
    section: "2D drawing",
    keywords: [
      "image",
      "photo",
      "PNG",
      "JPEG",
      "WebP",
      "SVG",
      "compress",
      "storage",
    ],
    summary:
      "Place images as normal objects; move, resize, save, and export them",
  },
  "drawing.html#layers": {
    title: "Pages and layers",
    section: "2D drawing",
    keywords: ["layer", "page", "top", "front", "multipage", "views"],
    summary: "Manage drawings across pages and layers",
  },
  "drawing.html#sketch-import": {
    title: "Sketch import",
    section: "2D drawing",
    keywords: [
      "sketch",
      "reference image",
      "underlay",
      "move",
      "resize",
      "apply",
      "scale",
      "calibrate",
      "ghost",
      "digitize",
      "photo",
    ],
    summary:
      "Reference underlay, move/resize, scale calibration, ghost confirm",
  },
  "drawing.html#sketch-transform": {
    title: "Move and resize reference image",
    section: "2D drawing",
    keywords: [
      "reference image",
      "move",
      "resize",
      "apply",
      "underlay",
      "edit",
    ],
    summary: "Move & resize — click again to exit edit mode",
  },
  "interface.html#reference-image-panel": {
    title: "Reference image panel",
    section: "Interface",
    keywords: [
      "reference image",
      "Pages",
      "underlay",
      "move",
      "resize",
      "apply",
      "opacity",
      "calibrate",
    ],
    summary: "Reference image panel (edit toggle, scale calibration)",
  },
  "ai-mcp.html#sketch-digitize": {
    title: "Sketch digitize",
    section: "AI integration",
    keywords: ["digitize", "ghost", "Vision", "load_reference_image", "sketch"],
    summary: "MCP sketch import and ghost confirmation",
  },
  "drawing.html#snap": {
    title: "Snap",
    section: "2D drawing",
    keywords: ["snap", "grid", "endpoint", "midpoint", "magnet"],
    summary: "Snap to endpoints, intersections, and grid",
  },
  "drawing.html#transform": {
    title: "Rotation and flip",
    section: "2D drawing",
    keywords: ["rotate", "flip", "rotation", "mirror", "transform"],
    summary:
      "Rotation and flip are reflected in display, alignment, Profile, and 3D",
  },
  "editing.html": {
    title: "Editing",
    section: "Guide",
    keywords: ["edit", "select", "move", "align", "modify"],
    summary: "Selection, properties, align, group, Boolean ops",
  },
  "editing.html#select": {
    title: "Select and move",
    section: "Editing",
    keywords: ["select", "move", "V", "drag", "multi-select"],
    summary: "Select, multi-select, and move shapes",
  },
  "editing.html#design": {
    title: "Design tab (properties)",
    section: "Editing",
    keywords: ["Design", "property", "numeric", "coordinates", "inspector"],
    summary: "Edit shape values in the right panel",
  },
  "editing.html#appearance": {
    title: "Appearance (fill and stroke)",
    section: "Editing",
    keywords: ["color", "fill", "stroke", "appearance", "style"],
    summary: "Change fill and stroke colors",
  },
  "editing.html#align": {
    title: "Align and distribute",
    section: "Editing",
    keywords: ["align", "distribute", "left", "center", "spacing"],
    summary: "Align and evenly space multiple shapes",
  },
  "editing.html#group": {
    title: "Grouping",
    section: "Editing",
    keywords: ["group", "⌘G", "combine", "ungroup"],
    summary: "Group multiple shapes together",
  },
  "editing.html#boolean": {
    title: "Boolean operations",
    section: "Editing",
    keywords: ["Boolean", "union", "subtract", "intersect", "combine", "cut"],
    summary: "Union, subtract, intersect, exclude, and flatten paths",
  },
  "editing.html#history": {
    title: "Undo / Redo and History",
    section: "Editing",
    keywords: ["Undo", "Redo", "history", "revert", "History panel"],
    summary: "Undo/redo and the history panel",
  },
  "multiview-3d.html": {
    title: "3D generation",
    section: "Guide",
    keywords: ["3D", "solid", "CSG", "multiview", "projection", "mesh"],
    summary: "Generate solids from top and front views",
  },
  "multiview-3d.html#how-it-works": {
    title: "How 3D works",
    section: "3D generation",
    keywords: ["how", "intersect", "CSG", "orthographic", "works"],
    summary: "Intersect two or more orthographic views into a solid",
  },
  "multiview-3d.html#view-type": {
    title: "Add pages by face direction",
    section: "3D generation",
    keywords: [
      "top",
      "front",
      "side",
      "viewDefinition",
      "view",
      "page",
      "add page",
    ],
    summary: "Add top, front, side, and other face-direction pages",
  },
  "multiview-3d.html#example": {
    title: "Box example",
    section: "3D generation",
    keywords: ["box", "example", "tutorial", "rectangular", "practice"],
    summary: "Build a box from top + front views",
  },
  "multiview-3d.html#color": {
    title: "Colors in 3D",
    section: "3D generation",
    keywords: ["color", "3D", "fill", "mesh"],
    summary: "Shape fill colors appear on the 3D mesh",
  },
  "multiview-3d.html#tips": {
    title: "When 3D fails",
    section: "3D generation",
    keywords: ["trouble", "error", "mesh", "fail", "debug", "missing"],
    summary: "Checklist when no mesh is generated",
  },
  "multiview-3d.html#holes": {
    title: "Holes and cutouts (3D)",
    section: "3D generation",
    keywords: ["hole", "cutout", "inner", "subtract", "pocket"],
    summary: "Create holes inside profiles",
  },
  "export.html": {
    title: "Save and export",
    section: "Guide",
    keywords: ["save", "export", "output", "file", "write"],
    summary: "Save and export JSON, SVG, PDF, and STL",
  },
  "export.html#autosave": {
    title: "Autosave",
    section: "Save and export",
    keywords: ["autosave", "restore", "recovery", "draft"],
    summary: "Automatic save and resume",
  },
  "export.html#project-file": {
    title: "Project file (JSON)",
    section: "Save and export",
    keywords: ["JSON", "save", "open", "project", "file"],
    summary: "Save and open the full project as JSON",
  },
  "export.html#svg": {
    title: "SVG import and export",
    section: "Save and export",
    keywords: ["SVG", "import", "export", "vector"],
    summary: "Import and export SVG",
  },
  "export.html#pdf": {
    title: "PDF export",
    section: "Save and export",
    keywords: ["PDF", "print", "export", "document"],
    summary: "Export all pages to PDF",
  },
  "export.html#stl": {
    title: "STL export",
    section: "Save and export",
    keywords: ["STL", "3D print", "export", "mesh"],
    summary: "Export the 3D model as STL",
  },
  "shortcuts.html": {
    title: "Keyboard shortcuts",
    section: "Guide",
    keywords: ["shortcut", "keyboard", "⌘", "Ctrl", "hotkey"],
    summary: "Tool, edit, and view shortcuts",
  },
  "shortcuts.html#tools": {
    title: "Tool shortcuts",
    section: "Shortcuts",
    keywords: ["V", "R", "C", "L", "T", "D", "H", "tool"],
    summary: "V=select, R=rect, C=circle, L=line, T=text, D=dimension",
  },
  "shortcuts.html#edit": {
    title: "Edit shortcuts",
    section: "Shortcuts",
    keywords: ["Undo", "Redo", "copy", "delete", "group", "paste"],
    summary: "⌘Z, ⌘C, Del, ⌘G, and more",
  },
  "shortcuts.html#view": {
    title: "View and navigation",
    section: "Shortcuts",
    keywords: ["zoom", "pan", "Space", "Esc", "navigation"],
    summary: "Zoom, pan, and clear selection",
  },
  "ai-mcp.html": {
    title: "AI integration (MCP)",
    section: "Guide",
    keywords: ["AI", "MCP", "Claude", "automation", "agent"],
    summary: "Control Millrect from Claude Desktop and other MCP clients",
  },
  "ai-mcp.html#mcp-setup": {
    title: "MCP setup",
    section: "AI integration",
    keywords: [
      "MCP",
      "Claude",
      "setup",
      "server.js",
      "Node",
      "claude_desktop_config",
    ],
    summary: "Example MCP server config for Claude Desktop",
  },
  "ai-mcp.html#part-dsl-workflow": {
    title: "Useful levels of AI work",
    section: "AI integration",
    keywords: [
      "Intent API",
      "Part DSL",
      "validate_manufacturability",
      "parts",
      "mm",
    ],
    summary: "Context, Intent API, Part DSL, manufacturing checks, and review",
  },
  "ai-mcp.html#taste-memory": {
    title: "Taste Memory",
    section: "AI integration",
    keywords: [
      "Taste Memory",
      "projectBrief",
      "preferences",
      "decisions",
      "record_decision",
      "artifactLog",
    ],
    summary:
      "Record intent, constraints, preferences, design decisions, and review history",
  },
  "ai-mcp.html#sketch-digitize": {
    title: "Sketch digitize",
    section: "AI integration",
    keywords: ["digitize", "ghost", "Vision", "load_reference_image", "sketch"],
    summary: "MCP sketch import and ghost confirmation",
  },
  "developer.html": {
    title: "Developer guide",
    section: "Developer",
    keywords: [
      "development",
      "API",
      "architecture",
      "repository",
      "schema",
      "MCP",
      "Electron",
    ],
    summary: "Repo layout, data model, global APIs, MCP reference",
  },
  "developer.html#project-layout": {
    title: "Project layout",
    section: "Developer",
    keywords: ["directory", "folder", "app", "shared", "mcp"],
    summary: "Directories and key files under millrect/",
  },
  "developer.html#mcp-tools": {
    title: "MCP tools reference",
    section: "Developer",
    keywords: [
      "get_project_context",
      "apply_commands",
      "apply_part_dsl",
      "snake_case",
    ],
    summary: "MCP tools and apply_commands actions",
  },
};

/** @param {HelpEntry} entry */
function helpEntryKey(entry) {
  return entry.anchor ? entry.page + "#" + entry.anchor : entry.page;
}

/**
 * @param {"ja"|"en"|string} [locale]
 * @returns {"ja"|"en"}
 */
function normalizeHelpLocale(locale) {
  return locale === "en" ? "en" : "ja";
}

/**
 * @returns {"ja"|"en"}
 */
function getHelpSearchLocale() {
  if (typeof getLocale === "function") {
    return normalizeHelpLocale(getLocale());
  }
  try {
    var path = window.location.pathname || "";
    if (path.indexOf("/docs/en/") >= 0 || /\/en\/[^/]+\.html$/.test(path)) {
      return "en";
    }
    var stored = localStorage.getItem("millrect-docs-lang");
    if (stored === "en" || stored === "ja") return stored;
    var appStored = localStorage.getItem("millrect-locale");
    if (appStored === "en" || appStored === "ja") return appStored;
  } catch (_e) {}
  return "ja";
}

/**
 * @param {HelpEntry} entry
 * @param {"ja"|"en"|string} [locale]
 * @returns {HelpEntry}
 */
function localizeHelpEntry(entry, locale) {
  var loc = normalizeHelpLocale(locale);
  if (loc === "ja") return entry;
  var localized = HELP_INDEX_EN[helpEntryKey(entry)];
  if (!localized) return entry;
  return {
    page: entry.page,
    anchor: entry.anchor,
    title: localized.title,
    section: localized.section,
    summary: localized.summary,
    keywords: localized.keywords,
  };
}

/**
 * @param {string} query
 * @param {number} [limit=12]
 * @param {"ja"|"en"|string} [locale]
 * @returns {Array<HelpEntry & { score: number }>}
 */
function searchHelpIndex(query, limit, locale) {
  limit = limit || 12;
  locale = normalizeHelpLocale(
    locale !== undefined ? locale : getHelpSearchLocale(),
  );
  var q = (query || "").trim().toLowerCase();
  if (!q) return [];

  var tokens = q.split(/\s+/).filter(Boolean);
  var scored = [];
  var sortLocale = locale === "en" ? "en" : "ja";

  for (var i = 0; i < HELP_INDEX.length; i++) {
    var entry = localizeHelpEntry(HELP_INDEX[i], locale);
    var haystack = (
      entry.title +
      " " +
      entry.section +
      " " +
      entry.summary +
      " " +
      entry.keywords.join(" ")
    ).toLowerCase();

    var score = 0;
    for (var t = 0; t < tokens.length; t++) {
      var token = tokens[t];
      if (entry.title.toLowerCase().indexOf(token) >= 0) score += 12;
      if (
        entry.keywords.some(function (k) {
          return k.toLowerCase().indexOf(token) >= 0;
        })
      )
        score += 8;
      if (entry.section.toLowerCase().indexOf(token) >= 0) score += 4;
      if (haystack.indexOf(token) >= 0) score += 2;
    }
    if (score > 0) scored.push({ entry: entry, score: score });
  }

  scored.sort(function (a, b) {
    return (
      b.score - a.score ||
      a.entry.title.localeCompare(b.entry.title, sortLocale)
    );
  });

  return scored.slice(0, limit).map(function (item) {
    return Object.assign({}, item.entry, { score: item.score });
  });
}

/** @param {HelpEntry} entry */
function helpTopicHref(entry) {
  return entry.anchor ? entry.page + "#" + entry.anchor : entry.page;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    HELP_INDEX,
    HELP_INDEX_EN,
    helpEntryKey,
    normalizeHelpLocale,
    getHelpSearchLocale,
    localizeHelpEntry,
    searchHelpIndex,
    helpTopicHref,
  };
}
