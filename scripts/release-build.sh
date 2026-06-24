#!/usr/bin/env bash
# Build desktop installers for GitHub Releases.
# Usage: ./scripts/release-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"

echo "==> Millrect release build v${VERSION}"
echo "    Platform: $(uname -s) $(uname -m)"

if [[ ! -f build/icon.icns ]]; then
  echo "[warn] build/icon.icns が見つかりません。electron-builder はデフォルトアイコンを使います。" >&2
  echo "       配布前にアプリアイコンを用意することを推奨します。" >&2
fi

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo ""
echo "==> Artifacts (dist/):"
ls -la dist/ 2>/dev/null || echo "(dist/ が空です)"

cat <<EOF

次のステップ（docs/RELEASE.ja.md 参照）:
  1. dist/ の DMG / インストーラをローカルで動作確認
  2. packages/download-config.js の version / releaseTag / assets を更新
  3. git tag v${VERSION} && git push origin v${VERSION}
  4. GitHub Releases に dist/ をアップロード
  5. npm run build:site  → ../millrect.com に生成し、millrect.com repo を push（Cloudflare 自動デプロイ）

EOF
