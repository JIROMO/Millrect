"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { findBundledFontFile } = require("./font-path");
const { BUILTIN_FONT_GEN } = require("../packages/builtin-fonts");

function getCoreTextBinaryPath() {
  const binName = "outline-text";
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, "native", binName);
  }
  return path.join(
    __dirname,
    "..",
    "native",
    "macos",
    "outline-text",
    "bin",
    binName,
  );
}

function isCoreTextOutlineAvailable() {
  if (process.platform !== "darwin") return false;
  const bin = getCoreTextBinaryPath();
  return fs.existsSync(bin);
}

// asar 内のフォントは外部プロセス（Swift ヘルパー）から直接読めないため、
// 一度だけ実ファイルへ展開してそのパスを使う（dev 環境は元パスをそのまま返す）
const _materializedFontPaths = new Map();
function _materializedFontPath(family, bold) {
  const cacheKey = `${family}|${bold ? "b" : "r"}`;
  if (_materializedFontPaths.has(cacheKey)) {
    return _materializedFontPaths.get(cacheKey);
  }
  let result = findBundledFontFile(family, bold ? "Bold" : "Regular");
  if (result && result.includes(".asar")) {
    try {
      const os = require("os");
      const dir = path.join(
        app?.getPath?.("userData") || os.tmpdir(),
        "native-fonts",
      );
      fs.mkdirSync(dir, { recursive: true });
      const dst = path.join(dir, path.basename(result));
      const bytes = fs.readFileSync(result); // asar 内は Electron の fs で読む
      if (!fs.existsSync(dst) || fs.statSync(dst).size !== bytes.length) {
        fs.writeFileSync(dst, bytes);
      }
      result = dst;
    } catch (err) {
      console.warn("[outline] bundled font extract failed:", err.message);
      result = null;
    }
  }
  _materializedFontPaths.set(cacheKey, result);
  return result;
}

// 同梱フォント（Gen Interface JP）のファイルパスを payload に付与する。
// Core Text は OS 未インストールの family 名を Helvetica 系へ無言置換するため、
// ヘルパー側でファイル実体から CTFont を生成できるようにする
function _withBuiltinFontFiles(payload) {
  if (payload?.fontFiles?.length) return payload;
  const files = [];
  for (const bold of [false, true]) {
    const p = _materializedFontPath(BUILTIN_FONT_GEN, bold);
    if (p) files.push({ family: BUILTIN_FONT_GEN, bold, path: p });
  }
  if (!files.length) return payload;
  return { ...payload, fontFiles: files };
}

function outlineTextCoreText(payload) {
  const bin = getCoreTextBinaryPath();
  if (!fs.existsSync(bin)) {
    return null;
  }

  const proc = spawnSync(bin, [], {
    input: JSON.stringify(_withBuiltinFontFiles(payload)),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (proc.error) {
    throw proc.error;
  }
  if (proc.status !== 0) {
    let message = proc.stderr?.trim() || "Core Text outline failed";
    try {
      const parsed = JSON.parse(proc.stdout || "{}");
      if (parsed.error) message = parsed.error;
    } catch (_) {}
    throw new Error(message);
  }

  const result = JSON.parse(proc.stdout || "{}");
  if (result.error) {
    throw new Error(result.error);
  }
  return result;
}

module.exports = {
  outlineTextCoreText,
  isCoreTextOutlineAvailable,
  getCoreTextBinaryPath,
};
