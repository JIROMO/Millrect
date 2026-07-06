## Millrect v0.1.15（macOS のみ） / macOS only

作図機能・出力形式・AI 連携（MCP）を大きく広げる機能リリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A feature release that expands drawing tools, export formats, and AI (MCP) integration.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **DXF 出力** — レーザーカッター・CNC・他 CAD 連携向けに、現在ページを DXF（R12 互換の最小サブセット: LINE / CIRCLE / POLYLINE）で書き出せます。ツールバーの SVG 出力の隣に追加。回転・反転も反映されます。
  DXF export — export the current page as DXF (minimal R12-compatible subset: LINE / CIRCLE / POLYLINE) for laser cutters, CNC, and CAD interchange. Next to SVG export in the toolbar. Rotation/flip are baked in.
- **3MF 出力** — 3D パネルに STL と並んで 3MF 書き出しを追加。3MF は単位情報（mm）を持つため、スライサーでのスケール事故を防げます。
  3MF export — alongside STL in the 3D panel. 3MF carries unit info (mm), preventing scale mistakes in slicers.
- **寸法値で図形を編集（パラメトリックの第一歩）** — 寸法の「上書き値」を書き換えると、寸法端点に一致する図形の頂点（矩形の角・円の半径など）が実際に動きます。一致しない場合は従来どおり表示のみの上書きです。
  Dimension-driven editing — editing a dimension's override value now moves the matching shape vertex (rect corners, circle radius, etc.). Falls back to display-only override when no vertex matches.
- **フィレット / 面取り** — パス図形の全頂点に、指定半径の丸め（円弧）または面取り（直線カット）を一括適用できます（Design パネル）。
  Fillet / chamfer — round or chamfer all corners of a path shape at once with a given radius (Design panel).
- **計測ツール（M）** — 寸法線を置かずに 2 点間の距離と角度をステータスバーで確認できます。スナップも効きます。図面には何も追加されません。
  Measure tool (M) — check distance and angle between two points in the status bar without placing a dimension. Snapping works; nothing is added to the drawing.
- **拘束を 4 種追加** — distance（2点間距離）/ radius（半径固定）/ angle（角度）/ concentric（同心）。
  Four new constraints — distance, radius, angle, and concentric.
- **AI 作図の自動配置** — MCP / エージェント経由で描いた図形が左上に張り付かなくなりました。空のページでは用紙中央に、既存の図面がある場合は重ならない空きスペースに自動配置されます（穴あけなど意図的な重ね配置はそのまま維持）。
  Auto-placement for AI drawing — shapes drawn via MCP/agents no longer stick to the top-left corner. Batches are centered on empty pages and moved to free space when they would collide with existing drawings (intentional overlays like holes are kept in place).
- **細かな修正** — ペン（B）のキーボードショートカットが効かなかった問題、WS/MCP 操作の一部が失敗しても成功と報告される問題を修正。ブール演算などの失敗はトースト通知で表示されるようになりました。参照画像付きプロジェクトの自動保存も軽くなっています。
  Small fixes — the pen tool's B shortcut now works; several WS/MCP operations no longer report success on failure; failed boolean operations show a toast; autosave is lighter for projects with reference images.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.15-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.15.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
