# Taste Memory — 設計仕様

**関連:** [ADR 0001: 3 層メモリモデル](adr/0001-taste-memory-three-layer-model.md) · [Millrect 思想](https://millrect.com/docs/philosophy.html) · [AGENT.ja.md](../AGENT.ja.md)

**ステータス:** Implemented core（2026-05-30）— Project / Global / Artifact 層、MCP/API、最小 UI、昇格、Make 前ソフトガードは実装済み。残りは `captures/` を含む ZIP export。

---

## 1. 目的

Millrect を「ユーザーの美意識を理解しながら一緒にモノを作る」デスクトップ環境に拡張する。

| やること | やらないこと |
|----------|----------------|
| 判断・価値観の構造化保存 | 会話全文の蓄積 |
| 参考（URL・画像）からの**言語化された**テイスト | ブランドの表層コピー |
| 制作後の学びの記録と Global への**慎重な**昇格 | プロジェクト都合の好みの即 Global 化 |
| キャプチャ付きレビューと採否理由 | いきなり Part DSL / 3D 生成（ソフトガードは設定可能） |

既存の **幾何・製造** 領域（`pages`, `partIntent`, Part DSL, CSG）はそのまま維持し、**なぜそう作るか** を Taste Memory が担う。

---

## 2. Millrect との関係

```
┌─────────────────────────────────────────────────────────────┐
│  Taste Memory（本仕様）                                      │
│  projectBrief · IndexedDB tasteGlobal · artifactLog         │
└──────────────────────────┬──────────────────────────────────┘
                           │ エージェントコンテキスト / ガード
┌──────────────────────────▼──────────────────────────────────┐
│  既存 Millrect ドキュメント                                    │
│  pages[] · partIntent · fonts[] · referenceImage · ghost      │
└──────────────────────────┬──────────────────────────────────┘
                           │ shapeToProfile → CSG → Mesh / STL
└─────────────────────────────────────────────────────────────┘
```

| 既存概念 | 役割 | Taste Memory との関係 |
|----------|------|------------------------|
| `partIntent` | Part DSL、bindings、features | **How**（作り方）。統合しない |
| `pages[].referenceImage` | 下絵・スケール | Project の `tasteRefs` と併用可 |
| `shape.ghost` | digitize 提案 | Artifact 確定前は Profile 対象外（既存どおり） |
| MCP `capture_screenshot` | PNG | Review フェーズの `artifactLog` に紐づけ |
| `DOC_KEYS` | Undo / export | `projectBrief` を含める（実装済み） |

---

## 3. 三層メモリ

### 3.1 Global Memory

**保存:** ブラウザ / Electron とも **IndexedDB** `millrect` DB · `tasteGlobal` オブジェクトストア · レコード id `"global"`  
（プロジェクトの `projects` ストアとは**別**。図面 autosave JSON には含めない）

- プロジェクト export / autosave には**デフォルトで含めない**
- 新規プロジェクト開始時に Global の principles を **コピー** して `projectBrief` 初期値にする（参照ではなくスナップショット）

**格納するもの:** 繰り返し確認された **Principle**（価値観・好みの一文）と **antiPatterns**

**格納しないもの:** チャットログ、参考サイトの HTML、生画像（画像は Project / `captures/`）

### 3.2 Project Memory

**フィールド:** `state.projectBrief`（`DOC_KEYS` に追加）

1 案件の **意図・制約・参考・設計方針・セッション判断**。

**UI:** 右パネル **Pages タブ → 制作メモ** に表示する。ページ設定、参照画像、プロジェクトフォントと同じタブに置き、図面全体の文脈として扱う。

### 3.3 Artifact Memory

**フィールド:** `projectBrief.artifactLog[]` + オプションで `captures/{projectId}/rev-N.png`

図面版・STL 版・レンダリングごとの **変更・評価・採否**。

明示 `revision` と対応づけ、`capture_screenshot` 後のレビュー記録に使う。

---

## 4. データスキーマ

### 4.1 共通型

```ts
/** 価値観・好みの一文。会話の要約ではなく判断として書く */
type Principle = {
  id: string;                    // "p-{uuid}"
  statement: string;             // 例: "装飾より構造が見える形を好む"
  polarity: "prefer" | "avoid";
  scope?: "form" | "material" | "density" | "color" | "haptic" | "process" | "other";
  confidence?: number;           // 0..1、エージェントまたはユーザー調整
  sources?: string[];            // "dialogue:2026-05-28", "ref:url:...", "project:abc"
  promoteBlocked?: boolean;      // true なら Global 昇格しない
};

/** 1 回の採用・却下・修正理由 */
type Judgment = {
  id: string;
  at: string;                    // ISO 8601
  outcome: "accept" | "reject" | "revise" | "note";
  target?: {
    kind: "shape" | "dimension" | "page" | "part" | "capture" | "stl" | "other";
    id?: string;
  };
  reason: string;                // ユーザーまたは AI の短文
  sessionId?: string;
  promoteCandidate?: boolean;    // false で昇格キューに載せない
};
```

### 4.2 `projectBrief`（Project Memory）

```js
projectBrief: {
  version: 1,
  intent?: string,               // 例: "スマホケース"
  constraints?: Record<string, unknown>,  // { phone: "iPhone 15", print: "FDM" }
  tasteRefs?: Array<
    | { type: "url"; url: string; note?: string }
    | { type: "image"; path: string; note?: string }   // プロジェクト相対 or 絶対
    | { type: "brand"; name: string; note?: string }
  >,
  /** この案件で有効な設計方針。Global からコピー + 案件固有 */
  designPrinciples: Principle[],
  /** 対話・レビューで確定した判断ログ */
  decisions: Judgment[],
  /** レビュー・版管理 */
  artifactLog: ArtifactEntry[],
  /** 制作フェーズ（エージェント用。UI 表示は任意） */
  phase?: "discover" | "taste" | "brief" | "make" | "review" | "learn" | "done",
  updatedAt?: string,
}
```

```js
type ArtifactEntry = {
  revision: number;
  at: string;
  trigger: "user_feedback" | "ai_self_review" | "export" | "param_change" | "other";
  capturePath?: string;          // captures/ 以下の相対パス
  meshStatus?: { meshCount: number; message?: string };  // get3DSceneStatus 相当
  evaluation?: {
    aligned?: string[];
    misaligned?: string[];
  };
  outcome?: "accept" | "reject" | "partial";
  linkedJudgmentIds?: string[];
};
```

### 4.3 Global `taste-memory.json`

```js
{
  version: 1,
  principles: Array<Principle & {
    evidenceCount: number;
    projectIds: string[];       // 昇格根拠になったプロジェクト ID
    lastReinforced: string;
  }>,
  antiPatterns: string[],
  meta?: {
    lastMergedAt?: string;
  },
}
```

### 4.4 バージョンと互換

- `projectBrief.version` / `taste-memory.version` を increment してマイグレーション
- 未知フィールドは読み捨て、書き込み時は既知フィールドのみ（forward compatible）

---

## 5. Global 昇格

### 5.1 フロー

```
Project.decisions / designPrinciples
        │
        ▼  extractSessionLearnings（セッション終了 or 明示）
  promotionQueue[]（メモリ上 or userData の一時ファイル）
        │
        ▼  reinforce: 同一 statement の類似が複数 project で出現
  候補 Principle（evidenceCount >= 2）
        │
        ▼  ユーザー承認 or 設定で auto（将来）
  taste-memory.json にマージ
```

### 5.2 類似判定（実装指針）

初版は **完全一致または正規化した statement** のみで `evidenceCount` を増やす。将来、エンベディング類似はオプション。

### 5.3 ブロック条件

- `Judgment.promoteCandidate === false`
- `Principle.promoteBlocked === true`
- ユーザーが UI / MCP で「今回だけ」とマーク

### 5.4 Project から Global へのコピー（案件開始時）

新規プロジェクト作成時、Global の `principles` を **コピー** して `projectBrief.designPrinciples` の初期値にする（参照ではなくスナップショット）。案件内で上書きしても Global は自動更新しない。

---

## 6. 制作フェーズ（ワークフロー）

| Phase | 目的 | アプリの責務 | エージェントの責務 |
|-------|------|--------------|-------------------|
| **discover** | 何を作りたいか | `intent` 記録 | 質問（用途・制約） |
| **taste** | 美意識の理解 | `tasteRefs`, principles 追記 | 雰囲気・ブランド・触り心地の対話 |
| **brief** | 設計方針の合意 | `phase=brief`, principles 確定 | 言語化 → ユーザーが「違う/好き」 |
| **make** | 図面・3D | 既存 MCP / Part DSL | `create_part`, `apply_commands`, … |
| **review** | 見た目の評価 | `capture_screenshot`, `artifactLog` | 自己評価・差分コメント |
| **learn** | 学びの保存 | `decisions` マージ、昇格キュー | セッション要約 JSON |
| **done** | 完了 | `phase=done` | — |

### 6.1 ソフトガード（Make 前）

設定 `requireBriefBeforeMake`（localStorage + UI）が true のとき:

- `projectBrief.phase` が `brief` 未満、または `designPrinciples.length === 0` なら
- MCP `apply_part_dsl` / `create_part` は **警告付き拒否**（上級者は設定で無効化）

上級者は UI 設定で無効化できる。AGENT 手順と Prompt でも brief 先行を推奨する。

---

## 7. 参考解析（ブランド・サイト）

Millrect 内に Vision / クローラは**同梱しない**（digitize sketch と同様、外部 LLM が担当）。

1. ユーザーが URL・画像・ブランド名を提示 → `tasteRefs` に保存
2. エージェントが解析し、**言語化された観察** を `designPrinciples` または一時 `Judgment` として追加  
   例: 「余白は広め」「直線比率が高い」「作り込みすぎない日用品感」
3. ユーザーが修正 → `outcome: revise` の `Judgment` を追加
4. 確定したものだけ `Principle` として残す

**禁止:** 参考ブランドのロゴ・特徴的シルエットの無断複製を推奨するフィールド設計にはしない（`antiPatterns` に「既存ブランドの模倣」を入れられる）。

---

## 8. MCP / API

既存命名: MCP `snake_case` → WS `camelCase`（[MCP-REFERENCE.md](MCP-REFERENCE.md)）。

| MCP ツール | WS action | 説明 |
|-----------|-----------|------|
| `get_taste_context` | `getTasteContext` | Global + `projectBrief` |
| `update_project_brief` | `updateProjectBrief` | `projectBrief` の部分更新（`pushHistory`） |
| `record_decision` | `recordDecision` | `Judgment` 1 件追加 |
| `set_project_phase` | `setProjectPhase` | `phase` のみ更新 |
| `append_session_learnings` | `appendSessionLearnings` | Learn: バッチ + Global 昇格候補 |
| `promote_principle` | `promotePrinciple` | Global へ手動昇格 |
| `list_global_principles` | `listGlobalPrinciples` | Global 一覧 |
| `append_artifact_log` | `appendArtifactLog` | `artifactLog` 追記 |

`get_project_context` のレスポンスには **`briefSummary`**（intent, phase, principles 件数, 直近 decisions）が含まれる。

### 8.1 MCP Resource

| URI | 内容 |
|-----|------|
| `millrect://docs/taste-memory` | 本書 |
| `millrect://prompts/taste_dialog` | Discover / Taste フェーズ用質問テンプレ |
| `millrect://prompts/session_close` | Learn フェーズ要約テンプレ |

---

## 9. ファイル配置

```
IndexedDB "millrect"
├── store "projects"     # 各プロジェクトの JSON 文字列（pages, partIntent, projectBrief, …）
└── store "tasteGlobal"  # { id: "global", data: GlobalTaste, updatedAt }

将来: captures/（Artifact PNG、プロジェクト ZIP 同梱は未実装）
```

プロジェクト export JSON（手動保存・autosave の中身）:

```
projectName, unit, fonts, pages, partIntent, projectBrief
```

`captures/` はバイナリのため、JSON には **相対パス** のみ。プロジェクト移動時はエクスポート ZIP に captures を同梱する案（フェーズ 5 以降）。

---

## 10. プライバシーとエクスポート

| データ | デフォルト export | 説明 |
|--------|-------------------|------|
| `pages`, `partIntent` | 含む | 既存 |
| `projectBrief` | 含む | 案件の判断・参考 URL |
| Global `taste-memory.json` | **含めない** | マシン全体のプロファイル |
| 会話ログ | 保存しない | — |

ユーザー向け: 設定で「プロジェクトに Global principles のスナップショットを含める」は案件開始時コピーで足りる。

---

## 11. 実装フェーズ

| # | 成果物 | 依存 | 状態 |
|---|--------|------|------|
| 1 | `projectBrief` スキーマ、`DOC_KEYS`、export/import | `state.js`, `export.js` | 完了 |
| 2 | `packages/taste-memory.js`（純関数: merge, briefSummary） | — | 完了 |
| 3 | MCP + WS handlers | `main.js`, `mcp/server.js` | 完了 |
| 4 | `get_project_context` 拡張 | `main.js` | 完了 |
| 5 | Global IndexedDB `tasteGlobal` | `db.js` | 完了 |
| 6 | UI: Brief パネル（読み取り） | `ui.js` | 完了 |
| 7 | Review: capture → `artifactLog` | `main.js`, `recordCaptureArtifactLog` | 完了 |
| 8 | `requireBriefBeforeMake` | `part-compiler.js`, UI 設定 | 完了 |

ADR 0001 の Implementation tracking と同期する。

---

## 12. 例: スマホケース（データの流れ）

1. **discover** — `intent: "スマホケース"`, `constraints: { phone: "..." }`
2. **taste** — 対話後 `designPrinciples` に  
   `{ statement: "日用品感は無骨より上", polarity: "prefer", scope: "form" }`
3. **tasteRefs** — `{ type: "url", url: "https://...", note: "余白と直線" }`
4. **brief** — ユーザーが「曲線は少なめ」→ `Judgment` + `Principle` 追加、`phase: "brief"`
5. **make** — `apply_part_dsl` / 手動図面（既存フロー）
6. **review** — `capture_screenshot` → `artifactLog[0]`, `misaligned: ["角が丸すぎ"]`
7. **learn** — `append_session_learnings` →  
   `decisions` に理由追記、類似 principle が 2 案件目で Global 候補

---

## 13. 用語集

| 用語 | 意味 |
|------|------|
| **Taste Memory** | 三層メモリ全体の名称 |
| **Principle** | 再利用可能な価値観・好みの一文 |
| **Judgment** | 1 回の採否・修正理由 |
| **Design Brief** | 案件の `projectBrief` 特に `designPrinciples` + `intent` |
| **Taste Profile** | 対話・参考解析の結果として確定した Principle 集合（Project 上） |
| **昇格** | Project → Global への Principle マージ |

---

## 14. 変更履歴

| 日付 | 変更 |
|------|------|
| 2026-05-28 | 初版（ADR 0001 と同時 Proposed） |
| 2026-05-30 | 実装状況に同期（Global / UI / Review / ガード実装済み、ZIP export のみ残） |
