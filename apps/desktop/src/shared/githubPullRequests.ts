import { z } from 'zod';

export const LIST_REPOSITORY_OWNERS_CHANNEL =
  'asahi:list-repository-owners';
export const LIST_OWNER_REPOSITORIES_CHANNEL =
  'asahi:list-owner-repositories';
export const LIST_REPOSITORY_PULL_REQUESTS_CHANNEL =
  'asahi:list-repository-pull-requests';

export type DesktopRepositoryPermission = 'WRITE' | 'MAINTAIN' | 'ADMIN';

export type DesktopPullRequestReviewDecision =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REVIEW_REQUIRED'
  | null;

export interface DesktopRepositoryOwner {
  avatarUrl: string;
  login: string;
  name: string | null;
  type: 'personal' | 'organization';
}

export interface DesktopRepository {
  id: string;
  owner: string;
  name: string;
  nameWithOwner: string;
  isPrivate: boolean;
  viewerPermission: DesktopRepositoryPermission;
}

const repositoryName = z.string().min(1);

export const DesktopSelectedRepositorySchema = z
  .object({
    owner: repositoryName,
    name: repositoryName,
    nameWithOwner: repositoryName,
  })
  .refine(
    (repository) =>
      repository.nameWithOwner === `${repository.owner}/${repository.name}`,
    { message: 'nameWithOwner must match owner/name' }
  );

export type DesktopSelectedRepository = z.infer<
  typeof DesktopSelectedRepositorySchema
>;

export interface DesktopPullRequest {
  id: string;
  title: string;
  repository: string;
  owner: string;
  repo: string;
  bodyHTML?: string;
  viewerAvatarUrl?: string;
  number: number;
  url: string;
  viewerPath: string;
  updatedAt: string;
  isDraft: boolean;
  reviewDecision: DesktopPullRequestReviewDecision;
  mergeStateStatus: string | null;
  viewerPermission: DesktopRepositoryPermission;
}

export const DesktopListOwnerRepositoriesRequestSchema = z.object({
  owner: repositoryName,
  ownerType: z.enum(['personal', 'organization']),
});

export type DesktopListOwnerRepositoriesRequest = z.infer<
  typeof DesktopListOwnerRepositoriesRequestSchema
>;

export const DesktopListPullRequestsRequestSchema = z.object({
  repositories: z.array(DesktopSelectedRepositorySchema),
});

export type DesktopListPullRequestsRequest = z.infer<
  typeof DesktopListPullRequestsRequestSchema
>;

export type DesktopGitHubFailure = {
  ok: false;
  error:
    | 'gh-not-found'
    | 'gh-auth-required'
    | 'gh-api-failed'
    | 'parse-failed';
  message: string;
};

export type DesktopRepositoryOwnersResult =
  | {
      ok: true;
      owners: DesktopRepositoryOwner[];
    }
  | DesktopGitHubFailure;

export type DesktopRepositoriesResult =
  | {
      ok: true;
      items: DesktopRepository[];
    }
  | DesktopGitHubFailure;

export type DesktopPullRequestResult =
  | {
      ok: true;
      items: DesktopPullRequest[];
      fetchedAt: string;
    }
  | DesktopGitHubFailure;
