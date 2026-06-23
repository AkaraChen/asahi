export const LIST_GITHUB_PULL_REQUEST_NOTIFICATIONS_CHANNEL =
  'asahi:list-github-pull-request-notifications';

export interface DesktopPullRequestNotification {
  id: string;
  title: string;
  repository: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  viewerPath: string;
  reason: string;
  unread: boolean;
  updatedAt: string;
}

export type DesktopPullRequestNotificationResult =
  | {
      ok: true;
      items: DesktopPullRequestNotification[];
      fetchedAt: string;
    }
  | {
      ok: false;
      error:
        | 'gh-not-found'
        | 'gh-auth-required'
        | 'gh-api-failed'
        | 'parse-failed';
      message: string;
    };
