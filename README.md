# Millrect

[![License: MIT](https://img.shields.io/github/license/JIROMO/Millrect)](LICENSE)
[![Website](https://img.shields.io/badge/website-millrect.com-5965f9)](https://millrect.com/)
[![Docs](https://img.shields.io/badge/docs-user%20guide-71717a)](docs/en/index.html)

**日本語:** [README.ja.md](README.ja.md)

**Draw orthographic views in 2D — Millrect derives 3D and STL for 3D printing.**

Millrect is a lightweight, browser-based CAD app. You edit **2D drawings** on paper; **3D is regenerated** from top, front, and side views. No install needed.

## Try 3D

1. Open **[millrect.com/app/](https://millrect.com/app/)**
2. Create a new project
3. Click **3D** in the toolbar
4. **Export STL** from the 3D panel

Step-by-step guide: [`docs/en/getting-started.html`](docs/en/getting-started.html#first-stl)

## Documentation

| Audience | Link |
|----------|------|
| **Using Millrect** | [User guide (EN)](docs/en/index.html) · [ユーザーガイド (JA)](docs/index.html) |
| **Developing / AI agents** | [Developer guide (EN)](docs/en/developer.html) · [開発者ガイド (JA)](docs/developer.html) |
| **AI setup (optional)** | [AI / MCP](docs/en/ai-mcp.html) · [`AGENT.md`](AGENT.md) · MCP tools [`docs/MCP-REFERENCE.md`](docs/MCP-REFERENCE.md) |
| **Product story** | [millrect.com/docs/philosophy.html](https://millrect.com/docs/philosophy.html) |

## Run locally

**Browser** | [millrect.com/app/](https://millrect.com/app/) — no install

```bash
npm install
npm --prefix worker install
npm run fonts:fetch   # Gen Interface JP (required for text / UI)
npm run dev           # Hono + Cloudflare Workers dev server
npm run build         # build the web deployment into dist/
```

## Language

UI language: **Pages panel → Page settings → Language** (`ja` / `en`). Docs use the header JA / EN switch and stay in sync with the app.

## Support the project

If Millrect is useful, consider sponsoring via the **Sponsor** button on this repository — [GitHub Sponsors for JIROMO](https://github.com/sponsors/JIROMO).

## License

[MIT License](LICENSE) — [JIROMO](https://github.com/JIROMO). Bundled UI typeface: [Gen Interface JP](https://gen.typesetting.jp/) ([SIL OFL 1.1](app/fonts/README.md)).
