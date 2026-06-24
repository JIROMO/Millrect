# Desktop release procedure

**日本語:** [RELEASE.ja.md](RELEASE.ja.md)

Checklist for unsigned pre-release distribution. Apple Developer Program ($99/year) and Windows code signing are not required, but users will see OS security warnings on first launch — document that in [desktop-download.html](en/desktop-download.html).

## Prerequisites

- Building on macOS: Xcode Command Line Tools (`swiftc`) for the Core Text outline binary
- Windows installers are most reliably built **on Windows** with `npm run build`
- Recommended: `build/icon.icns` (macOS icon). Build succeeds without it

## 1. Bump version

Update `version` in `package.json` (e.g. `0.1.0` → `0.1.1`).

## 2. Build

```bash
chmod +x scripts/release-build.sh
./scripts/release-build.sh
```

Artifacts in `dist/`:

| File | Platform |
|------|----------|
| `Millrect-{version}-arm64.dmg` | macOS (Apple Silicon) |
| `Millrect-{version}.dmg` | macOS (Intel) |
| `Millrect Setup {version}.exe` | Windows (64-bit) |

## 3. Smoke test

- [ ] Launch from DMG / installer
- [ ] New project, draw shapes, 3D preview
- [ ] macOS: unsigned warning → Right-click **Open** works (same as user docs)
- [ ] (Optional) MCP while Millrect is running

## 4. Update download links

Edit `packages/download-config.js` to match `package.json`:

- `version`, `releaseTag` (e.g. `v0.1.1`)
- `assets.*` filenames

## 5. GitHub Release

Tag `v0.1.x`, upload `dist/` artifacts, note unsigned macOS-only distribution in **Japanese and English** release notes (template: [`RELEASE-NOTES-TEMPLATE.md`](RELEASE-NOTES-TEMPLATE.md)).

## 6. Deploy site

```bash
npm run build:site    # assemble deploy set into ../millrect.com/
```

Commit and push the adjacent `millrect.com` repository to trigger the Cloudflare
deployment. The deploy set is defined once in `scripts/site-manifest.js`. Set:
`index.html`, `en/`, `robots.txt`, `sitemap.xml`, `favicon.ico`, `site/`, `app/`,
`packages/`, `samples/`, `docs/`.

## Later (production distribution)

- Apple Developer ID + notarization
- Windows code signing
- Auto-update via `electron-updater`
