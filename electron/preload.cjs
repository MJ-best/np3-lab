// Exposes a narrow, promise-based card API to the page. The page never gets Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nikonPcLab", {
  platform: process.platform,
  listCards: () => ipcRenderer.invoke("cards:list"),
  readCard: (cardPath) => ipcRenderer.invoke("card:read", cardPath),
  writeFiles: (cardPath, files) => ipcRenderer.invoke("card:write", cardPath, files),
  trashFile: (cardPath, fileName) => ipcRenderer.invoke("card:trash", cardPath, fileName),
  eject: (cardPath) => ipcRenderer.invoke("card:eject", cardPath),
  reveal: (cardPath) => ipcRenderer.invoke("card:reveal", cardPath),
  chooseExportFolder: (defaultPath) => ipcRenderer.invoke("export:choose-folder", defaultPath),
  exportRecipes: (folder, files) => ipcRenderer.invoke("export:write", folder, files),
  revealExport: (folder) => ipcRenderer.invoke("export:reveal", folder),
  findLocalNp3: (sinceMs) => ipcRenderer.invoke("np3:find-local", sinceMs),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  onCardsChanged: (callback) => {
    const listener = (_event, cards) => callback(cards);
    ipcRenderer.on("cards:changed", listener);
    return () => ipcRenderer.removeListener("cards:changed", listener);
  },
});
