## Millrect v0.1.6（macOS のみ） / macOS only

手早くメモを描ける **鉛筆（フリーハンド）ツール** を追加した機能リリースです。あわせて Undo 履歴の処理を軽量化しました。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Feature release adding a **freehand Pencil tool** for quick sketch-style notes, plus a lighter-weight Undo history implementation.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **鉛筆ツール** — ツールバーに鉛筆（ショートカット **P**）を追加。ドラッグした軌跡をそのまま 1 本の線として描けます。スナップは効かせず、Catmull-Rom スプラインで滑らかに整形するので、ラフなメモ書きに向きます。Design タブで線幅（mm）を調整でき、描いたあともツールは鉛筆のまま続けて描けます。
  Pencil tool — a pencil (shortcut **P**) is added to the toolbar. Drag to draw your cursor path as a single freehand stroke. It ignores snapping and smooths the path with a Catmull-Rom spline, making it well suited to rough notes. Line width (mm) is adjustable in the Design tab, and the tool stays selected so you can keep sketching.
- **Undo 履歴の軽量化** — 編集のたびにドキュメント全体を構造化クローンしていた処理をやめ、文字列スナップショットのみを保持するようにしました。動作は同じまま、編集時のメモリと CPU の負荷を削減します。
  Lighter Undo history — instead of deep-cloning the whole document on every edit, history now keeps only string snapshots. Behavior is unchanged, with reduced memory and CPU overhead per edit.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.6-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.6.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
