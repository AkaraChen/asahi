import { contextBridge, ipcRenderer } from 'electron';

import {
  LIST_OWNER_REPOSITORIES_CHANNEL,
  LIST_REPOSITORY_OWNERS_CHANNEL,
  LIST_REPOSITORY_PULL_REQUESTS_CHANNEL,
} from '../shared/githubPullRequests';
import {
  DESKTOP_CLOSE_VIEWER_TAB_CHANNEL,
  DESKTOP_OPEN_VIEWER_TAB_CHANNEL,
  DESKTOP_SELECT_TAB_CHANNEL,
} from '../shared/desktopTabs';

contextBridge.exposeInMainWorld('asahi', {
  closeViewerTab: (id: string) =>
    ipcRenderer.invoke(DESKTOP_CLOSE_VIEWER_TAB_CHANNEL, id),
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
  listOwnerRepositories: (request: unknown) =>
    ipcRenderer.invoke(LIST_OWNER_REPOSITORIES_CHANNEL, request),
  listRepositoryOwners: () =>
    ipcRenderer.invoke(LIST_REPOSITORY_OWNERS_CHANNEL),
  listRepositoryPullRequests: (request: unknown) =>
    ipcRenderer.invoke(LIST_REPOSITORY_PULL_REQUESTS_CHANNEL, request),
  openViewerTab: (request: unknown) =>
    ipcRenderer.invoke(DESKTOP_OPEN_VIEWER_TAB_CHANNEL, request),
  selectDesktopTab: (request: unknown) =>
    ipcRenderer.invoke(DESKTOP_SELECT_TAB_CHANNEL, request),
});
