# OpenSCAD 相互運用 — 調査メモ（Tier 3）

**結論（2026-05）:** 現時点では **Part DSL v1 を正** とし、OpenSCAD への自動変換は行わない。

## 理由

| 観点 | Part DSL | OpenSCAD |
|------|----------|----------|
| 2D 図面ファースト | SVG pages + 正投影 | 3D CSG 直書き |
| AI / MCP | JSON + Intent API | テキスト SCAD 生成は可能だが検証が別系統 |
| 製造 | laser_cut 等の 2D 出力が主 | 3D メッシュ向き |

## 将来の接続案

1. **Export only** — `box` / `panel` から簡易 SCAD テンプレート（直方体 `cube()`）を生成
2. **Import hint** — SCAD の `width/height/depth` 変数を Part DSL `params` にマップ（手動レビュー必須）
3. **共有層** — 寸法パラメータ W/D/H のみ双方向（geometry topology は非対応）

実装時は `packages/part-dsl.js` の `compilePartDsl` 出力を SCAD emitter に渡す形が自然。
