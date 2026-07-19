## Millrect v0.1.18（macOS のみ） / macOS only

複数選択の一括回転の追加と、日本語テキスト描画の修正一式です。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Adds multi-selection rotation and a set of Japanese text rendering fixes.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 新機能 / Features

- **複数選択の一括回転** — 複数の図形を選択したまま、選択枠のコーナー外周をドラッグして一括回転できるようになりました。回転の中心は選択中で一番大きい図形の中心です。各図形は相対配置を保ったまま回転し、Shift で 15° スナップ、Undo は 1 回でまとめて戻ります。
  Rotate multiple selected shapes at once by dragging just outside the selection corners. The pivot is the center of the largest selected shape; relative layout is preserved, Shift snaps to 15°, and a single Undo reverts the whole rotation.
- **円の直径入力** — プロパティパネルで円の直径を直接入力できるようになりました（半径と連動）。
  Circles can now be edited by diameter in the properties panel (kept in sync with radius).

### 修正 / Fixes

- **漢字の画の重なりが白く抜ける不具合を修正** — 「切」「必」など画が交差する文字で、重なり部分が穴として抜けて表示・出力される不具合を修正しました（輪郭ネスト判定の誤認）。
  Fixed overlapping strokes in kanji like 「切」 being punched out as holes in display and outline output (contour nesting misclassification).
- **文字が表示されず選択枠だけになる不具合を修正** — テキスト設置直後にアウトライン化が失敗すると、サイズを変えるまで文字が描画されない問題を修正しました。生成中・失敗時は通常のテキスト表示で代替し、自動で再試行します。
  Fixed text becoming invisible (selection box only) when outline generation failed right after placement. The app now falls back to DOM text and retries automatically.
- **英数字と日本語の混植でアルファベットが浮く不具合を修正** — 「AはRです」のような行で英字と日本語のベースラインがずれる問題を修正しました。
  Fixed Latin characters sitting higher than Japanese text on mixed lines like 「AはRです」 (per-run baseline mismatch).
- **デスクトップ版が標準フォントで描画されない不具合を修正** — テキスト描画が同梱フォント（Gen Interface JP）ではなく OS フォントに置換されていた問題を修正し、ブラウザ版と同じ字形になりました。プロジェクトフォントもデスクトップ版のアウトライン化で正しく使われます。
  Fixed the desktop app silently substituting OS fonts instead of the bundled Gen Interface JP — glyphs now match the browser app, and project fonts are honored in desktop outline generation.
- **複数選択リサイズの座標計算を修正** — 複数図形の一括リサイズで座標系の混在によりサイズがずれる不具合を修正しました。
  Fixed multi-selection resize drifting due to mixed coordinate units.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.18-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.18.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
