## Millrect v0.1.9（macOS のみ） / macOS only

ブール演算の回転バグ修正と、2D 編集時の体感速度を改善するメンテナンスリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A maintenance release fixing a rotation bug in boolean operations and improving responsiveness during 2D editing.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **修正: 回転した図形のブール演算（結合・差し引き）** — 回転（または反転）した図形を結合・差し引きすると、回転が二重に適用されていました。90° は 180°（＝見た目が回転前に戻る）、45° は 90° など誤った角度になり、回転コピーから L 字などを作れませんでした。輪郭への変換適用を 1 回だけにして修正し、回帰テストを追加しました。
  Fixed boolean operations on rotated shapes — union/subtract on a rotated (or flipped) shape applied the rotation twice, so 90° became 180° (looked un-rotated), 45° became 90°, etc. This made it impossible to build shapes like an L-angle from a rotated copy. The transform is now applied once; a regression test was added.
- **改善: 2D 編集中の 3D 自動再生成を抑制** — 2D の再描画ごとに走っていた重い 3D（CSG）再生成をやめ、3D ボタンで表示／再選択したときに限定しました。あわせて再生成のディレイを延ばし（300→800ms）、ドラッグ操作中は再生成をスキップします。編集中の「もっさり感」を軽減します。
  Smoother 2D editing — the heavy 3D (CSG) regeneration that ran on every 2D redraw is now triggered only when the 3D view is opened/reselected. The debounce was lengthened (300→800ms) and regeneration is skipped while dragging, reducing lag during edits.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.9-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.9.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
