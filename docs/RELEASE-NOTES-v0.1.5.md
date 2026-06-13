## Millrect v0.1.5（macOS のみ） / macOS only

複数プロジェクトを同時に開ける **プロジェクトタブ** と、同じ種類の図形をまとめてサイズ変更できる **一括サイズ編集** を追加した機能リリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Feature release adding **project tabs** for working on several projects at once, and **bulk size editing** for resizing shapes of the same type together.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **プロジェクトタブ** — ツールバー下にブラウザ風のタブが並び、複数プロジェクトを同時に開いて切り替えられます。＋ で新規タブ、× / 中クリックで閉じる。コピー＆ペーストはタブをまたいで使えます。メモリ節約のため Undo 履歴を保持するのはアクティブなタブ 1 枚のみで、切り替えると元のタブの履歴はリセットされます（図面は自動保存で保持）。
  Project tabs — browser-style tabs below the toolbar let you keep multiple projects open and switch between them. Open with +, close with × / middle-click. Copy & paste works across tabs. To save memory, only the active tab keeps its Undo history; switching tabs resets the other tab's history (drawings are kept via autosave).
- **一括サイズ編集** — 同じタイプの図形を 2 つ以上選択すると Design タブに「サイズ（一括）」が表示され、半径・幅・高さ・文字サイズなどをまとめて適用できます（例: 複数の円の半径を一度に揃える）。値がバラバラなら「混在」と表示。
  Bulk size editing — select two or more shapes of the same type and a "Size (bulk)" section in the Design tab applies radius / width / height / font size to all of them at once (e.g. set several circles to the same radius). Differing values show as "Mixed".
- **ズーム上限を拡大** — キャンバスの最大ズーム倍率を 30× から 50× に引き上げました。
  Higher zoom limit — maximum canvas zoom raised from 30× to 50×.

### ドキュメント / Documentation

- プロジェクトタブ / Project tabs: https://millrect.com/docs/interface.html#project-tabs （[English](https://millrect.com/docs/en/interface.html#project-tabs)）
- 一括サイズ編集 / Bulk size editing: https://millrect.com/docs/editing.html#bulk-size （[English](https://millrect.com/docs/en/editing.html#bulk-size)）

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.5-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.5.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
