## Millrect v0.1.16（macOS のみ） / macOS only

v0.1.15 の不具合修正パッチです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A bug-fix patch for v0.1.15.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 修正 / Fixes

- **単一図形の整列が用紙の左上に寄る不具合を修正** — 用紙サイズ（mm）を実寸（real units）に変換する際の係数抜けにより、図形が1つだけ選択された状態で「右揃え」「下揃え」等を行うと、用紙全体ではなく左上 1/10 の領域を基準に揃ってしまっていました。
  Fixed single-shape alignment sticking to the top-left — a missing unit conversion factor caused "align right"/"align bottom" (etc.) on a single selected shape to use only the top-left 1/10 of the paper as the reference area instead of the full sheet.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.16-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.16.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
