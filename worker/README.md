# Millrect Hono Worker

Millrect のWebアプリ、ドキュメント、リモートMCPを1つのCloudflare Workerで配信します。

## ルート

- `/`, `/app/*`, `/docs/*`, `/site/*`, `/packages/*` — 静的アセット
- `/mcp?session=<id>` — MCP Streamable HTTP
- `/mcp/ws?session=<id>` — ブラウザタブ用WebSocket
- `/health` — ヘルスチェック

MCP HTTPは公式 `@modelcontextprotocol/hono` アダプターと
`@modelcontextprotocol/server` v2を使用します。2026-07-28仕様と2025系の
stateless Streamable HTTPクライアントの両方を受け付けます。

```text
MCP client
    │ HTTPS /mcp?session=...
    ▼
Hono Worker
    │ Durable Object RPC
    ▼
SessionRelay ── WebSocket /mcp/ws?session=... ── browser tab
```

1つの `SessionRelay` Durable Objectが1つのペアリングセッションを担当します。
WebSocketはHibernation APIを使い、MCPツール呼び出しをブラウザ内のIntent APIへ中継します。

## ローカル開発

リポジトリルートで実行します。

```bash
npm install
npm --prefix worker install
npm run build:site
npm run dev
```

`npm run dev` は `dist/site` の静的アセットとWorkerを既定のWrangler開発URLで配信します。
ブラウザで `/app/` を開き、エージェント接続パネルから接続を開始してください。

## 検証

```bash
npm --prefix worker run cf-typegen
npm --prefix worker run typecheck
npm run build
```

## デプロイ

```bash
npm run deploy
```

Cloudflare認証と、`millrect.com` がこのWorkerへ向く設定が必要です。ペアリングURLは
現在のブラウザプロジェクトを操作できる接続キーなので、公開せず必要に応じて再発行してください。

## Web版で提供しない旧デスクトップ専用機能

任意ローカルパスを読む `load_reference_image` / `import_part_dsl_file` と、Electronの
ネイティブキャプチャに依存する `capture_screenshot` はリモートMCPへ公開しません。
参照画像はブラウザUIのファイル選択から読み込みます。
