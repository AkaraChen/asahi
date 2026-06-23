import type {
  DesktopListOwnerRepositoriesRequest,
  DesktopListPullRequestsRequest,
  DesktopPullRequestResult,
  DesktopRepositoriesResult,
  DesktopRepositoryOwnersResult,
} from '../shared/githubPullRequests';
import type {
  DesktopSelectTabRequest,
  DesktopViewerTabRequest,
} from '../shared/desktopTabs';

export {};

declare global {
  interface Window {
    asahi: {
      closeViewerTab(id: string): Promise<void>;
      getApiAccessToken(): Promise<{ header: string; token: string }>;
      getApiBaseURL(): Promise<string>;
      listOwnerRepositories(
        request: DesktopListOwnerRepositoriesRequest
      ): Promise<DesktopRepositoriesResult>;
      listRepositoryOwners(): Promise<DesktopRepositoryOwnersResult>;
      listRepositoryPullRequests(
        request: DesktopListPullRequestsRequest
      ): Promise<DesktopPullRequestResult>;
      openViewerTab(request: DesktopViewerTabRequest): Promise<void>;
      selectDesktopTab(request: DesktopSelectTabRequest): Promise<void>;
    };
  }
}
