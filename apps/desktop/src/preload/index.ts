import { contextBridge, ipcRenderer } from 'electron';

import {
  DESKTOP_CLOSE_VIEWER_TAB_CHANNEL,
  DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL,
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  DESKTOP_SELECT_TAB_CHANNEL,
  DESKTOP_TABS_CHANGED_CHANNEL,
  type DesktopSelectTabRequest,
  type DesktopTabsSnapshot,
  type DesktopViewerTabRequest,
} from '../shared/desktopTabs';

contextBridge.exposeInMainWorld('asahi', {
  closeViewerTab: (id: string) =>
    ipcRenderer.invoke(DESKTOP_CLOSE_VIEWER_TAB_CHANNEL, id),
  getApiAccessToken: () => ipcRenderer.invoke('asahi:get-api-access-token'),
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
  getViewerTabRequest: (id: string) =>
    ipcRenderer.invoke(DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL, id),
  openViewerTab: (request: DesktopViewerTabRequest) =>
    ipcRenderer.invoke(DESKTOP_OPEN_VIEWER_TAB_CHANNEL, request),
  onDesktopTabsChanged: (callback: (snapshot: DesktopTabsSnapshot) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: DesktopTabsSnapshot
    ) => callback(snapshot);
    ipcRenderer.on(DESKTOP_TABS_CHANGED_CHANNEL, listener);
    return () =>
      ipcRenderer.removeListener(DESKTOP_TABS_CHANGED_CHANNEL, listener);
  },
  selectDesktopTab: (request: DesktopSelectTabRequest) =>
    ipcRenderer.invoke(DESKTOP_SELECT_TAB_CHANNEL, request),
});
