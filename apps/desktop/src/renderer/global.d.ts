import type { DesktopPullRequestResult } from '../shared/githubPullRequests';

export {};

declare global {
  interface Window {
    asahi: {
      getApiBaseURL(): Promise<string>;
      listMergeablePullRequests(): Promise<DesktopPullRequestResult>;
    };
  }
}
