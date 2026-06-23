import { contextBridge, ipcRenderer } from 'electron';

import {
  LIST_GITHUB_PULL_REQUEST_NOTIFICATIONS_CHANNEL,
} from '../shared/githubNotifications';

contextBridge.exposeInMainWorld('asahi', {
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
  listPullRequestNotifications: () =>
    ipcRenderer.invoke(LIST_GITHUB_PULL_REQUEST_NOTIFICATIONS_CHANNEL),
});
