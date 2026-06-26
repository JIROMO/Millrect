## Millrect v0.1.13（macOS のみ） / macOS only

大きな図面での2D編集とSTL書き出しを軽くする、パフォーマンス中心のリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A performance-focused release that makes 2D editing and STL export lighter on larger drawings.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **図形移動中の描画を軽量化** — ドラッグ中は既存SVGノードへ `translate` を適用し、確定時も動いた図形だけを差分更新するようにしました。複数選択の選択枠・サイズ表示もtransformで追従します。
  Lighter shape dragging — selected SVG nodes now move via `translate` while dragging, and finalization updates only the moved shapes. Multi-selection outlines and size badges follow with the same transform path.
- **スナップ計算を間引き・キャッシュ** — 移動ドラッグ中のキーポイントスナップは候補点をキャッシュし、細かなポインタ移動では直前結果を再利用します。
  Cached keypoint snapping — snap candidates are cached during move drags, and tiny pointer movements reuse the previous result.
- **レンダリングrootを分離** — 用紙、グリッド、図形、選択枠、プレビュー、スナップ表示を別rootに分け、不要なDOM再生成を抑えました。
  Split render roots — paper, grid, shapes, selection handles, previews, and snap markers now update independently to reduce unnecessary DOM churn.
- **viewport cullingを追加** — 大量図形時は画面周辺の図形だけを描画対象にしつつ、選択中の図形は常に表示します。
  Viewport culling — large drawings render only shapes near the visible area while always keeping selected shapes visible.
- **STL書き出しをWasm化** — STLのbinary書き出しにWasm経路を追加し、Wasmが使えない場合は従来のThree.js ASCII STLへフォールバックします。
  WASM STL export — binary STL export now uses a small WASM writer, with the previous Three.js ASCII exporter as a fallback.
- **スナップ残像を修正** — 図形移動中にクリック位置の小さなスナップマーカーが残る違和感を解消しました。
  Fixed snap-marker residue while moving shapes.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.13-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.13.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
