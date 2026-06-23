import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  DesktopGitHubFailure,
  DesktopListOwnerRepositoriesRequest,
  DesktopListPullRequestsRequest,
  DesktopPullRequest,
  DesktopPullRequestResult,
  DesktopRepositoriesResult,
  DesktopRepository,
  DesktopRepositoryOwnersResult,
  DesktopRepositoryPermission,
  DesktopSelectedRepository,
} from '../shared/githubPullRequests';

const execFileAsync = promisify(execFile);
const MERGE_PERMISSIONS = new Set(['WRITE', 'MAINTAIN', 'ADMIN']);

const PULL_REQUESTS_QUERY = `
  query($owner: String!, $name: String!, $after: String) {
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
          title
          updatedAt
          url
        }
      }
    }
  }
`;

const OWNER_REPOSITORIES_QUERY = `
  query($owner: String!, $after: String) {
    repositoryOwner(login: $owner) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { endCursor hasNextPage }
        nodes {
          id
          name
          nameWithOwner
          isPrivate
          viewerPermission
          activePullRequests: pullRequests(states: OPEN) { totalCount }
          closedPullRequests: pullRequests(states: [CLOSED, MERGED]) {
            totalCount
          }
        }
      }
    }
  }
`;

type PageInfo = { endCursor: string | null; hasNextPage: boolean };
type GitHubPermission = DesktopRepositoryPermission | 'READ' | 'TRIAGE';

type GitHubRepository = {
  id: string;
  name: string;
  nameWithOwner: string;
  isPrivate: boolean;
  viewerPermission: GitHubPermission;
  activePullRequests: { totalCount: number };
  closedPullRequests: { totalCount: number };
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
    const repositories = await loadOwnerRepositories(request.owner);
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

async function loadOwnerRepositories(owner: string): Promise<GitHubRepository[]> {
  const items: GitHubRepository[] = [];
  let after: string | undefined;

  for (;;) {
    const response = await graphql<{
      data: {
        repositoryOwner: {
          repositories: {
            pageInfo: PageInfo;
            nodes: GitHubRepository[];
          };
        } | null;
      };
    }>(OWNER_REPOSITORIES_QUERY, { owner, after });
    const repositories = response.data.repositoryOwner?.repositories;
    if (repositories == null) return items;

    items.push(...repositories.nodes);
    if (!repositories.pageInfo.hasNextPage) break;
    after = repositories.pageInfo.endCursor ?? undefined;
    if (after == null) break;
  }

  return items;
}

export async function listGitHubPullRequestsForRepositories(
  request: DesktopListPullRequestsRequest
): Promise<DesktopPullRequestResult> {
  try {
    const results = await Promise.all(
      request.repositories.map(loadPullRequestsForRepository)
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
  repository: GitHubRepository
): DesktopRepository | undefined {
  if (
    repository.viewerPermission !== 'WRITE' &&
    repository.viewerPermission !== 'MAINTAIN' &&
    repository.viewerPermission !== 'ADMIN'
  ) {
    return undefined;
  }
  const viewerPermission = repository.viewerPermission;
  const [owner] = repository.nameWithOwner.split('/');

  return {
    id: repository.id,
    owner,
    name: repository.name,
    nameWithOwner: repository.nameWithOwner,
    isPrivate: repository.isPrivate,
    activePullRequestCount: repository.activePullRequests.totalCount,
    closedPullRequestCount: repository.closedPullRequests.totalCount,
    viewerPermission,
  };
}

export function toDesktopPullRequest(
  pullRequest: PullRequestNode,
  repository: string,
  viewerPermission: DesktopRepositoryPermission
): DesktopPullRequest {
  const [owner, repo] = repository.split('/');

  return {
    ...pullRequest,
    owner,
    repo,
    repository,
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
