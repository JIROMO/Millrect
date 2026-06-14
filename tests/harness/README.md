# ヘッドレス・テストハーネス

ブラウザ（Electron / Playwright）を起動せずに、**MCP / WS と同じ本番経路**
（`applyDrawingCommands`）を端から端まで通して検証する土台。

- 追加の実行時依存ゼロ（`node:vm` のみ）。CI で常に走る。
- コア層（`state` / `transform` / `profiles` / `constraints` / `commands`）を
  ブラウザの classic-script ロード意味論で起動する。
- `Date.now` を固定 → `genId()` が決定論的 → スナップショットが安定。

```
npm run test:integration          # 実行
UPDATE_SNAPSHOTS=1 npm run test:integration   # ゴールデン更新
```

---

## テストの足し方（これだけ）

`tests/integration/` に `*.test.js` を作る。`bootApp()` が空プロジェクト
（`page-1` / `layer-1`）を返すので、コマンドを流して状態と派生物を見るだけ。

```js
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { bootApp } = require("../harness/boot.js");

describe("my new feature", () => {
  let app;
  beforeEach(() => { app = bootApp(); });

  it("does the thing", () => {
    app.applyDrawingCommands([
      { action: "addShape", shape: { id: "r1", type: "rect", x:0,y:0,width:100,height:50, stroke:"#000", fill:"none", strokeWidth:"thin" } },
    ]);
    assert.equal(app.getCurrentPage().layers[0].shapes.length, 1);
  });
});
```

### 派生物を固定したいとき（ゴールデン）

```js
const { matchSnapshot } = require("../harness/snapshot.js");
matchSnapshot("my-profiles", app.extractProfilesFromPage(app.getCurrentPage()));
```

初回は `__snapshots__/` に書き出し、以降は厳密比較。派生ロジックを意図して
変えたら `UPDATE_SNAPSHOTS=1` で更新する。

---

## 約束ごと / 落とし穴

- **`id` は自分で渡す。** `applyDrawingCommands` は id を自動採番しない（本番の
  MCP/WS 呼び出しと同じ）。明示 id にするとスナップショットも安定する。
- **毎テスト `bootApp()`。** 状態はコンテキストごとに隔離される。`app.reset()` でも可。
- **このハーネスは DOM を持たない。** `render()` 等は no-op スタブ。SVG 出力
  （`buildPageSVG`）や 3D メッシュの検証は対象外。必要になったら下記を拡張する。

## 拡張ポイント（`boot.js`）

| やりたいこと | 触る場所 |
|---|---|
| 別の app/js コアファイルを足す（DOM 不要なもの） | `CORE_FILES` に 1 行 |
| Node 側へ公開する関数を増やす | `EXPORT_NAMES` に名前を足す |
| コア外の連携関数で落ちる | `PRELUDE` に no-op を足す |
| SVG / 3D を検証したい | jsdom を入れて DOM 版ハーネスを別途用意（renderer/export/3d-view を追加ロード） |

## 設計メモ

コアファイルは **1 本に連結して 1 回 `runInContext`** する。`runInContext` を
ファイルごとに分けると、トップレベルの `const`/`let` がスクリプト間で共有されず
壊れる（ブラウザの複数 `<script>` は共有レキシカルスコープを持つ）。連結は
その意味論を正しく再現する。トップレベル束縛は epilogue の direct `eval` で
拾って `globalThis.__app` に載せ、Node から読めるようにしている。
