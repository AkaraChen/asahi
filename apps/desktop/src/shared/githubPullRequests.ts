export const LIST_MERGEABLE_PULL_REQUESTS_CHANNEL =
  'asahi:list-mergeable-pull-requests';

export type DesktopPullRequestReviewDecision =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REVIEW_REQUIRED'
  | null;

export interface DesktopPullRequest {
  id: string;
  title: string;
  repository: string;
  owner: string;
  repo: string;
  number: number;
  url: string;
  viewerPath: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: DesktopPullRequestReviewDecision;
  mergeStateStatus: string | null;
  viewerPermission: 'WRITE' | 'MAINTAIN' | 'ADMIN';
}

export type DesktopPullRequestResult =
  | {
      ok: true;
      items: DesktopPullRequest[];
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
