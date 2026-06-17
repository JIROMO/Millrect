## Millrect v0.1.8（macOS のみ） / macOS only

デスクトップ版とブラウザ版の体感速度を改善する、パフォーマンス中心のリリースです。3D プレビューや STL 書き出しなど重い処理を Worker 化し、初期読み込みと 2D 描画の負荷も抑えました。
**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

A performance-focused release for both the desktop and browser app. Heavy 3D preview and STL export work now runs in Workers, with lighter initial loading and cheaper 2D rendering.
**Not code-signed or notarized** — macOS may show a security warning on first launch.

### 主な変更 / Highlights

- **3D / STL 処理の Worker 化** — 3D モデル生成、3D シーン構築、STL 書き出しをメインスレッドから分離しました。複雑な図面でも UI が固まりにくくなります。
  Workerized 3D / STL pipeline — 3D model generation, scene construction, and STL export now run off the main thread, keeping the UI more responsive on complex drawings.
- **初期読み込みの軽量化** — PDF 書き出し、3D、ヘルプ検索用の重いライブラリを必要になるまで読み込まないようにしました。アプリ起動直後の読み込み量を減らしています。
  Lighter initial load — heavy libraries for PDF export, 3D, and help search are now loaded only when needed, reducing startup work.
- **2D 再描画の高速化** — SVG レンダリングの変更検知を軽くし、図形全体を毎回シリアライズしない方式に変えました。編集中の不要な再描画を減らします。
  Faster 2D redraw checks — SVG render invalidation now uses lightweight render versions instead of repeatedly serializing whole shapes.
- **ビルドスクリプトの安全化** — macOS 向けネイティブ輪郭化バイナリのビルド処理を、文字列コマンド実行から引数配列ベースの実行に変更しました。
  Safer build script — the macOS native outline helper build now invokes `swiftc` with explicit argument arrays instead of a shell command string.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.8-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.8.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

### デスクトップ版の追加機能 / Desktop-only features

- AI 連携（MCP）— Claude Desktop / Cursor 等 / AI integration (MCP)
- テキストの 3D 輪郭化 / Text-to-3D outline conversion

ブラウザ版 / Browser app: https://millrect.com/app/
