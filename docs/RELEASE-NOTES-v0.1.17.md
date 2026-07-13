## Millrect v0.1.17（macOS のみ） / macOS only

v0.1.16 の不具合修正パッチです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A bug-fix patch for v0.1.16.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 修正 / Fixes

- **Alt+ドラッグ複製時の選択枠ズレを修正** — 複製開始直後に選択ハンドルが総移動量ぶんズレて表示される不具合を修正しました。
  Fixed selection handles rendering at the wrong offset immediately after starting an Alt-drag duplicate.
- **Alt+ドラッグ複製に伴う Undo の取りこぼしを修正** — 移動量ゼロの Alt+クリックで見えない複製が確定し、Undo（Cmd+Z）が効いていないように見える不具合を修正しました。
  Fixed invisible duplicates being committed on a zero-movement Alt+click, which made Undo (Cmd+Z) appear unresponsive.
- **Redo ショートカット（Cmd+Shift+Z）が無反応だった不具合を修正**
  Fixed the Redo shortcut (Cmd+Shift+Z) not responding.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.17-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.17.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
