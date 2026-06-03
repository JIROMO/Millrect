# Millrect — AI Agent Manual

**English:** [AGENT.md](AGENT.md)

AI エージェント（Claude / MCP / スクリプト）が Millrect を操作するための**指示書**。  
すべての関数はグローバルスコープに公開されており、`window.xxx()` または `xxx()` で呼び出せる。

**プロダクト思想:** [millrect.com/docs/philosophy.html](https://millrect.com/docs/philosophy.html) — 図面を AI に丸投げするのではなく、**人間と AI が同じ図面空間で協働**する設計。ブラウザ UI の自動操作より **Intent API / MCP ツール**を使う。

## MCP からの参照

MCP サーバー（`mcp/server.js`）経由で操作する場合、本書は Resource として公開されている。

| Resource URI | 内容 |
|--------------|------|
| `millrect://docs/agent-manual` | 本書全文（英語版 `AGENT.md`） |
| `millrect://docs/workflow` | 操作チェックリスト（短縮版） |
| `millrect://docs/mcp-reference` | **補足:** MCP ツール全一覧 + `apply_commands` アクション |
| `millrect://docs/taste-memory` | [docs/TASTE-MEMORY.md](docs/TASTE-MEMORY.md) — 美意識・判断（Project / Global / Artifact 層） |

定型 Prompt: `operate_drawing`（2D 操作）、`create_3d_model`（多ビュー 3D）。

**図面操作の前に必ず `agent-manual` を読み、`get_project_context` → `validate_3d_readiness` の順で現状確認すること。**  
`undo` / Boolean / 拘束など **MCP ツールの網羅一覧**は `mcp-reference` または [docs/MCP-REFERENCE.md](docs/MCP-REFERENCE.md) を参照。リポジトリ構成・アーキテクチャ: [docs/developer.html](docs/developer.html)。

## Intent API（エージェント向け・推奨）

低レベル `apply_commands` より **mm 第一級の MCP ツール**を優先する。

| MCP ツール | WS action | 用途 |
|----------|-----------|------|
| `create_multiview_box` | `createMultiviewBox` | mm 直方体 → 上面+正面（+右側面） |
| `create_part` | `createPart` | セマンティック Part（`box` + `features[]`） |
| `layout_rect_mm` | `layoutRectOnPageMm` | 現在ページに mm 矩形を中央配置 |
| `validate_3d_readiness` | `validate3DReadiness` | 3D 生成前の構造化チェック |

Part DSL 系: `compile_part_dsl` / `apply_part_dsl` / `update_part_param` / `validate_manufacturability` — 詳細は [AGENT.md](AGENT.md) の Part DSL 章。

### スケッチ取り込み（参照画像 + ゴースト図形）

**目的:** 手書きスケッチ/写真 → **編集可能な下書き**。Millrect 内に Vision はない — 外部 LLM が **proposals**（mm）を生成する。

```
load_reference_image          → 下絵を現在ページに配置
set_reference_scale_anchor    → 2 点 + length_mm（UI: ページ → 参照画像 → スケール校正 も可）
digitize_sketch               → proposals[] をゴースト図形として配置
confirm_digitize_proposals    → ゴースト確定（3D Profile 対象に）
validate_3d_readiness         → 3D 前チェック
```

**UI:** Pages タブ → **参照画像** — 画像読込、**位置・サイズを編集**（トグル: 再クリックで終了）、不透明度、スケール校正（実寸がわかる線の両端 + mm + 適用）、ゴースト確定/削除。

**制作メモ UI:** Pages タブ → **制作メモ** — `projectBrief` の intent / phase / principles / decisions と「制作前に方針を必須にする」設定を確認。

**proposal 例（mm 第一級）:**

```json
{ "type": "rect", "x_mm": 10, "y_mm": 20, "width_mm": 80, "height_mm": 50 }
{ "type": "circle", "cx_mm": 40, "cy_mm": 40, "r_mm": 5 }
```

**ゴースト:** `shape.ghost === true` — 表示されるが `extractProfilesFromPage()` / 3D からは除外。確定まで 3D に使わない。

| MCP ツール | 用途 |
|----------|------|
| `load_reference_image` / `set_reference_scale_anchor` | 下絵 + スケール校正 |
| `digitize_sketch` | proposals → ゴースト（`confirm: true` で一括確定可） |
| `confirm_digitize_proposals` | ゴースト → 通常図形 |

グローバル関数: `setReferenceImage()`, `applyDigitizeProposals()`, `confirmDigitizeProposals()`, `beginReferenceScaleAnchor()` 等 — `reference-image.js`, `digitize-sketch.js`。

### ドキュメント制作の記憶

ドキュメント制作の持続的な判断・探し方は
[docs/design/documentation-system.md](docs/design/documentation-system.md) に残す。
生成済み PNG を直接直す前に、同ドキュメントの source-finding notes を読み、
スクリーンショット元のシナリオコードを更新する。

## エージェント向け最重要ルール

1. **編集するのは 2D 図面だけ。** 3D は派生データ。いつでも `update3DScene()` で再生成できる。
2. **3D は多ビュー交差のみ。** per-shape の `feature.depth`（押し出し指示）は**使わない**（UI も削除済み）。
3. **立体を作るには複数の正投影ページが必要。** 例: 上面図ページ + 正面図ページ。各ページに `viewDefinition.type` と閉じた輪郭を描く。
4. **dimension は `page.dimensions[]` に格納。** `layer.shapes[]` に混ぜない。
5. 図形変更後は必ず `render(); uiUpdate();` を呼ぶ。3D 確認時は `update3DScene(); get3DSceneStatus();` を使う。

## 3D パイプライン境界

3D 精度改善は、できる限り以下の package / app 内に閉じる。

| 領域 | 責務 |
|------|------|
| `packages/schema` | Project JSON / Part DSL / Model IR / geometry-data の検証 |
| `packages/model-generator` | Project JSON / Profile / Part DSL feature → 編集可能な Model IR operations |
| `packages/geometry-core` | Model IR → 決定的な geometry data、export 向け mesh / CSG data |
| `packages/model-viewer` | Three.js 表示、カメラ、選択、ハイライトのみ |
| `app/js/3d-view.js` | 既存互換の多ビュー CSG preview / STL wrapper。変更は最小限にする |

実行アプリは `apps/`、再利用可能なライブラリは `packages/`
に置く。既存の 2D editor は互換性のため、現時点では `app/` に残す。
移動する場合の移行先は `packages/` ではなく
`apps/millrect-editor`。`packages/` に切り出すのは
drawing schema、profile 抽出、command reducer、rendering helper など
再利用可能な 2D primitive に限定する。

3D 精度改善のために 2D 編集 UI を直接変更しない。生成処理で DOM 操作しない。
Three.js を geometry core にしない。mesh は出力であり、唯一の内部表現にしない。
`update3DScene()` 後に `get3DModelPipelineState()` を呼ぶと、新しい
Project JSON → Model IR → geometry-data wrapper を確認できる。

---

## 座標系

| 概念 | 値 |
|------|----|
| 単位 | real units（1 mm = 10 units） |
| A4 横 | 2970 × 2100 |
| A4 縦 | 2100 × 2970 |
| A3 横 | 4200 × 2970 |

スケール 1:10（`scale: {numerator:1, denominator:10}`）のとき:

```
paperUnit = realUnit × numerator / denominator
realUnit  = paperUnit × denominator / numerator
```

---

## Shape スキーマ

```js
// 共通フィールド
{
  id: string,            // genId('shape') で生成
  type: string,
  stroke: string,        // 例: "#1a1a2e"
  fill: string,          // 色 or "none"
  strokeWidth: "thin" | "medium" | "thick",

  // ビジュアル変換（SVG表示・getBBox・整列・Profile・3D生成に反映）
  rotation?: number,
  flipH?: boolean,
  flipV?: boolean,

  // feature（レガシー・3D生成では未使用。インポート時は strip）
  // feature?: { type: "extrude", depth: number, bevel?: boolean, bevelSize?: number },

  // スケッチ取り込み: digitize 提案のゴースト（確定前は 3D Profile 対象外）
  ghost?: boolean,
}

// rect
{ type:"rect", x, y, width, height, rx? }

// circle
{ type:"circle", cx, cy, r }

// line
{ type:"line", x1, y1, x2, y2,
  role?: "drawing"|"cut"|"annotation"|"construction" }  // 既定 "drawing"
//   どの role も表示スタイルのみ。線は 3D 輪郭の対象外。
//   3D に切り欠きを出すには図形ジオメトリ自体に焼き込む（path 輪郭の編集 / boolean 差し引き）。
//   線が暗黙に立体を削ることはしない。

// text
{ type:"text", x, y, text:string,
  fontSize?:number,        // px（デフォルト 3.5）
  fontFamily?:string,      // 同梱 Gen Interface JP、または state.fonts[] に登録した family
  fontWeight?: "normal"|"bold",  // Bold は fileUrlBold（700 TTF）を使用
  textAlign?: "left"|"center"|"right",
  lineHeight?:number,      // 倍率（デフォルト 1）
  width?:number            // 折り返し幅 mm。未指定なら 1 行
}
// 注: 文字色は stroke フィールドを使用（fill は使わない）

// bezier（ペンパス）
{ type:"bezier", nodes: [{x, y, h1:{x,y}|null, h2:{x,y}|null}], closed: boolean }

// path（ポリゴン複合パス）
{ type:"path", contours: [ring[][]] }   // polygon-clipping 形式

// group
{ type:"group", children: Shape[] }
```

## Dimension スキーマ（page.dimensions[] に格納）

```js
{
  id: string,
  type: "dimension",
  dimensionType: "horizontal" | "vertical",
  from: {x, y},
  to:   {x, y},
  offset: number,

  // スタイル（省略可）
  color?: string,
  lineWidth?: number,
  textSize?: number,
  arrowStyle?: "dot"|"arrow"|"slash"|"open",
  fontFamily?: string,

  // 数値フォーマット（省略可）
  value?: number,
  decimals?: number,
  prefix?: string,
  suffix?: string,

  // テキスト位置（省略可）
  textOffsetX?: number,
  textOffsetY?: number,
  textRotation?: number,
}
```

> **重要:** dimension は `layer.shapes[]` に入らない。  
> `addShape({ type:"dimension", ... })` を呼べば自動的に `page.dimensions[]` へ格納される。

## Page.viewDefinition（3D 生成に必須）

各ページに正投影の種類を設定する。3D は **図面の輪郭同士を CSG 交差**して導出する。

| type | 意味 |
|------|------|
| `top` / `bottom` | 上面図 / 下面図 |
| `front` / `back` | 正面図 / 背面図 |
| `right` / `left` | 右側面図 / 左側面図 |
| `section` / `detail` | 断面図 / 詳細図（内部では `top` 扱い） |

```js
page.viewDefinition = { type: "top", normal: [0,0,1], up: [0,1,0] };
```

**3D 生成の最低条件:** 2 軸以上のビュー（例: 上面 + 正面）。1 ページだけでは `get3DSceneStatus().meshCount === 0`。

**禁止:** `feature.depth` 等で per-shape に 3D 指示を付けない（UI も削除済み。図面ファースト）。

---

## 基本操作パターン

```js
// ① 図形を追加
addShape({
  id: genId('shape'), type: 'rect',
  x: 100, y: 100, width: 500, height: 300,
  stroke: '#1a1a2e', fill: 'none', strokeWidth: 'medium'
});
render(); uiUpdate();

// ② 図形を更新
updateShape('shape-xxxx', { fill: '#ff0000' });
render(); uiUpdate();

// ③ 図形を削除
deleteShape('shape-xxxx');
render(); uiUpdate();

// ④ 選択
getState().selectedShapeIds = ['shape-xxxx'];
uiUpdate();

// ⑤ 寸法線を追加（page.dimensions[] へ自動格納）
addShape({
  id: genId('dim'), type: 'dimension',
  dimensionType: 'horizontal',
  from: {x: 100, y: 500}, to: {x: 600, y: 500},
  offset: 50,
  stroke: '#1a1a2e', fill: 'none', strokeWidth: 'thin',
});
render(); uiUpdate();
```

---

## State API

```js
getState()                   // → _state オブジェクト
getCurrentPage()             // → 現在の Page
getCurrentLayer()            // → 現在の Layer
getAllShapesOnPage(page)      // → Shape[]（dimension を含まない）
getAllDimensionsOnPage(page)  // → Dimension[]
findShapeById(id)            // → { shape, layer, page, isDimension } | null
                             //   isDimension=true のとき layer は null
pushHistory()                // ドキュメント部分のみ記録 → autosave トリガー
undo() / redo()              // → boolean。zoom/pan/tool は変化しない
replaceState(newState)       // state 全体置換（履歴リセット）
genId(prefix)                // ユニーク ID 生成
```

---

## Profile API（3D生成・輪郭抽出）

```js
// 閉じた輪郭になれるか判定
canBeProfile(shape)  // → boolean

// ページ全体から閉じた輪郭を抽出
extractProfilesFromPage(page)
// → [{ id, sourceId, pageId, rings, bbox, area }]
// 対応: rect / circle / bezier(closed) / path
// 非対応: line / text / dimension / bezier(open) / group

// 単一 shape から Profile を生成
shapeToProfile(shape, pageId)  // → Profile | null
```

---

## 図形操作 API

```js
addShape(shape)
updateShape(id, values)
deleteShape(id)
deleteSelectedShapes()

shiftShape(shape, dx, dy)         // オブジェクト直接変更（pushHistory は呼ばない）
moveShapeToPosition(id, x, y)     // bbox 左上を (x,y) へ → pushHistory()

cloneSelectedShapes(dx, dy)       // → 新 id[]
duplicateShapes()                 // オフセット複製 → pushHistory()

alignShapes(dir)
// dir: 'left'|'centerH'|'right'|'top'|'centerV'|'bottom'
// 1個選択 → ページ基準、複数選択 → 選択範囲基準

distributeShapes(axis)            // 'h' | 'v'（3個以上必要）

flipShapes('h' | 'v')            // SVG表示のみ・座標不変
rotateShapes(deg)                 // SVG表示のみ・3D生成には影響しない

groupSelectedShapes()
ungroupSelectedShapes()
mergeSelectedShapes()             // union
subtractSelectedShapes()          // difference
intersectSelectedShapes()         // intersection
excludeSelectedShapes()           // exclude
flattenSelectedShapes()           // flatten path/group
```

---

## テキストアウトライン API（Electron 版）

```js
isTextOutlineAvailable()          // → boolean。electronAPI.outlineTextShape があるか
outlineTextShape(shapeOrId)       // テキスト → path の group に置換。pushHistory() 済み
// ブラウザ単体では alert を出して終了
// macOS: Core Text、それ以外: fontkit で輪郭生成
// 表示プレビューとアウトライン化は同じ glyph path を使用（Figma 式）
```

テキスト図形を 3D 輪郭に使う場合:
1. `addShape({ type:"text", ... })` で文字を配置
2. `outlineTextShape(id)` で path の group に変換
3. 各ページの viewDefinition + 輪郭として `update3DScene()`

MCP からは `outlineTextShape` 専用ツールは未提供。`apply_commands` で text を追加したあと、WS 経由で `outlineTextShape` を呼ぶ必要がある（通常は UI 操作を推奨）。

---

## プロジェクトフォント（`state.fonts[]`）

Google Fonts を Fontsource API 経由で登録。Undo / エクスポート対象（`DOC_KEYS` に含む）。

```js
{
  id: "font-xxx",
  family: "Roboto",
  cssUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap",
  fileUrl: "https://cdn.jsdelivr.net/fontsource/fonts/roboto@.../latin-400-normal.ttf",
  fileUrlBold: "https://cdn.jsdelivr.net/fontsource/fonts/roboto@.../latin-700-normal.ttf", // 省略可
  source: "google",
  libraryId: "libfont-yyy"   // 任意。ユーザーライブラリ参照
}
```

| 操作 | 関数 / UI |
|------|-----------|
| Fontsource から検索登録 | UI「フォントを探す…」→ `openFontBrowserModal()` |
| URL 直接登録 | `registerGoogleFontCssUrl(url)` |
| ライブラリ → プロジェクト | `addProjectFontFromLibrary(entry)` / UI ライブラリの **＋** |
| プロジェクトから削除 | `removeProjectFont(fontId)` |
| フォント選択肢 | `getFontFamilyOptions()` → 同梱 + `fonts[]` |

**注意:** モーダル一覧は Fontsource（Google Fonts カタログ）であり、**PC インストールフォントではない**。
**ユーザーライブラリ**は `userData/fonts-library.json`（Electron）に永続化され、プロジェクト JSON とは別。

---

## 幾何拘束 API

```js
// 拘束を追加（page.constraints[] に格納、applyConstraints() は自動実行される）
addConstraint({ type:'horizontal', shapeIds:['l1'] })
addConstraint({ type:'vertical',   shapeIds:['l1'] })
addConstraint({ type:'parallel',   shapeIds:['l1','l2'] })
addConstraint({ type:'equal_length', shapeIds:['l1','l2'] })
addConstraint({ type:'fixed',      shapeIds:['r1'], params:{ x:100, y:100 } })
addConstraint({ type:'coincident', shapeIds:['l1','l2'],
                params:{ point1:'end', point2:'start' } })

// 拘束を削除
removeConstraint('cst-id')

// 手動で全拘束を解く
applyConstraints()

// 対象 shape の拘束を取得
getConstraintsForShape('shape-id')   // → Constraint[]
getAllConstraints()                    // → Constraint[]（現在ページ）
```

---

## バッチ操作 API（推奨）

```js
applyDrawingCommands([
  { action: 'addShape',
    shape: { id: genId('shape'), type: 'rect', x:100, y:100, width:400, height:200,
             stroke:'#1a1a2e', fill:'none', strokeWidth:'medium' } },

  { action: 'addDimension',    // 寸法線追加（意味的に明示したい場合）
    dimension: { id: genId('dim'), dimensionType:'horizontal',
                 from:{x:100,y:400}, to:{x:500,y:400}, offset:30,
                 stroke:'#1a1a2e', fill:'none', strokeWidth:'thin' } },

  { action: 'addConstraint',   // 幾何拘束追加
    constraint: { id: genId('cst'), type:'horizontal', shapeIds:['l1'] } },

  { action: 'updateShape',
    id: 'existing-id',
    values: { fill: '#4a9eff' } },

  { action: 'deleteShape',     id: 'shape-to-delete' },
  { action: 'removeConstraint', id: 'cst-id' },

  { action: 'selectShapes',    ids: ['shape-xxxx'] },
  { action: 'applyConstraints' },   // 全拘束を即時解く

  { action: 'setPageScale',    scale: { numerator:1, denominator:10 } },
  { action: 'setPagePaper',    paper:'A4', orientation:'landscape' },
  { action: 'setProjectName',  name: 'My Project' },
  { action: 'addPage' },
]);
render(); uiUpdate();
```

---

## ページ・レイヤー操作 API

```js
addPage(createPage({ name:'Page 2', paper:'A3', orientation:'landscape' }))
deletePage(id)
updatePage(id, { name: '新しい名前' })

addLayer(pageId, createLayer({ name: '外形線' }))
deleteLayer(pageId, layerId)
updateLayer(pageId, layerId, { visible: false, locked: true })

// ページ切替
getState().currentPageId = page.id;
getState().currentLayerId = page.layers[0].id;
render(); uiUpdate();
```

---

## BBox 取得

```js
const ID_SCALE = { numerator:1, denominator:1 };  // real unit のまま
const bb = getShapeBBox(shape, ID_SCALE);
// → { x, y, w, h }（左上座標・幅・高さ、real units）| null
```

---

## 描画更新

```js
render()    // SVG 全再描画（figure 変更後に必ず呼ぶ）
uiUpdate()  // プロパティパネル・レイヤー一覧・ページ一覧を同期
fitPage()   // ページがビューポートに収まるようズームリセット
```

---

## エクスポート API

```js
exportProjectJsonString()   // → JSON 文字列（プロジェクト全体）
exportCurrentPageSvg()      // 現在ページを SVG ダウンロード
exportAllPagesPdf()         // 全ページを PDF ダウンロード（async）
exportSTL()                 // 3D シーンを STL ダウンロード
```

---

## 3D API（多ビュー交差）

```js
update3DScene()       // 全 pages[] から CSG 交差で Mesh 再生成
get3DSceneStatus()    // → { meshCount: number, message: string|null }
exportSTL()           // Mesh を STL ダウンロード（meshCount=0 なら alert）
```

`message` が非 null のときはビュー不足または輪郭不足。例:
- 「上面図に加えて正面図（または側面図）を追加してください」
- 「各ビューに閉じた輪郭（矩形・円・パスなど）を描いてください」

---

## 実用例

### 矩形を追加してページ中央に整列

```js
const id = genId('shape');
addShape({
  id, type:'rect', x:0, y:0, width:500, height:300,
  stroke:'#1a1a2e', fill:'#4a9eff33', strokeWidth:'medium'
});
getState().selectedShapeIds = [id];
alignShapes('centerH'); alignShapes('centerV');
render(); uiUpdate();
```

### 多ビューから 3D 立体を生成（上面 + 正面）

```js
const state = getState();
const topPage = state.pages[0];
topPage.name = "上面図";
topPage.viewDefinition = { type: "top", normal: [0,0,1], up: [0,1,0] };
topPage.layers[0].shapes.push({
  id: genId("shape"), type: "rect",
  x: 100, y: 100, width: 1000, height: 800,
  stroke: "#1a1a2e", fill: "#8fb7ff", strokeWidth: "medium",
});

const frontPage = createPage({
  name: "正面図",
  viewDefinition: { type: "front", normal: [0,-1,0], up: [0,0,1] },
});
frontPage.layers[0].shapes.push({
  id: genId("shape"), type: "rect",
  x: 100, y: 500, width: 1000, height: 500,
  stroke: "#1a1a2e", fill: "#ffb347", strokeWidth: "medium",
});
state.pages.push(frontPage);
replaceState(state);
render(); uiUpdate();

update3DScene();
console.log(get3DSceneStatus()); // { meshCount: 1, message: null }
```

### 水平寸法線を追加

```js
addShape({
  id: genId('dim'), type:'dimension',
  dimensionType:'horizontal',
  from:{x:200, y:700}, to:{x:800, y:700}, offset:60,
  stroke:'#1a1a2e', fill:'none', strokeWidth:'thin',
});
render(); uiUpdate();
```

### ページの Profile 一覧を確認

```js
const profiles = extractProfilesFromPage(getCurrentPage());
profiles.forEach(p => {
  console.log(p.sourceId, 'area:', p.area.toFixed(1), 'bbox:', p.bbox);
});
```

---

## 注意事項

- `shiftShape()` は `pushHistory()` を呼ばない。変更後に自分で `pushHistory()` → `render()` → `uiUpdate()` を呼ぶこと。
- `addShape()` / `updateShape()` / `deleteShape()` は内部で `pushHistory()` を呼ぶ。
- `applyDrawingCommands()` は末尾で `pushHistory()` を1回だけ呼ぶ（バッチ向き）。
- ID は重複禁止。`genId('shape')` / `genId('dim')` を使うのが安全。
- `layer.locked === true` の場合、`addShape()` は通常図形に対して失敗する（false を返す）。
- `render()` は RAF でデバウンスされているため、連続呼び出しは1フレームにまとめられる。
- `rotation` / `flipH` / `flipV` は SVG 表示、`getShapeBBox`、整列、Profile、3D 生成に反映される。
- **3D は図面から導出する。** `feature.depth` は使わない。上面 + 正面（最低 2 軸）の輪郭を描いて `update3DScene()` する。
- インポート JSON に `feature` フィールドがあっても 3D 生成では無視される。
