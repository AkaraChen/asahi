import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('asahi', {
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
});
