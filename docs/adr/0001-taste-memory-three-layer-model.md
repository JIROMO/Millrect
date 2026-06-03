# ADR 0001: Taste Memory — 3 層メモリモデル

- **Status:** Accepted
- **Date:** 2026-05-28
- **Deciders:** Millrect プロダクト / エージェント連携
- **詳細設計:** [docs/TASTE-MEMORY.md](../TASTE-MEMORY.md)

## Context

Millrect は「図面を AI に丸投げしない」協働 CAD として、2D 図面・`partIntent`（Part DSL）・MCP による幾何操作を既に持つ。一方、ユーザーが求める体験は **3D 生成器** ではなく、**美意識・判断を共有しながら一緒に作る相棒** に近い。

会話全文やブランドの表層コピーではなく、

- **判断**（採用 / 却下 / 修正の理由）
- **価値観**（構造美、道具感、装飾回避など）

をローカルに蓄積し、プロジェクト横断で「その人専用の相棒」に育てる必要がある。

既存の `partIntent` は **パラメトリックな作り方（W/D/H、bindings、features）** を表す。目的・テイスト・採否理由は別ドメインとして扱わないと、ソルバーとエージェントコンテキストが混線する。

## Decision

Taste Memory を **3 層** でモデル化し、保存場所と昇格ルールを固定する。

| 層 | スコープ | 保存 | Undo / プロジェクト export |
|----|----------|------|---------------------------|
| **Global Memory** | ユーザー全体 | IndexedDB `tasteGlobal`（`projects` と別ストア） | **含めない** |
| **Project Memory** | 1 プロジェクト | `state.projectBrief`（`DOC_KEYS`） | **含める** |
| **Artifact Memory** | 図形・版・キャプチャ | `projectBrief.artifactLog` + ファイル `captures/` | プロジェクトに含める |

### 原則

1. **会話全文は保存しない。** 構造化された `Judgment` / `Principle` のみ。
2. **Project の判断を即 Global に昇格しない。** 繰り返しとユーザー確認で昇格。
3. **`partIntent` と分離する。** 幾何ソルバー制約ではなく、エージェント向け Design Brief。
4. **制作フェーズを分ける。** Discover → Taste → Brief → Make → Review → Learn（詳細は TASTE-MEMORY.md）。
5. **図面ファーストを維持。** OpenSCAD 等は Artifact の副産物として記録可能だが、主経路は Millrect 正投影 + CSG（[openscad-interop-notes.md](../design/openscad-interop-notes.md)）。

### Project Memory の DOC_KEYS 追加

```js
DOC_KEYS = [..., "projectBrief"]  // partIntent は維持
```

### Global 昇格（デフォルト閾値）

- 同一趣旨の `Principle` が **2 つ以上の異なる `projectId`** で `reinforce` されたとき、昇格**候補**とする。
- ユーザーが `promoteBlocked: true` を付けた判断は昇格しない。
- 昇格は自動マージ前に **確認 UI または MCP で明示承認** を推奨（初版は手動でも可）。

## Consequences

### Positive

- エージェントは `get_project_context` で **幾何 + 案件の why** を同時に参照できる。
- ローカルデスクトップの強み（履歴・キャプチャ・STL）と「育つ相棒」が一致する。
- Undo / export の境界が明確（Global はプライバシー境界の外）。

### Negative / トレードオフ

- スキーマと MCP ツールの実装コスト（フェーズ分割が必要）。
- Taste Dialog は主に LLM 依存；アプリは **記録・昇格・ガード** に集中する。
- `projectBrief` 肥大化 → `artifactLog` のローテーション方針が必要（TASTE-MEMORY.md）。

### 非目標（本 ADR ではやらない）

- ブランドサイトの自動クロール / 社内 Vision モデルの同梱
- Global Memory のクラウド同期
- `partIntent` への aesthetic 拘束の直接マッピング

## Alternatives considered

| 案 | 却下理由 |
|----|----------|
| 会話ログを IndexedDB に全保存 | プライバシー・ノイズ・検索コスト。判断抽出に留める |
| `partIntent` に taste フィールドを追加 | Solver / DSL バージョンと結合し変更コストが高い |
| 単一 `userPreferences.json` のみ | プロジェクト限定の好み（「今回は無骨」）を表現できない |
| Web サービス上の Taste プロファイル | ローカル工房体験・ファイル連携と矛盾 |

## Implementation tracking

| フェーズ | 内容 | 状態 |
|----------|------|------|
| 0 | ADR + TASTE-MEMORY.md | 完了 |
| 1 | `projectBrief` スキーマ + export | 完了（2026-05-28） |
| 2 | MCP: `update_project_brief`, `record_decision` 等 | 完了（2026-05-28） |
| 3 | `get_project_context` に brief 統合 | 完了（2026-05-28） |
| 4 | Global IndexedDB + 昇格サービス | 完了（2026-05-28） |
| 5 | Review ループ（artifactLog MCP） | 完了（2026-05-28） |
| 6 | Make 前ソフトガード | 完了（2026-05-28） |

残タスク: `captures/` を含む ZIP export は別タスクとして追跡する。
