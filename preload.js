const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onMenu: (channel, callback) => {
    const validChannels = [
      "menu:new",
      "menu:open",
      "menu:print",
      "menu:exportSvg",
      "menu:exportPdf",
      "menu:exportJson",
      "menu:undo",
      "menu:redo",
      "menu:zoomIn",
      "menu:zoomOut",
      "menu:zoomReset",
      "menu:booleanUnion",
      "menu:booleanSubtract",
      "menu:booleanIntersect",
      "menu:booleanExclude",
      "menu:booleanFlatten",
      "menu:helpSearch",
      "menu:helpShortcuts",
      "menu:openHelpDoc",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  saveProjectJson: (defaultName, content) =>
    ipcRenderer.invoke("dialog:saveProjectJson", { defaultName, content }),
  openProjectJson: () => ipcRenderer.invoke("dialog:openProjectJson"),
  openImageFile: () => ipcRenderer.invoke("dialog:openImageFile"),
  saveSvg: (defaultName, content) =>
    ipcRenderer.invoke("dialog:saveSvg", { defaultName, content }),
  saveDxf: (defaultName, content) =>
    ipcRenderer.invoke("dialog:saveDxf", { defaultName, content }),
  savePdf: (defaultName, buffer) =>
    ipcRenderer.invoke("dialog:savePdf", { defaultName, buffer }),
  readFont: (family, style) =>
    ipcRenderer.invoke("font:read", { family, style }),
  outlineTextShape: (payload) =>
    ipcRenderer.invoke("font:outlineText", payload),
  measureTextLayout: (payload) =>
    ipcRenderer.invoke("font:measureTextLayout", payload),
  isDesktopApp: true,
  printPage: () => ipcRenderer.invoke("print:page"),
  openHelpTopic: (page, anchor) =>
    ipcRenderer.invoke("help:openTopic", { page, anchor }),
  setAppLocale: (locale) => ipcRenderer.invoke("app:setLocale", locale),
  onUpdateInfo: (cb) => ipcRenderer.on("update-info", (_, info) => cb(info)),
  downloadUpdate: (url) => ipcRenderer.invoke("update:download", url),
  skipUpdate: () => ipcRenderer.invoke("update:skip"),
});

// 起動ローダーはデスクトップ版では不要（ローカル読み込みが速く、一瞬映るだけ）。
// 初回ペイント前に <html> へ印を付け、CSS で非表示にする（チラつきゼロ）。
function markDesktopApp() {
  document.documentElement.classList.add("is-desktop");
}
if (document.documentElement) {
  markDesktopApp();
} else {
  // <html> 未生成なら、生成され次第すぐ付与する。
  new MutationObserver((_records, obs) => {
    if (document.documentElement) {
      markDesktopApp();
      obs.disconnect();
    }
  }).observe(document, { childList: true });
}
