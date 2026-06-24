import { contextBridge, ipcRenderer } from 'electron';

import {
  DESKTOP_CLOSE_VIEWER_TAB_CHANNEL,
  DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL,
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  DESKTOP_SELECT_TAB_CHANNEL,
  type DesktopSelectTabRequest,
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
  selectDesktopTab: (request: DesktopSelectTabRequest) =>
    ipcRenderer.invoke(DESKTOP_SELECT_TAB_CHANNEL, request),
});
