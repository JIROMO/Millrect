## Millrect v0.2.0（プレリリース・macOS のみ） / Pre-release (macOS only)

**CAD for AI Agent** — Intent API、Part DSL、スケッチ取り込みを追加した機能リリースです。  
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Feature release focused on agent-facing APIs (Intent API, Part DSL, sketch import). **Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **Intent API（MCP）** — `create_multiview_box`, `layout_rect_mm`, `validate_3d_readiness`, `create_part`
- **Part DSL v1 + Solver** — `box` / `panel` / `l_bracket` / `enclosure`、`apply_part_dsl`, `update_part_param`
- **スケッチ取り込み** — 参照画像レイヤー、スケール校正 UI、`digitize_sketch`（ゴースト図形 → 確定）
- **製造ルール検証** — `validate_manufacturability`（レーザー切割向け DSL）
- **ドキュメント MCP** — `list_docs_scenarios`, `run_docs_scenario`, `capture_screenshot`
- **ユーザードキュメント** — スケッチ取り込み、参照画像 UI（[docs](https://millrect.com/docs/drawing.html#sketch-import)）

Philosophy: https://millrect.com/docs/philosophy.html

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.2.0-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.2.0.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等
- テキストの 3D 輪郭化
- 参照画像ファイルの MCP 読込（`load_reference_image`）

ブラウザ版 / Browser app: https://millrect.com/app/
