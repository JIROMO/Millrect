"use strict";

// ─────────────────────────────────────────────────────────────
// 軽量ゴールデン・スナップショット
//
//   matchSnapshot("rect-profile", value)
//     初回 or UPDATE_SNAPSHOTS=1 → tests/integration/__snapshots__/<name>.json に書き出し
//     以降                       → 既存ファイルと厳密比較（差分で fail）
//
// 派生物（Profile rings / SVG / mesh 要約 …）を 1 行で固定したいとき向け。
// 更新は:  UPDATE_SNAPSHOTS=1 npm run test:integration
// ─────────────────────────────────────────────────────────────

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const SNAP_DIR = path.resolve(__dirname, "../integration/__snapshots__");

/**
 * volatile（実行ごとに変わる）値を正規化する。
 * クロックは固定しているので通常は不要だが、Date.now を使わない乱数 ID 等の保険。
 */
function normalize(value) {
  return JSON.parse(
    JSON.stringify(value, (key, val) => {
      if (typeof val === "number" && Number.isFinite(val)) {
        // 浮動小数の丸め誤差でスナップショットが揺れないよう 6 桁に丸める
        return Math.round(val * 1e6) / 1e6;
      }
      return val;
    }),
  );
}

function matchSnapshot(name, value) {
  if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true });
  const file = path.join(SNAP_DIR, `${name}.json`);
  const serialized = JSON.stringify(normalize(value), null, 2) + "\n";

  if (process.env.UPDATE_SNAPSHOTS || !fs.existsSync(file)) {
    fs.writeFileSync(file, serialized);
    return;
  }
  const expected = fs.readFileSync(file, "utf8");
  assert.equal(
    serialized,
    expected,
    `Snapshot mismatch: ${name}\n  → 意図した変更なら UPDATE_SNAPSHOTS=1 npm run test:integration で更新`,
  );
}

module.exports = { matchSnapshot, normalize, SNAP_DIR };
