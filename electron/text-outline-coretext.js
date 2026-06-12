"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

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

function outlineTextCoreText(payload) {
  const bin = getCoreTextBinaryPath();
  if (!fs.existsSync(bin)) {
    return null;
  }

  const proc = spawnSync(bin, [], {
    input: JSON.stringify(payload),
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
