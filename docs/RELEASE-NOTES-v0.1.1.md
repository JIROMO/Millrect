## Millrect v0.1.1（プレリリース・macOS のみ） / Pre-release (macOS only)

バグ修正リリースです。**コード署名・公証は未実施**のため、初回起動時に macOS のセキュリティ警告が出る場合があります。

Bug-fix release. **Not code-signed or notarized** — macOS may show a security warning on first launch.

### 修正 / Fixes

- **ブール結合で回転が失われる問題を修正** — 90° 回転した図形を未回転の図形と結合すると、回転が 0° に戻って結合されていました。ブール演算（union / subtract / intersect / exclude）が `rotation` / `flipH` / `flipV` を輪郭へ正しく焼き込むようにしました。
  Fixed boolean operations discarding a shape's rotation: combining a rotated shape with a non-rotated one no longer resets it to 0°. `rotation` / `flipH` / `flipV` are now baked into the geometry before clipping.
- **選択状態が不正値になった際のクラッシュを修正** — `selectedShapeIds` が配列でなくなると描画・操作・レイヤー一覧が落ちていました。外部コマンド入力を矯正し、状態側でも自己修復するようにしました。
  Fixed crashes when `selectedShapeIds` became a non-array value (render / interaction / layers list). External commands are now coerced and the state self-heals.

### ダウンロード（macOS） / Downloads (macOS)

| ファイル / File | 対象 / Platform |
|-----------------|-----------------|
| `Millrect-0.1.1-arm64.dmg` | macOS（Apple Silicon） |
| `Millrect-0.1.1.dmg` | macOS（Intel） |

Windows 版は未リリースです。Windows では [ブラウザ版](https://millrect.com/app/) をご利用ください。

No Windows build yet. On Windows, use the [browser app](https://millrect.com/app/).

### インストール / Install

- 手順 / Guide: https://millrect.com/docs/desktop-download.html（[English](https://millrect.com/docs/en/desktop-download.html)）
- 警告時 / If blocked: Finder で **右クリック → 開く** / **Right-click → Open**

ブラウザ版 / Browser app: https://millrect.com/app/
