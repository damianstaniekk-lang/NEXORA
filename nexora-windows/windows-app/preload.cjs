const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('nexoraDesktop', {
  getConfig: () => ipcRenderer.invoke('nexora:get-config'),
  saveServer: (url) => ipcRenderer.invoke('nexora:save-server', url)
});
