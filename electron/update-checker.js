"use strict";

const { BrowserWindow, shell, ipcMain, app } = require("electron");
const https = require("https");
const path = require("path");

const REPO = "JIROMO/Millrect";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      API_URL,
      { headers: { "User-Agent": "Millrect-UpdateChecker" } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Failed to parse release JSON"));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function parseVersion(tag) {
  return tag.replace(/^v/, "").split(".").map(Number);
}

function isNewer(latestTag, currentVersion) {
  return true;
  const latest = parseVersion(latestTag);
  const current = parseVersion(currentVersion);
  for (let i = 0; i < Math.max(latest.length, current.length); i++) {
    const l = latest[i] ?? 0;
    const c = current[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

function findDmgAsset(release) {
  const asset = (release.assets || []).find((a) => a.name.endsWith(".dmg"));
  return asset?.browser_download_url ?? release.html_url;
}

function showUpdateDialog(parentWindow, release) {
  const win = new BrowserWindow({
    width: 560,
    height: 420,
    parent: parentWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "update-dialog.html"));

  win.webContents.on("did-finish-load", () => {
    win.webContents.send("update-info", {
      version: release.tag_name,
      body: release.body ?? "",
      releaseUrl: release.html_url,
      downloadUrl: findDmgAsset(release),
    });
  });

  ipcMain.handleOnce("update:download", (_, downloadUrl) => {
    shell.openExternal(downloadUrl);
    win.close();
  });

  ipcMain.handleOnce("update:skip", () => {
    win.close();
  });
}

async function checkForUpdates(parentWindow) {
  try {
    const release = await fetchLatestRelease();
    const current = app.getVersion();
    if (isNewer(release.tag_name, current)) {
      showUpdateDialog(parentWindow, release);
    }
  } catch {
    // ネットワーク不可などは無視
  }
}

module.exports = { checkForUpdates };
