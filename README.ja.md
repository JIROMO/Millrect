# Millrect

[![License: MIT](https://img.shields.io/github/license/JIROMO/Millrect)](LICENSE)
[![Release](https://img.shields.io/github/v/release/JIROMO/Millrect)](https://github.com/JIROMO/Millrect/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/JIROMO/Millrect/total)](https://github.com/JIROMO/Millrect/releases)
[![Website](https://img.shields.io/badge/website-millrect.com-5965f9)](https://millrect.com/)
[![Docs](https://img.shields.io/badge/docs-ユーザーガイド-71717a)](docs/index.html)

**English:** [README.md](README.md)

**2D の正投影図を描くと、3D と STL を導出する軽量 CAD（3D プリント向け）。**

Millrect はブラウザまたは macOS デスクトップで使えます。**2D 図面**が本体で、上面・正面・側面などから **3D を再生成**します。

## 試してみる

1. **[millrect.com/app](https://millrect.com/app/)** を開く
2. 新規プロジェクトを作成
3. ツールバーの **3D** をクリック
4. 3D パネルで **STL出力**

手順付きガイド: [`docs/getting-started.html`](docs/getting-started.html#first-stl)

## ドキュメント

| 対象 | リンク |
|------|--------|
| **使い方** | [ユーザーガイド](docs/index.html) · [User guide (EN)](docs/en/index.html) |
| **開発・AI 連携** | [開発者ガイド](docs/developer.html) · [Developer guide (EN)](docs/en/developer.html) |
| **AI 設定（任意）** | [AI 連携](docs/ai-mcp.html) · [`AGENT.ja.md`](AGENT.ja.md) · MCP 一覧 [`docs/MCP-REFERENCE.md`](docs/MCP-REFERENCE.md) |
| **プロダクト思想** | [millrect.com/docs/philosophy.html](https://millrect.com/docs/philosophy.html) |

## 起動

| | |
|---|---|
| **ブラウザ** | [millrect.com/app](https://millrect.com/app/) — インストール不要 |
| **デスクトップ** | [GitHub Releases](https://github.com/JIROMO/Millrect/releases) から macOS DMG（[インストール手順](docs/desktop-download.html)） |

```bash
npm install
npm run fonts:fetch   # Gen Interface JP（テキスト・UI に必要）
npm run dev           # 開発（Electron）
npm run build         # パッケージビルド（dist/）
```

リリース手順（メンテナ向け）: [`docs/RELEASE.ja.md`](docs/RELEASE.ja.md)

## 言語

UI 言語: **ページパネル → ページ設定 → 言語**（`ja` / `en`）。ドキュメントはヘッダーの JA / EN で切り替え（アプリと連動）。

## 支援

Millrect が役に立ったら、リポジトリの **Sponsor** から支援できます — [GitHub Sponsors（JIROMO）](https://github.com/sponsors/JIROMO)。

## ライセンス

[MIT License](LICENSE) — [JIROMO](https://github.com/JIROMO)。同梱 UI 書体: [Gen Interface JP](https://gen.typesetting.jp/)（[SIL OFL 1.1](app/fonts/README.md)）。
