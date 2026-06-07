## Millrect v0.1.2（プレリリース・macOS のみ） / Pre-release (macOS only)

3D プレビューの不具合修正と、多ビューでの積層表現を改善したパッチリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Patch release fixing 3D preview issues and improving multi-view layer stacking.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **3D の左右反転を修正** — 上面図（top view）から生成した 3D が鏡像になっていた問題を修正。図面どおりの向きで表示されます。
  Fixed 3D from the top view rendering mirror-flipped; it now matches the drawing.
- **多ビューの色別積層** — 正面図などで色ごとに高さ（レイヤー）を定義でき、「赤を上・青を下」のような積層モデルを生成できます。
  Color-based stacking across views — define per-color elevation in the front view to build layered models (e.g. red on top, blue on bottom).
- **複雑な輪郭の面落ちを解消** — コーム/スロット等の複雑な輪郭でも、積層時に形状が欠けないよう高さ決定を CSG 交差から直接押し出しに変更。
  Complex outlines (combs/slots) no longer lose faces when stacked (height clamp now uses direct extrusion instead of CSG intersection).

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.2-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.2.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
