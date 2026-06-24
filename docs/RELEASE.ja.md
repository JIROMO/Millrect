# デスクトップ版リリース手順

**English:** [RELEASE.md](RELEASE.md)

未署名のプレリリース配布向けチェックリストです。**現状は macOS（DMG）のみ GitHub Releases に公開**しています。

## 前提

- macOS でビルドする場合: Xcode Command Line Tools（`swiftc`）— macOS 向け Core Text 輪郭バイナリ用
- Windows 向けインストーラは **Windows 上** で `npm run build` するのが確実
- 推奨: `build/icon.icns`（macOS アイコン）。無くてもビルドは通る

## 1. バージョン更新

`package.json` の `version` を更新（例: `0.1.0` → `0.1.1`）。

## 2. ビルド

```bash
chmod +x scripts/release-build.sh
./scripts/release-build.sh
```

または:

```bash
npm ci
npm run build
```

成果物（`dist/`）:

| ファイル | 対象 |
|----------|------|
| `Millrect-{version}-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-{version}.dmg` | macOS（Intel） |
| `Millrect Setup {version}.exe` | Windows（64-bit） |

## 3. 動作確認

- [ ] DMG / インストーラから起動できる
- [ ] 新規プロジェクト作成、図形描画、3D プレビュー
- [ ] macOS: 未署名警告 → 右クリック「開く」で起動できる（[desktop-download.html](desktop-download.html) と同じ手順）
- [ ] （任意）MCP: Millrect 起動中に `node mcp/server.js` または同梱パスで Claude Desktop 接続

## 4. ダウンロードリンクの更新

`packages/download-config.js` を `package.json` の version に合わせて更新:

- `version`
- `releaseTag`（例: `v0.1.1`）
- `assets.macArm64` / `assets.macX64`（ファイル名）

## 5. GitHub Release

```bash
git add package.json packages/download-config.js
git commit -m "chore: release v0.1.x"
git tag v0.1.x
git push origin main
git push origin v0.1.x
```

GitHub の **Releases → Draft a new release** から:

1. Tag: `v0.1.x`
2. Title: `Millrect v0.1.x`
3. `dist/` 内の DMG と `.exe` を Assets に添付
4. 本文に変更点と「未署名・macOS のみ」を**日本語と英語**で記載（テンプレート: [`RELEASE-NOTES-TEMPLATE.md`](RELEASE-NOTES-TEMPLATE.md)）

## 6. サイト反映

```bash
npm run seo:sitemap
npm run build:site    # 配信物を ../millrect.com/ に生成
```

隣接する `millrect.com` repo を commit / push すると Cloudflare へ自動デプロイされます。配信物の定義は `scripts/site-manifest.js` が唯一の真実の源。対象: `index.html`, `en/`, `robots.txt`, `sitemap.xml`, `favicon.ico`, `site/`, `app/`, `packages/`, `samples/`, `docs/`。

## 将来（本格配布時）

- Apple Developer Program → Developer ID 署名 + 公証
- Windows コード署名証明書 → SmartScreen 対策
- `electron-updater` による自動更新
