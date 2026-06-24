import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pLimit from 'p-limit';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const MERGE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN']);
const PULL_REQUEST_FETCH_CONCURRENCY = 4;

const PULL_REQUESTS_QUERY = `
  query($owner: String!, $name: String!, $after: String) {
    viewer {
      avatarUrl
    }
    repository(owner: $owner, name: $name) {
      nameWithOwner
      viewerPermission
      pullRequests(
        first: 100
        after: $after
        states: OPEN
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { endCursor hasNextPage }
        nodes {
          id
          isDraft
          mergeStateStatus
          number
          reviewDecision
          bodyHTML
          title
          updatedAt
          url
        }
      }
    }
  }
`;

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

type PageInfo = { endCursor: string | null; hasNextPage: boolean };
type GitHubPermission = DesktopRepositoryPermission | 'READ' | 'TRIAGE';

type GitHubRestRepository = {
  id: string;
  name: string;
  full_name: string;
  private: boolean;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
  };
};

type PullRequestNode = Omit<
  DesktopPullRequest,
  'owner' | 'repo' | 'repository' | 'viewerPath' | 'viewerPermission'
>;

type PullRequestConnection = {
  pageInfo: PageInfo;
  nodes: PullRequestNode[];
};

export async function listGitHubRepositoryOwners(): Promise<DesktopRepositoryOwnersResult> {
  try {
    const [viewer, organizations] = await Promise.all([
      rest<{ avatar_url: string; login: string; name: string | null }>('user'),
      rest<
        { avatar_url: string; login: string; description: string | null }[]
      >('user/orgs?per_page=100'),
    ]);

    return {
      ok: true,
      owners: [
        {
          avatarUrl: viewer.avatar_url,
          login: viewer.login,
          name: viewer.name,
          type: 'personal',
        },
        ...organizations.map((organization) => ({
          avatarUrl: organization.avatar_url,
          login: organization.login,
          name: organization.description,
          type: 'organization' as const,
        })),
      ],
    };
  } catch (error) {
    return mapGhError(error);
  }
}

export async function listGitHubOwnerRepositories(
  request: DesktopListOwnerRepositoriesRequest
): Promise<DesktopRepositoriesResult> {
  try {
    const repositories = await loadOwnerRepositories(request);
    const items = repositories
      .map(toDesktopRepository)
      .filter((repository) => repository != null);

    return {
      ok: true,
      items,
    };
  } catch (error) {
    return mapGhError(error);
  }
}

async function loadOwnerRepositories(
  request: DesktopListOwnerRepositoriesRequest
): Promise<GitHubRestRepository[]> {
  const endpoint =
    request.ownerType === 'personal'
      ? 'user/repos?affiliation=owner&visibility=all&sort=pushed'
      : `orgs/${encodeURIComponent(
          request.owner
        )}/repos?type=all&sort=pushed`;
  return rest<GitHubRestRepository[]>(endpoint);
}

export async function listGitHubPullRequestsForRepositories(
  request: DesktopListPullRequestsRequest
): Promise<DesktopPullRequestResult> {
  try {
    const limit = pLimit(PULL_REQUEST_FETCH_CONCURRENCY);
    const results = await Promise.all(
      request.repositories.map((repository) =>
        limit(() => loadPullRequestsForRepository(repository))
      )
    );

    return {
      ok: true,
      items: results
        .flat()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return mapGhError(error);
  }
}

async function loadPullRequestsForRepository(
  repository: DesktopSelectedRepository
): Promise<DesktopPullRequest[]> {
  const items: DesktopPullRequest[] = [];
  let after: string | undefined;

  for (;;) {
    const response = await graphql<{
      data: {
        viewer: { avatarUrl: string } | null;
        repository: {
          nameWithOwner: string;
          viewerPermission: GitHubPermission;
          pullRequests: PullRequestConnection;
        } | null;
      };
    }>(PULL_REQUESTS_QUERY, {
      owner: repository.owner,
      name: repository.name,
      after,
    });
    const remoteRepository = response.data.repository;
    if (
      remoteRepository == null ||
      !MERGE_PERMISSIONS.has(remoteRepository.viewerPermission)
    ) {
      return [];
    }

    items.push(
      ...remoteRepository.pullRequests.nodes.map((pullRequest) =>
        toDesktopPullRequest(
          pullRequest,
          remoteRepository.nameWithOwner,
          response.data.viewer?.avatarUrl,
          remoteRepository.viewerPermission as DesktopRepositoryPermission
        )
      )
    );

    if (!remoteRepository.pullRequests.pageInfo.hasNextPage) break;
    after = remoteRepository.pullRequests.pageInfo.endCursor ?? undefined;
    if (after == null) break;
  }

  return items;
}

export function toDesktopRepository(
  repository: GitHubRestRepository
): DesktopRepository | undefined {
  const viewerPermission = toDesktopRepositoryPermission(
    repository.permissions
  );
  if (viewerPermission == null) {
    return undefined;
  }
  const [owner] = repository.full_name.split('/');

  return {
    id: repository.id,
    owner,
    name: repository.name,
    nameWithOwner: repository.full_name,
    isPrivate: repository.private,
    viewerPermission,
  };
}

function toDesktopRepositoryPermission(
  permissions: GitHubRestRepository['permissions']
): DesktopRepositoryPermission | undefined {
  if (permissions?.admin) return 'ADMIN';
  if (permissions?.maintain) return 'MAINTAIN';
  if (permissions?.push) return 'WRITE';
  return undefined;
}

export function toDesktopPullRequest(
  pullRequest: PullRequestNode,
  repository: string,
  viewerAvatarUrl: string | undefined,
  viewerPermission: DesktopRepositoryPermission
): DesktopPullRequest {
  const [owner, repo] = repository.split('/');

  return {
    ...pullRequest,
    owner,
    repo,
    repository,
    viewerAvatarUrl,
    viewerPath: `/${owner}/${repo}/pull/${pullRequest.number}`,
    viewerPermission,
  };
}

async function graphql<T>(
  query: string,
  variables: Record<string, string | undefined> = {}
): Promise<T> {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value != null) args.push('-F', `${name}=${value}`);
  }

  const { stdout } = await execFileAsync('gh', args, {
    maxBuffer: 1024 * 1024 * 16,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as T;
}

async function rest<T>(endpoint: string): Promise<T> {
  const { stdout } = await execFileAsync('gh', ['api', endpoint], {
    maxBuffer: 1024 * 1024 * 16,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as T;
}

function mapGhError(error: unknown): DesktopGitHubFailure {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    return {
      ok: false,
      error: 'gh-not-found',
      message: 'GitHub CLI is not installed or not available on PATH.',
    };
  }

  const maybeStderr =
    error instanceof Error
      ? (error as Error & { stderr?: unknown }).stderr
      : undefined;
  const stderr = typeof maybeStderr === 'string' ? maybeStderr : '';
  if (/auth login|not logged|authentication|HTTP 401/i.test(stderr)) {
    return {
      ok: false,
      error: 'gh-auth-required',
      message: 'GitHub CLI is not authenticated. Run gh auth login and refresh.',
    };
  }

  if (error instanceof SyntaxError) {
    return {
      ok: false,
      error: 'parse-failed',
      message: 'GitHub CLI returned unreadable GitHub data.',
    };
  }

  return {
    ok: false,
    error: 'gh-api-failed',
    message: stderr.trim() || 'GitHub CLI failed to load GitHub data.',
  };
}
