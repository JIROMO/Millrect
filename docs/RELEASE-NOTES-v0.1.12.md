## Millrect v0.1.12（macOS のみ） / macOS only

ペンツール（自由パス）の操作性と、線のスタイル指定まわりを強化したリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A release focused on the pen (freeform path) tool and line styling.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **ペンツールを Figma 風に強化** — Shift で 15° 刻みの角度スナップ、既存の点に揃うスマートガイド（正確な正方形などが描きやすい）、Alt でハンドルを片側だけ折ってコーナーの尖りを調整、ドラッグ中の長さ・角度表示、ペン型カーソルを追加しました。点の編集中も線がリアルタイムで追従し、編集モードはクリック／Enter／Esc で抜けられます。
  A more Figma-like pen tool — Shift snaps direction in 15° steps, smart guides align new points to existing ones (so precise squares are easy), Alt breaks a handle to sharpen a corner, a length/angle readout shows while dragging, and the cursor is now a pen nib. The path now updates live while you drag a point, and you can leave edit mode with a click, Enter, or Esc.
- **自由パスのリサイズに対応** — ベジェパスを選択ハンドルで拡大・縮小できるようになりました（Shift で縦横比固定）。
  Freeform paths can now be resized via the selection handles (hold Shift to keep the aspect ratio).
- **線幅を製図標準に拡張＋線種を追加** — 線幅に ISO 128 の標準値（0.13〜2.0mm）を用意し、線種として実線・破線・点線・一点鎖線を選べるようにしました。
  Realistic line weights and styles — stroke width now offers the ISO 128 set (0.13–2.0 mm), and you can pick solid, dashed, dotted, or dash-dot line styles.
- **パス編集ボタンを回転の下へ移動** — パス／ベジェの編集モード切り替えを、右パネルの回転コントロールの直下に配置して分かりやすくしました。
  The path-edit toggle now sits right under the rotation control in the right panel for easier discovery.
- **数値表示の余分な 0 を削除** — 寸法やサイズの表示から末尾の 0 を省くようにしました（例: `0.50` → `0.5`、`12.00` → `12`）。
  Cleaner numbers — trailing zeros are dropped from size and dimension fields (e.g. `0.50` → `0.5`, `12.00` → `12`).

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.12-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.12.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
