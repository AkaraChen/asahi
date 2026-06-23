import { contextBridge, ipcRenderer } from 'electron';

import {
  LIST_MERGEABLE_PULL_REQUESTS_CHANNEL,
} from '../shared/githubPullRequests';

contextBridge.exposeInMainWorld('asahi', {
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
  listMergeablePullRequests: () =>
    ipcRenderer.invoke(LIST_MERGEABLE_PULL_REQUESTS_CHANNEL),
});
