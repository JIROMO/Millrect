## Millrect v0.1.10（macOS のみ） / macOS only

3D 書き出しの品質改善と、作図の編集機能を追加したリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A release improving 3D export quality and adding drawing-editing features.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **STL 書き出しの自動クリーンアップ** — 書き出し前に、CSG 由来の退化三角形（面積ゼロの三角形）を除去し、誤差でズレた重複頂点を溶接します。スライサー（Bambu Studio 等）で出ていたトゲ・破れ・非多様体の警告が出にくくなります。
  Automatic mesh cleanup on STL export — degenerate (zero-area) triangles are removed and near-coincident vertices are welded before export, reducing spikes, breaks, and non-manifold warnings in slicers (e.g. Bambu Studio).
- **立体交差（solidIntersect）の UI トグル** — 図形プロパティに「3D（立体交差）」スイッチを追加。側面図など他ビューにしかない穴・輪郭を 3D に反映したいときに ON にできます（従来は内部設定のみ）。
  Solid-intersect 3D toggle — a "3D (solid intersect)" switch in shape properties lets you carve holes/profiles that only exist in another view (e.g. a side view) into the 3D part.
- **図形の重なり順変更** — 選択図形を前面/背面へ移動できます。
  Z-order controls — bring selected shapes forward/backward.
- **図形ロック** — 図形単位でロックし、誤操作を防げます。
  Per-shape lock — lock individual shapes to prevent accidental edits.
- **寸法テキストの SVG / PDF 出力対応** — 寸法線の数値がエクスポート結果でもネイティブ text として正しく出力されます。
  Dimension text in SVG/PDF export — dimension values now export as native text.
- **再描画・キャッシュの高速化** — 描画バージョン管理を見直し、編集中の不要な再計算を抑えました。
  Faster redraw/cache — lighter invalidation reduces unnecessary recomputation while editing.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.10-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.10.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
