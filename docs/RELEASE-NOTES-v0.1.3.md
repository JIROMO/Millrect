## Millrect v0.1.3（プレリリース・macOS のみ） / Pre-release (macOS only)

作図操作（ビューガイド・回転・スナップ・選択）を大きく改善したパッチリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Patch release with major drawing-interaction improvements (view guides, rotation, snapping, selection).
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **ビューガイド（見通し線）** — 他ページの正投影ビューの輪郭位置を、共有する 3D 軸に沿って現在ページへ破線ガイドとして投影。ガイドへのスナップにも対応し、多ビュー間で寸法を揃えやすくなりました（ページ設定でオン/オフ）。
  View guides — outlines from other orthographic views are projected onto the current page as dashed guides along shared 3D axes, with snapping, making it easy to keep dimensions consistent across views (toggle in page settings).
- **キャンバス上で回転** — 選択枠コーナーの外周をドラッグして図形を直接回転（Shift で 15° スナップ）。回転・反転した図形のリサイズも正しく動作します。
  On-canvas rotation — drag just outside a corner handle to rotate (Shift snaps to 15°). Resizing rotated/flipped shapes now works correctly.
- **正確なクリック選択** — bbox ではなく実形状（塗り・輪郭）で当たり判定。円の四隅や重なった図形の誤選択がなくなりました。
  Geometry-aware selection — hit testing uses the actual shape (fill/outline) instead of its bounding box; no more mis-picks at circle corners or with overlapping shapes.
- **移動中のキーポイントスナップ** — 図形のドラッグ中、端点・中心が他図形のスナップ点へ吸着します。
  Keypoint snapping while moving — endpoints and centers of the dragged shape snap to other shapes' snap points.
- **Alt+ドラッグ複製と ⌘D 繰り返し** — Alt+ドラッグで複製した変位を ⌘D が繰り返します。
  Alt+drag duplicate with ⌘D repeat — ⌘D repeats the same displacement as the last Alt+drag duplicate.
- **図形ロックと「混在」表示** — 図形単位のロックに対応。複数選択時、値が異なるプロパティは「混在」と表示されます。
  Per-shape locking, and mixed-value properties now show "Mixed" during multi-selection.
- **3D の高さ近似警告** — 直交ビューに同じ塗り色の輪郭が無く高さを図面全体で近似した場合、3D パネルに警告を表示します。
  3D panel now warns when a view lacks a matching fill color and the height was approximated by the overall drawing height.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.3-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.3.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
