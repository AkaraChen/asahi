import type { DesktopPullRequestNotificationResult } from '../shared/githubNotifications';

export {};

declare global {
  interface Window {
    asahi: {
      getApiBaseURL(): Promise<string>;
      listPullRequestNotifications(): Promise<
        DesktopPullRequestNotificationResult
      >;
    };
  }
}
