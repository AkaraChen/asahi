import { contextBridge, ipcRenderer } from 'electron';

import {
  LIST_OWNER_REPOSITORIES_CHANNEL,
  LIST_REPOSITORY_OWNERS_CHANNEL,
  LIST_REPOSITORY_PULL_REQUESTS_CHANNEL,
  type DesktopListOwnerRepositoriesRequest,
  type DesktopListPullRequestsRequest,
} from '../shared/githubPullRequests';
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
  listOwnerRepositories: (request: DesktopListOwnerRepositoriesRequest) =>
    ipcRenderer.invoke(LIST_OWNER_REPOSITORIES_CHANNEL, request),
  listRepositoryOwners: () =>
    ipcRenderer.invoke(LIST_REPOSITORY_OWNERS_CHANNEL),
  listRepositoryPullRequests: (request: DesktopListPullRequestsRequest) =>
    ipcRenderer.invoke(LIST_REPOSITORY_PULL_REQUESTS_CHANNEL, request),
  getViewerTabRequest: (id: string) =>
    ipcRenderer.invoke(DESKTOP_GET_VIEWER_TAB_REQUEST_CHANNEL, id),
  openViewerTab: (request: DesktopViewerTabRequest) =>
    ipcRenderer.invoke(DESKTOP_OPEN_VIEWER_TAB_CHANNEL, request),
  selectDesktopTab: (request: DesktopSelectTabRequest) =>
    ipcRenderer.invoke(DESKTOP_SELECT_TAB_CHANNEL, request),
});
