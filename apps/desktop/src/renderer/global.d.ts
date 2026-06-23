import type {
  DesktopListOwnerRepositoriesRequest,
  DesktopListPullRequestsRequest,
  DesktopPullRequestResult,
  DesktopRepositoriesResult,
  DesktopRepositoryOwnersResult,
} from '../shared/githubPullRequests';

export {};

declare global {
  interface Window {
    asahi: {
      getApiBaseURL(): Promise<string>;
      listOwnerRepositories(
        request: DesktopListOwnerRepositoriesRequest
      ): Promise<DesktopRepositoriesResult>;
      listRepositoryOwners(): Promise<DesktopRepositoryOwnersResult>;
      listRepositoryPullRequests(
        request: DesktopListPullRequestsRequest
      ): Promise<DesktopPullRequestResult>;
    };
  }
}
