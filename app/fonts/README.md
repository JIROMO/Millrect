# Bundled fonts

Millrect uses **[Gen Interface JP](https://gen.typesetting.jp/)** (SIL OFL 1.1) as the sole bundled typeface for UI, in-app text, docs, and the landing page.

## Files

| Path | Format | Use |
|------|--------|-----|
| `app/fonts/GenInterfaceJP-Regular.ttf` | TTF | App UI, HarfBuzz / Core Text text engine |
| `app/fonts/GenInterfaceJP-Bold.ttf` | TTF | Bold weight |
| `docs/fonts/*.woff2` | WOFF2 | Documentation site |
| `site/fonts/*.woff2` | WOFF2 | millrect.com landing page |

Version: **0.5.0** (see [releases](https://github.com/yamatoiizuka/gen-interface-jp/releases)).

## Fetch / update

Font binaries may not be committed to Git. After clone:

```bash
npm run fonts:fetch
```

This downloads TTF into `app/fonts/` and WOFF2 into `docs/fonts/` and `site/fonts/`.

Project fonts added via Google Fonts / Fontsource at runtime are subject to their respective licenses.

## 日本語

同梱フォントは **Gen Interface JP** のみです。

初回セットアップ:

```bash
npm run fonts:fetch
```
