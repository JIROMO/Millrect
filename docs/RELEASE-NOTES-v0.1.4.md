## Millrect v0.1.4（プレリリース・macOS のみ） / Pre-release (macOS only)

多ビュー図面からの 3D 生成が、フィーチャー数の多い図面（穴抜き型など）でハングしていた問題を修正したパッチリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Patch release that fixes a hang during 3D generation on drawings with many features (e.g. punching dies).
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **3D 生成のハングを修正** — 穴やフィーチャーが多い図面（例: 穴抜き型）で 3D 生成が終わらず固まる問題を修正。CSG のブール和がフィーチャー数に対して指数的に膨張していたのを、線形時間の処理に置き換えました。数十〜百個の穴を持つ図面でも即座に 3D が生成されます。
  Fixed 3D generation hang — drawings with many holes/features (e.g. punching dies) no longer freeze during 3D generation. The CSG boolean-union step, which blew up super-linearly with feature count, was replaced with a linear-time path; parts with dozens to hundreds of holes now generate instantly.
- **スターター/ドキュメント図面の塗り色を統一** — アプリ内の 3D サンプルで出ていた色不一致の高さ近似警告が解消されました。
  Unified fill colors in starter/docs drawings — resolves the color-mismatch height-approximation warning previously shown on the in-app 3D sample.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.4-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.4.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
