## Millrect v0.1.11（macOS のみ） / macOS only

寸法線の選択操作と、図面が複雑なとき・グループを扱うときの体感速度を改善するメンテナンスリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A maintenance release improving dimension-line selection and responsiveness with complex drawings and groups.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **改善: 寸法線が選びやすくなりました** — 寸法線のクリック判定をズームに依存しない一定幅にし、見えている線・数字をそのままクリックして選択できるようにしました。選択枠に出ていた意味のない「幅×高さ」表示（寸法線は面積を持たないため）を非表示にし、縦／横の寸法線は始点・終点を自動で軸に揃えて斜めにならないようにしました。
  Easier dimension selection — the click target now has a constant on-screen width regardless of zoom, so you can select a dimension by clicking its visible line or number. The meaningless width×height badge (a dimension has no area) is hidden, and vertical/horizontal dimensions are auto-snapped to their axis so they no longer end up slightly diagonal.
- **改善: グループ・複雑な図面での動作を高速化** — グループ移動を毎フレームのジオメトリ複製・DOM 再生成なしで動かすようにし、スナップ計算の候補をキャッシュ＋グループは外周のみ・近傍線分に上限を設けることで、頂点の多い図面でもマウス操作の引っかかりを大きく減らしました。
  Faster groups and complex drawings — group dragging no longer deep-clones geometry or rebuilds the DOM every frame, and snapping now caches its candidate geometry, treats groups as a single bounding box, and caps nearby segments. This greatly reduces lag when moving the mouse over vertex-heavy drawings.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.11-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.11.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
