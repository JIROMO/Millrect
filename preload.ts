const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onMenu: (channel: string, callback: any) => {
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
  saveProjectJson: (defaultName: string, content: any) =>
    ipcRenderer.invoke("dialog:saveProjectJson", { defaultName, content }),
  openProjectJson: () => ipcRenderer.invoke("dialog:openProjectJson"),
  openImageFile: () => ipcRenderer.invoke("dialog:openImageFile"),
  saveSvg: (defaultName: string, content: any) =>
    ipcRenderer.invoke("dialog:saveSvg", { defaultName, content }),
  savePdf: (defaultName: string, buffer: any) =>
    ipcRenderer.invoke("dialog:savePdf", { defaultName, buffer }),
  readFont: (family: string, style: string) =>
    ipcRenderer.invoke("font:read", { family, style }),
  readFontLibrary: () => ipcRenderer.invoke("fontLibrary:read"),
  writeFontLibrary: (data: any) => ipcRenderer.invoke("fontLibrary:write", data),
  readFontCatalogCache: () => ipcRenderer.invoke("fontCatalog:read"),
  writeFontCatalogCache: (data: any) =>
    ipcRenderer.invoke("fontCatalog:write", data),
  outlineTextShape: (payload: any) =>
    ipcRenderer.invoke("font:outlineText", payload),
  measureTextLayout: (payload: any) =>
    ipcRenderer.invoke("font:measureTextLayout", payload),
  isDesktopApp: true,
  openHelpTopic: (page: string, anchor: any) =>
    ipcRenderer.invoke("help:openTopic", { page, anchor }),
  setAppLocale: (locale: string) => ipcRenderer.invoke("app:setLocale", locale),
});
