# ADR 0002: アプリのバンドル化 — esbuild による段階的 ESM 移行（Bプラン）

- **Status:** Proposed
- **Date:** 2026-06-09
- **Deciders:** Millrect プロダクト
- **前提:** packages/ ほか主要コードの TS ソース化と生成 `.js` の build artifact 化は完了済み

## Context

Millrect の実行時コードは「バンドラなし・`<script src>`・グローバルスコープ」で構成される。
`app/index.html` は約 **89 本**の `<script>` を順序厳守で読み込み（vendor 9 / packages 22 / app/js + components + locales 約 58）、ファイル間の参照はすべてグローバル識別子で行う。

TS 化は完了したが、この形態が次の天井になっている:

- **`import`/`export` を書けない。** モジュール構文を入れると tsc 出力が CJS になり、素の `<script>` で読めない。
- **`any` の最後の置き場が消せない。** `(window as any).REAL_PER_MM` のような window 経由参照や、`@types/three` 等を導入できない（THREE は `vendor/three.min.js` のグローバル）。
- **依存が暗黙。** ロード順のコメント（CLAUDE.md「順序厳守」）だけが頼りで、tsc も esbuild も依存を検証しない。

一方で、壊してはならない**グローバル契約**が 3 つある:

1. **MCP/WS**: `main.ts` の `executeJavaScript("getState() ...")` はレンダラーの bare global（`getState`, `render`, `uiUpdate`, `applyDrawingCommands` 等）を呼ぶ。
2. **E2E**: `tests/e2e/*.spec.js`（23 spec）が `page.evaluate` で同じグローバルを叩く。
3. **ファイル間参照**: app/js ↔ packages のすべて。

## Decision

**esbuild で単一（最終的に）IIFE バンドルへ段階移行する。グローバル契約は「明示的な global surface」として維持する。**

### 原則

1. **バンドラは esbuild。** 既に devDependency で、`millrect-text-engine.mjs` のバンドルに実績がある。
2. **グローバルは「成り行き」から「明示」へ。** script の素のトップレベル宣言に頼らず、各モジュールまたはエントリで `Object.assign(globalThis, {...})` する。MCP / E2E / 未移行ファイルが見るグローバル面はこれで不変に保つ。
3. **段階置換・並行期間なし。** バンドルへ入れたファイルの `<script>` タグは同一コミットで除去する（同じグローバルの二重定義を避ける）。
4. **vendor は当面そのまま。** `three.min.js` / `polygon-clipping.umd.js` 等は `<script>` グローバルのままにし、バンドルからは external 扱い。npm 化（`import * as THREE from "three"` + `@types/three`）は最終フェーズ。
5. **Node 側（electron/ scripts/ main/preload）は現行 tsc CJS のまま。** packages が本物の ESM（`export`）になっても、tsc の `module: commonjs` が `require`/`exports` に変換するため、`tests/unit` の `require()` は動き続ける（named export のみ使い default は使わない）。
6. **配布は不変。** Electron `loadFile` + 静的ホスト。バンドルは `app/vendor/` に出力し、`site-manifest` の deploy 対象（`app`）に自然に含まれる。バンドルは gitignore する build artifact。

### フェーズ

| フェーズ | 内容 | 検証 |
|---|---|---|
| **1 (PoC)** | schema ファミリ（`schema` / `model-generator` / `geometry-core` / `project-json`）を 1 バンドルに。タグ 4 本 → 1 本 | unit 71 + e2e（特に `model-pipeline.spec` / `state.spec`） |
| **2** | 残りの packages/ を順次バンドルへ。素のトップレベル宣言に依存している package は `Object.assign(globalThis, ...)` ブロックを追加してから | unit + e2e 全 spec |
| **3** | app/js を葉から（db, i18n, locales, components → state → transform/profiles/constraints → renderer/commands → interaction/ui）ボトムアップで ESM 化しバンドルへ | e2e 全 spec + `npm run dev` 手動 + MCP `get_state` スモーク |
| **4** | 単一エントリ化・vendor の npm import 化（`@types/three` 導入）・`(window as any)` 残渣の解消・tsconfig を app（ESM, noEmit チェック）/ Node（CJS emit）に分割 | 全部 + リリースビルド |

### PoC の形（フェーズ 1）

- エントリ `app/src/bundle-entry.ts` — 対象 package の `.ts` を**副作用 import**（esbuild が直接コンパイルするので `build:ts` 出力に依存しない）。
- 出力 `app/vendor/millrect-packages.bundle.js`（IIFE）。`scripts/build-app-bundle.ts` でビルドし、`dev` / `build` チェーンに `build:app` を追加。
- UMD 自己代入する schema ファミリは import だけで global 面が再現される。`project-json` は bare 関数宣言のみなので、既存パターン（part-dsl 等）に合わせ `.ts` に `Object.assign(window, ...)` ブロックを追加する。

## Consequences

- (+) `import`/`export` と実依存グラフが手に入り、tsc/esbuild が依存を検証する。
- (+) `@types/three` 等の導入で「不可避だった any」を解消できる。
- (+) `<script>` 89 本 → 最終的に vendor + バンドル数本。ロード順コメント依存が消える。
- (−) ビルドステップが増える（`build:app`）。素の F5 でソース直読みはできなくなる（フェーズ 3 以降）。
- (−) 移行中はバンドル済み/未移行の境界管理が必要。境界はグローバル面なので、**フェーズごとに e2e 全 spec を回す**ことで担保する。
- (リスク) tsc CJS interop: packages を ESM 化すると Node 側 `require()` は `exports.X` を読む。**default export を使わない**規約で回避。
- (リスク) ロードタイミング: IIFE バンドルは置換した先頭タグの位置で同期実行される。タグ位置はバンドル対象の**最も早いタグの位置**に置く。
