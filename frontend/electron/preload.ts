// @ts-ignore
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendMessage: (message: any) => ipcRenderer.send("message-from-ui", message),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  showInExplorer: (filePath: string) =>
    ipcRenderer.invoke("shell:showInExplorer", filePath),
  // Cookie management
  fetchCookies: (targetUrl: string) =>
    ipcRenderer.invoke("cookies:fetch", targetUrl),
  // Data extraction
  // Data extraction
  extractDouyinData: (url: string) => ipcRenderer.invoke("douyin:extract", url),
  // File Utils
  getPathForFile: (file: File) =>
    // @ts-ignore
    require("electron").webUtils.getPathForFile(file),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
});
