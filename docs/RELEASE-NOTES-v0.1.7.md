## Millrect v0.1.7（macOS のみ） / macOS only

デスクトップ版のメモリ消費を抑える最適化と、メニューの不具合修正を中心としたリリースです。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A release focused on reducing the desktop app's memory usage, plus a menu fix.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **メモリ消費の削減** — 長時間使用時のメモリ使用量を抑える 3 つの最適化を入れました。
  Lower memory usage — three optimizations to keep memory in check during long sessions.
  - 参照画像（下絵）を Undo 履歴に複製しないようにしました。これまでは編集のたびに画像データが履歴へ重複コピーされていました。Undo / Redo の挙動は従来どおりです。
    Reference (sketch) images are no longer duplicated into the Undo history — previously the image data was copied into history on every edit. Undo / Redo behavior is unchanged.
  - 参照画像の取り込み時に自動で縮小・再圧縮するようにしました（配置サイズはこれまでどおり変わりません）。
    Imported reference images are now automatically downscaled and re-compressed (their placement size is unchanged).
  - 3D ビューの描画ループを 3D 表示中のみ動かすようにしました。2D に戻ると停止し、CPU / GPU を消費しません。
    The 3D render loop now runs only while the 3D view is open, and stops when you return to 2D — no more idle CPU / GPU use.
- **「ファイル → 開く...」の修正** — メニューの「開く...（⌘O）」が保存済みプロジェクトの選択モーダルを開くようになりました（以前は新規作成と同じ動作でした）。
  "File → Open…" fix — the menu's Open… (⌘O) now opens the saved-project picker (it previously behaved like New).

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.7-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.7.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
