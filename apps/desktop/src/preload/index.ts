import { contextBridge, ipcRenderer } from 'electron';

import {
  LIST_OWNER_REPOSITORIES_CHANNEL,
  LIST_REPOSITORY_OWNERS_CHANNEL,
  LIST_REPOSITORY_PULL_REQUESTS_CHANNEL,
} from '../shared/githubPullRequests';

contextBridge.exposeInMainWorld('asahi', {
  getApiBaseURL: () => ipcRenderer.invoke('asahi:get-api-base-url'),
  listOwnerRepositories: (request: unknown) =>
    ipcRenderer.invoke(LIST_OWNER_REPOSITORIES_CHANNEL, request),
  listRepositoryOwners: () =>
    ipcRenderer.invoke(LIST_REPOSITORY_OWNERS_CHANNEL),
  listRepositoryPullRequests: (request: unknown) =>
    ipcRenderer.invoke(LIST_REPOSITORY_PULL_REQUESTS_CHANNEL, request),
});
